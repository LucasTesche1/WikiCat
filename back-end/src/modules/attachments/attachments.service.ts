import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Attachment, StorageTier } from '@wikicat/shared';
import { attachments, pages } from '../../db/schema/index.js';
import { findPageById } from '../pages/pages.service.js';
import { httpError } from '../../lib/http-errors.js';

export type Tier = Exclude<StorageTier, undefined>;

const STANDARD_MIME_PREFIXES = ['image/', 'text/'];
const STANDARD_MIME_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-gzip',
]);
const LARGE_EXT_WHITELIST = new Set([
  '.iso', '.tar', '.tar.gz', '.tgz', '.zip', '.sql',
  '.ova', '.img', '.qcow2', '.rpm', '.deb', '.pkg',
]);
const UNSAFE_FILENAME_RE = /[^a-zA-Z0-9._-]/g;

function extFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz')) return '.tar.gz';
  return path.extname(lower);
}

function sanitizeBasename(original: string): string {
  const base = path.basename(original).replace(/\s+/g, '_');
  const cleaned = base.replace(UNSAFE_FILENAME_RE, '').replace(/^[.-]+/, '');
  return cleaned.slice(0, 200) || 'file';
}

export function assertValidContentLength(
  app: FastifyInstance,
  req: FastifyRequest,
  tier: Tier,
): number {
  const raw = req.headers['content-length'];
  if (!raw) {
    throw httpError(411, 'Content-Length header is required for attachment uploads.');
  }
  const cl = Number(raw);
  if (!Number.isFinite(cl) || cl < 0) {
    throw httpError(400, 'Invalid Content-Length.');
  }
  const maxMB: number =
    tier === 'standard'
      ? app.config.MAX_ATTACHMENT_STANDARD_MB!
      : app.config.MAX_ATTACHMENT_LARGE_MB!;
  const maxBytes = maxMB * 1024 * 1024;
  if (cl > maxBytes) {
    const msg =
      tier === 'standard'
        ? `File exceeds the ${maxMB} MB standard tier limit; use the large attachment dialog.`
        : `Arquivo excede ${maxMB}MB do tier large.`;
    throw httpError(413, msg);
  }
  return cl;
}

export function validateMimeOrExt(tier: Tier, mimeType: string, originalName: string): void {
  const mime = (mimeType || '').toLowerCase();
  if (tier === 'standard') {
    const byPrefix = STANDARD_MIME_PREFIXES.some((p) => mime.startsWith(p));
    const byExact = STANDARD_MIME_EXACT.has(mime);
    if (!byPrefix && !byExact) {
      throw httpError(400, 'MIME type is not allowed in the standard tier (images, text, pdf, json, zip, gzip).');
    }
  } else {
    const ext = extFromName(originalName);
    if (!LARGE_EXT_WHITELIST.has(ext)) {
      const list = Array.from(LARGE_EXT_WHITELIST).join(', ');
      throw httpError(400, `Extension is not allowed in the large tier. Allowed: ${list}.`);
    }
  }
}

export function tierLogicalPrefix(tier: Tier): string {
  return tier === 'standard' ? '/attachments/' : '/attachments-large/';
}

export function tierRootDir(app: FastifyInstance, tier: Tier): string {
  return (tier === 'standard' ? app.config.ATTACHMENTS_DIR : app.config.ATTACHMENTS_LARGE_DIR)!;
}

export function assertPathTierCoherence(tier: Tier, logicalPath: string): void {
  const expected = tierLogicalPrefix(tier);
  if (!logicalPath.startsWith(expected)) {
    throw httpError(500, `storage_path (${logicalPath}) does not match tier ${tier} (expected prefix ${expected}).`);
  }
}

export function resolveFullFilesystemPath(app: FastifyInstance, tier: Tier, logicalPath: string): string {
  assertPathTierCoherence(tier, logicalPath);
  const prefix = tierLogicalPrefix(tier);
  const sub = logicalPath.slice(prefix.length);
  const safeSub = sub
    .split(/[\\/]+/)
    .filter((seg) => seg !== '..' && seg !== '.' && seg !== '')
    .join(path.sep);
  return path.join(tierRootDir(app, tier), safeSub);
}

export type AttachmentRow = typeof attachments.$inferSelect;

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    pageId: row.pageId,
    fileName: row.fileName,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes ?? 0),
    storagePath: row.storagePath,
    storageTier: (row.storageTier as Attachment['storageTier']) ?? 'standard',
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  };
}

export async function findAttachmentById(
  app: FastifyInstance,
  id: string,
  includeDeleted = false,
): Promise<AttachmentRow | null> {
  const rows = await app.db
    .select()
    .from(attachments)
    .where(
      includeDeleted
        ? eq(attachments.id, id)
        : and(eq(attachments.id, id), isNull(attachments.deletedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listAttachmentsForPage(app: FastifyInstance, pageId: string): Promise<Attachment[]> {
  const rows = await app.db
    .select()
    .from(attachments)
    .where(and(eq(attachments.pageId, pageId), isNull(attachments.deletedAt)))
    .orderBy(attachments.createdAt);
  return rows.map(toAttachment);
}

export async function uploadAttachment(
  app: FastifyInstance,
  pageId: string,
  userId: string,
  tier: Tier,
  stream: NodeJS.ReadableStream,
  originalName: string,
  mimeType: string,
  declaredLength: number,
): Promise<Attachment> {
  const page = await findPageById(app, pageId);
  if (!page) {
    throw httpError(404, 'Page not found.');
  }
  validateMimeOrExt(tier, mimeType, originalName);
  const ext = extFromName(originalName) || '.bin';
  const safeBase = sanitizeBasename(path.basename(originalName, ext)) || 'attachment';
  const uuid = crypto.randomUUID();
  const storedName = `${uuid}-${safeBase}${ext}`;
  const logicalSub = `${page.spaceId}/${page.id}/${storedName}`;
  const logicalPath = `${tierLogicalPrefix(tier)}${logicalSub}`;
  assertPathTierCoherence(tier, logicalPath);
  const fullDir = path.join(tierRootDir(app, tier), page.spaceId, page.id);
  await fsp.mkdir(fullDir, { recursive: true, mode: 0o750 });
  const fullPath = path.join(fullDir, storedName);
  const write = fs.createWriteStream(fullPath, { flags: 'wx', mode: 0o640 });
  try {
    await pipeline(stream, write);
  } catch (err) {
    try { await fsp.unlink(fullPath); } catch { /* ignore */ }
    throw err;
  }
  const stat = await fsp.stat(fullPath);
  const sizeBytes = Number(stat.size);
  if (declaredLength > 0 && Math.abs(sizeBytes - declaredLength) > 64 * 1024) {
    try { await fsp.unlink(fullPath); } catch { /* ignore */ }
    throw httpError(400, 'Received size differs from declared Content-Length. Upload rejected.');
  }
  const rows = await app.db
    .insert(attachments)
    .values({
      pageId,
      fileName: storedName,
      originalName: originalName.slice(0, 255),
      mimeType: (mimeType || 'application/octet-stream').slice(0, 120),
      sizeBytes,
      storagePath: logicalPath,
      storageTier: tier,
      uploadedBy: userId,
    })
    .returning();
  return toAttachment(rows[0]!);
}

export async function softDeleteAttachment(app: FastifyInstance, id: string): Promise<void> {
  const now = new Date();
  await app.db.update(attachments).set({ deletedAt: now }).where(eq(attachments.id, id));
}
