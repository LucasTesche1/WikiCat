import { eq, isNull, and, count, desc, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { CreateSpaceRequest, UpdateSpaceRequest, SpaceSummary, Space } from '@wikicat/shared';
import { spaces, pages } from '../../db/schema/index.js';

export type SpaceRow = typeof spaces.$inferSelect;

export const RESERVED_SLUGS = new Set([
  'admin',
  'settings',
  'api',
  'login',
  'logout',
  'search',
  'tag',
  'tags',
  'profile',
  'dashboard',
  'home',
]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function isValidSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 120) return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

function toSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    color: row.color,
    icon: row.icon ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

export async function findSpaceById(
  app: FastifyInstance,
  id: string,
  includeDeleted = false,
): Promise<SpaceRow | null> {
  const rows = await app.db
    .select()
    .from(spaces)
    .where(includeDeleted ? eq(spaces.id, id) : and(eq(spaces.id, id), isNull(spaces.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findSpaceBySlug(
  app: FastifyInstance,
  slug: string,
): Promise<SpaceRow | null> {
  const rows = await app.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.slug, slug), isNull(spaces.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findSpaceBySlugExcludingId(
  app: FastifyInstance,
  slug: string,
  excludeId: string,
): Promise<SpaceRow | null> {
  const rows = await app.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.slug, slug), isNull(spaces.deletedAt), ne(spaces.id, excludeId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSpaces(app: FastifyInstance): Promise<SpaceSummary[]> {
  const rows = await app.db
    .select({
      space: spaces,
      pageCount: count(pages.id),
    })
    .from(spaces)
    .leftJoin(pages, and(eq(pages.spaceId, spaces.id), isNull(pages.deletedAt)))
    .where(isNull(spaces.deletedAt))
    .groupBy(spaces.id)
    .orderBy(desc(spaces.createdAt));
  return rows.map((r) => {
    const s = toSpace(r.space);
    return { ...s, pageCount: Number(r.pageCount ?? 0) };
  });
}

export async function createSpace(
  app: FastifyInstance,
  createdBy: string,
  input: CreateSpaceRequest,
): Promise<Space> {
  const existing = await findSpaceBySlug(app, input.slug);
  if (existing) {
    const err: Error & { statusCode?: number; conflict?: boolean } = new Error('slug already exists');
    err.statusCode = 409;
    err.conflict = true;
    throw err;
  }
  const rows = await app.db
    .insert(spaces)
    .values({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description?.trim() ?? null,
      color: input.color?.trim() ?? '#6366f1',
      icon: input.icon?.trim() ?? null,
      createdBy,
    })
    .returning();
  return toSpace(rows[0]!);
}

export async function updateSpace(
  app: FastifyInstance,
  id: string,
  input: UpdateSpaceRequest,
): Promise<Space> {
  const current = await findSpaceById(app, id);
  if (!current) {
    const err: Error & { statusCode?: number } = new Error('space not found');
    err.statusCode = 404;
    throw err;
  }
  if (input.slug != null && input.slug !== current.slug) {
    const rows = await app.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, input.slug), isNull(spaces.deletedAt)))
      .limit(1);
    if (rows.length > 0 && rows[0]!.id !== id) {
      const err: Error & { statusCode?: number } = new Error('slug already in use');
      err.statusCode = 409;
      throw err;
    }
  }
  const updatedRows = await app.db
    .update(spaces)
    .set({
      name: input.name != null ? input.name.trim() : current.name,
      slug: input.slug != null ? input.slug.trim().toLowerCase() : current.slug,
      description: input.description !== undefined ? (input.description?.trim() ?? null) : current.description,
      color: input.color != null ? input.color.trim() : current.color,
      icon: input.icon !== undefined ? (input.icon?.trim() ?? null) : current.icon,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, id))
    .returning();
  return toSpace(updatedRows[0]!);
}

export async function softDeleteSpace(app: FastifyInstance, id: string): Promise<void> {
  const now = new Date();
  await app.db
    .update(pages)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(pages.spaceId, id), isNull(pages.deletedAt)));
  await app.db
    .update(spaces)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(spaces.id, id));
}
