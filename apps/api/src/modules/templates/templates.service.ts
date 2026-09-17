import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { CreateTemplateRequest, DocumentTemplate, UpdateTemplateRequest } from '@wikicat/shared';
import { documentTemplates } from '../../db/schema/index.js';
import { httpError } from '../../lib/http-errors.js';

type TemplateRow = typeof documentTemplates.$inferSelect;

function slugify(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

function toTemplate(row: TemplateRow): DocumentTemplate {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description ?? null,
    contentMarkdown: row.contentMarkdown,
    isSystem: row.isSystem,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

async function findActiveById(app: FastifyInstance, id: string): Promise<TemplateRow | null> {
  const rows = await app.db.select().from(documentTemplates).where(and(eq(documentTemplates.id, id), isNull(documentTemplates.deletedAt))).limit(1);
  return rows[0] ?? null;
}

async function assertUnique(app: FastifyInstance, title: string, key: string, excludeId?: string) {
  const rows = await app.db.select({ id: documentTemplates.id }).from(documentTemplates)
    .where(and(isNull(documentTemplates.deletedAt), sql`(${documentTemplates.key} = ${key} OR lower(${documentTemplates.title}) = lower(${title}))`)).limit(1);
  const existing = rows[0];
  if (existing && existing.id !== excludeId) throw httpError(409, 'A template with this title or key already exists.');
}

export async function listTemplates(app: FastifyInstance): Promise<DocumentTemplate[]> {
  const rows = await app.db.select().from(documentTemplates).where(isNull(documentTemplates.deletedAt)).orderBy(asc(documentTemplates.title));
  return rows.map(toTemplate);
}

export async function createTemplate(app: FastifyInstance, userId: string, input: CreateTemplateRequest): Promise<DocumentTemplate> {
  const title = input.title.trim();
  const contentMarkdown = input.contentMarkdown.trim();
  if (!title) throw httpError(400, 'Template title is required.');
  if (!contentMarkdown) throw httpError(400, 'Template content is required.');
  const key = (input.key?.trim() || slugify(title));
  if (!key) throw httpError(400, 'Template key is required.');
  await assertUnique(app, title, key);
  const rows = await app.db.insert(documentTemplates).values({
    title,
    key,
    description: input.description?.trim() || null,
    contentMarkdown,
    createdBy: userId,
  }).returning();
  return toTemplate(rows[0]!);
}

export async function updateTemplate(app: FastifyInstance, id: string, input: UpdateTemplateRequest): Promise<DocumentTemplate> {
  const current = await findActiveById(app, id);
  if (!current) throw httpError(404, 'Template not found.');
  const title = input.title?.trim() ?? current.title;
  const contentMarkdown = input.contentMarkdown?.trim() ?? current.contentMarkdown;
  if (!title) throw httpError(400, 'Template title is required.');
  if (!contentMarkdown) throw httpError(400, 'Template content is required.');
  const key = input.key?.trim() || current.key;
  await assertUnique(app, title, key, id);
  const rows = await app.db.update(documentTemplates).set({
    title,
    key,
    description: input.description !== undefined ? (input.description?.trim() || null) : current.description,
    contentMarkdown,
    updatedAt: new Date(),
  }).where(eq(documentTemplates.id, id)).returning();
  return toTemplate(rows[0]!);
}

export async function deleteTemplate(app: FastifyInstance, id: string): Promise<void> {
  const current = await findActiveById(app, id);
  if (!current) throw httpError(404, 'Template not found.');
  if (current.isSystem) throw httpError(409, 'System templates cannot be deleted.');
  await app.db.update(documentTemplates).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(documentTemplates.id, id));
}
