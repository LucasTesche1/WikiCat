import { and, desc, eq, asc, isNull, sql, countDistinct } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  Tag,
  TagWithPageCount,
  AddTagRequest,
  PageTagStub,
  TaggedPage,
} from '@wikicat/shared';
import { tags, pageTags, pages, users, spaces } from '../../db/schema/index.js';
import { findPageById } from '../pages/pages.service.js';
import { findSpaceBySlug } from '../spaces/spaces.service.js';

export type TagRow = typeof tags.$inferSelect;
export type PageTagRow = typeof pageTags.$inferSelect;

const NAME_REGEX = /^[A-Za-z0-9À-ÖØ-öø-ÿ\s\-_]{2,64}$/;
const HEX_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const PALETTE_HSL = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

export function randomTagColor(seed?: string): string {
  if (!seed) {
    return (
      PALETTE_HSL[Math.floor(Math.random() * PALETTE_HSL.length)] ??
      PALETTE_HSL[0] ??
      '#6366f1'
    );
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE_HSL[h % PALETTE_HSL.length] ?? PALETTE_HSL[0] ?? '#6366f1';
}

export function normalizeTagName(name: string): { name: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!NAME_REGEX.test(trimmed)) {
    throw Object.assign(new Error(`Nome de tag inválido: use 2-64 caracteres, letras, números, espaço, - e _`), { statusCode: 400 });
  }
  return { name: trimmed };
}

export function validateColor(color: string | undefined): string | null {
  if (!color) return null;
  if (!HEX_REGEX.test(color)) {
    throw Object.assign(new Error('Cor inválida: use formato #RGB ou #RRGGBB'), { statusCode: 400 });
  }
  return color;
}

function tagRowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    color: row.color,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

export function tagRowToStub(row: TagRow): PageTagStub {
  return { id: row.id, name: row.name, color: row.color };
}

export async function findTagById(
  app: FastifyInstance,
  id: string,
  includeDeleted = false,
): Promise<TagRow | null> {
  const rows = await app.db
    .select()
    .from(tags)
    .where(includeDeleted ? eq(tags.id, id) : and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findTagByNameInSpace(
  app: FastifyInstance,
  spaceId: string,
  name: string,
  includeDeleted = false,
): Promise<TagRow | null> {
  const rows = await app.db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.spaceId, spaceId),
        sql`lower(${tags.name}) = lower(${name})`,
        includeDeleted ? sql`1=1` : isNull(tags.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listTagsForPage(
  app: FastifyInstance,
  pageId: string,
): Promise<PageTagStub[]> {
  const rows = await app.db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(pageTags)
    .innerJoin(tags, and(eq(tags.id, pageTags.tagId), isNull(tags.deletedAt)))
    .where(eq(pageTags.pageId, pageId))
    .orderBy(asc(tags.name));
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function listTagsForSpace(
  app: FastifyInstance,
  spaceId: string,
  nameFilter?: string | null,
): Promise<TagWithPageCount[]> {
  const q = app.db
    .select({
      id: tags.id,
      spaceId: tags.spaceId,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
      pageCount: countDistinct(pageTags.pageId),
    })
    .from(tags)
    .leftJoin(pageTags, eq(pageTags.tagId, tags.id))
    .where(
      and(
        eq(tags.spaceId, spaceId),
        isNull(tags.deletedAt),
        nameFilter ? sql`lower(${tags.name}) like lower(${`%${nameFilter}%`})` : sql`1=1`,
      ),
    )
    .groupBy(tags.id, tags.name, tags.color, tags.createdAt)
    .orderBy(desc(countDistinct(pageTags.pageId)), asc(tags.name));
  const rows = await q;
  return rows.map((r) => ({
    id: r.id,
    spaceId: r.spaceId,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt,
    pageCount: Number(r.pageCount ?? 0),
  }));
}

export async function getOrCreateTagInSpace(
  app: FastifyInstance,
  spaceId: string,
  body: AddTagRequest,
  currentUserId: string,
): Promise<TagRow> {
  const { name } = normalizeTagName(body.name);
  const color = validateColor(body.color) ?? randomTagColor(name);

  let tag = await findTagByNameInSpace(app, spaceId, name, true);
  if (tag) {
    if (tag.deletedAt) {
      const [updated] = await app.db
        .update(tags)
        .set({ deletedAt: null, color, updatedAt: new Date() })
        .where(eq(tags.id, tag.id))
        .returning();
      return updated as TagRow;
    }
    if (body.color && tag.color !== color) {
      const [updated] = await app.db
        .update(tags)
        .set({ color })
        .where(eq(tags.id, tag.id))
        .returning();
      return updated as TagRow;
    }
    return tag;
  }

  const [created] = await app.db
    .insert(tags)
    .values({
      spaceId,
      name,
      color,
      createdBy: currentUserId,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created as TagRow;

  const fallback = await findTagByNameInSpace(app, spaceId, name, false);
  if (!fallback) throw Object.assign(new Error('Falha ao criar tag'), { statusCode: 500 });
  return fallback;
}

export async function addTagToPage(
  app: FastifyInstance,
  pageId: string,
  tagId: string,
): Promise<void> {
  await app.db
    .insert(pageTags)
    .values({ pageId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromPageByName(
  app: FastifyInstance,
  pageId: string,
  tagName: string,
): Promise<void> {
  const page = await findPageById(app, pageId);
  if (!page) throw Object.assign(new Error('Página não encontrada'), { statusCode: 404 });

  const tag = await findTagByNameInSpace(app, page.spaceId, tagName);
  if (!tag) throw Object.assign(new Error('Tag não encontrada'), { statusCode: 404 });

  await app.db.delete(pageTags).where(and(eq(pageTags.pageId, pageId), eq(pageTags.tagId, tag.id)));

  const countRows = await app.db
    .select({ c: countDistinct(pageTags.pageId) })
    .from(pageTags)
    .where(eq(pageTags.tagId, tag.id));
  const cnt = Number(countRows[0]?.c ?? 0);
  if (cnt === 0) {
    await app.db.update(tags).set({ deletedAt: new Date() }).where(eq(tags.id, tag.id));
  }
}

export async function listPagesByTagInSpace(
  app: FastifyInstance,
  spaceSlug: string,
  tagName: string,
): Promise<TaggedPage[]> {
  const space = await findSpaceBySlug(app, spaceSlug);
  if (!space) throw Object.assign(new Error('Espaço não encontrado'), { statusCode: 404 });
  const tag = await findTagByNameInSpace(app, space.id, tagName);
  if (!tag) return [];

  const rows = await app.db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      parentPageId: pages.parentPageId,
      updatedAt: pages.updatedAt,
      updatedByName: users.name,
    })
    .from(pages)
    .innerJoin(pageTags, and(eq(pageTags.pageId, pages.id), eq(pageTags.tagId, tag.id)))
    .innerJoin(users, eq(users.id, pages.updatedBy))
    .where(and(eq(pages.spaceId, space.id), isNull(pages.deletedAt)))
    .orderBy(desc(pages.updatedAt));

  const ids = rows.map((r) => r.id);
  const tagRows = ids.length > 0
    ? await app.db
      .select({
        pageId: pageTags.pageId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(pageTags)
      .innerJoin(tags, and(eq(tags.id, pageTags.tagId), isNull(tags.deletedAt)))
      .where(sql`${pageTags.pageId} in ${ids.length > 0 ? ids : ['__none__']}`)
      .orderBy(asc(tags.name))
    : [];

  const byPage = new Map<string, PageTagStub[]>();
  for (const t of tagRows) {
    const arr = byPage.get(t.pageId) ?? [];
    arr.push({ id: t.id, name: t.name, color: t.color });
    byPage.set(t.pageId, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    parentPageId: r.parentPageId ?? null,
    updatedAt: r.updatedAt,
    updatedByName: r.updatedByName,
    tags: byPage.get(r.id) ?? [],
  }));
}

export { tagRowToTag };
