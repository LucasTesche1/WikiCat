import { eq, isNull, and, asc, desc, ne, max, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  CreatePageRequest,
  UpdatePageRequest,
  Page,
  PageWithRelations,
  PageTreeNode,
} from '@wikicat/shared';
import { pages, users, tags, pageTags, spaces, pageVersions } from '../../db/schema/index.js';
import { httpError } from '../../lib/http-errors.js';

export type PageRow = typeof pages.$inferSelect;

const PAGE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    spaceId: row.spaceId,
    parentPageId: row.parentPageId ?? null,
    title: row.title,
    slug: row.slug,
    contentMarkdown: row.contentMarkdown ?? '',
    draftMarkdown: row.draftMarkdown ?? null,
    isDraft: row.isDraft,
    orderIndex: row.orderIndex,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

function slugify(input: string): string {
  const cleaned = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > MAX_SLUG_LENGTH ? cleaned.slice(0, MAX_SLUG_LENGTH) : cleaned;
}

export async function findPageById(
  app: FastifyInstance,
  id: string,
  includeDeleted = false,
): Promise<PageRow | null> {
  const rows = await app.db
    .select()
    .from(pages)
    .where(includeDeleted ? eq(pages.id, id) : and(eq(pages.id, id), isNull(pages.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPageBySlugInSpace(
  app: FastifyInstance,
  spaceId: string,
  slug: string,
  excludeId?: string,
): Promise<PageRow | null> {
  const rows = await app.db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.spaceId, spaceId),
        eq(pages.slug, slug),
        isNull(pages.deletedAt),
        excludeId ? ne(pages.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function generateUniqueSlug(
  app: FastifyInstance,
  spaceId: string,
  baseTitle: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = slugify(baseTitle);
  if (!baseSlug) {
    throw httpError(400, 'Could not generate a slug from the title.');
  }
  let candidate = baseSlug;
  let counter = 2;
  while (true) {
    const existing = await findPageBySlugInSpace(app, spaceId, candidate, excludeId);
    if (!existing) return candidate;
    const suffix = `-${counter}`;
    candidate =
      baseSlug.length + suffix.length > MAX_SLUG_LENGTH
        ? baseSlug.slice(0, MAX_SLUG_LENGTH - suffix.length) + suffix
        : baseSlug + suffix;
    counter++;
    if (counter > 999) {
      throw httpError(400, 'Could not generate a unique slug. Try another title.');
    }
  }
}

export async function validateNoCycle(
  app: FastifyInstance,
  pageId: string,
  newParentId: string | null,
): Promise<void> {
  if (newParentId == null) return;
  if (newParentId === pageId) {
    throw httpError(400, 'Cycle detected: the page cannot be its own child.');
  }
  let currentId: string | null = newParentId;
  const visited = new Set<string>();
  while (currentId != null) {
    if (visited.has(currentId)) {
      throw httpError(400, 'Cycle detected: invalid hierarchy.');
    }
    visited.add(currentId);
    if (currentId === pageId) {
      throw httpError(400, 'Cycle detected: the page cannot be moved under one of its descendants.');
    }
    const row = await findPageById(app, currentId);
    if (!row) {
      throw httpError(400, 'Parent page not found.');
    }
    currentId = row.parentPageId ?? null;
  }
}

export async function getMaxSiblingOrder(
  app: FastifyInstance,
  spaceId: string,
  parentPageId: string | null,
): Promise<number> {
  const rows = await app.db
    .select({ maxOrder: max(pages.orderIndex) })
    .from(pages)
    .where(
      and(
        eq(pages.spaceId, spaceId),
        parentPageId == null ? isNull(pages.parentPageId) : eq(pages.parentPageId, parentPageId),
        isNull(pages.deletedAt),
      ),
    );
  const val = rows[0]?.maxOrder;
  return typeof val === 'number' ? val : -1;
}

export async function buildPageTree(
  app: FastifyInstance,
  spaceId: string,
): Promise<PageTreeNode[]> {
  const flat = await app.db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      parentPageId: pages.parentPageId,
      orderIndex: pages.orderIndex,
    })
    .from(pages)
    .where(and(eq(pages.spaceId, spaceId), isNull(pages.deletedAt)))
    .orderBy(
      sql`COALESCE(parent_page_id, '00000000-0000-0000-0000-000000000000')` as unknown as typeof pages.orderIndex,
      asc(pages.orderIndex),
      asc(pages.title),
    );
  return buildTreeFromFlatList(flat as PageTreeNode[]);
}

export function buildTreeFromFlatList(flat: Array<Omit<PageTreeNode, 'children'>>): PageTreeNode[] {
  const byId = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];
  for (const item of flat) {
    byId.set(item.id, { ...item, children: [] });
  }
  for (const item of flat) {
    const node = byId.get(item.id)!;
    if (item.parentPageId != null && byId.has(item.parentPageId)) {
      byId.get(item.parentPageId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sortRecursive(nodes: PageTreeNode[]): PageTreeNode[] {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));
    for (const n of nodes) sortRecursive(n.children);
    return nodes;
  }
  return sortRecursive(roots);
}

export async function getPageWithRelations(
  app: FastifyInstance,
  id: string,
): Promise<PageWithRelations | null> {
  const page = await findPageById(app, id);
  if (!page) return null;
  const [creatorRows, updaterRows, tagRows] = await Promise.all([
    app.db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, page.createdBy)).limit(1),
    app.db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, page.updatedBy)).limit(1),
    app.db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .innerJoin(pageTags, and(eq(pageTags.tagId, tags.id), isNull(tags.deletedAt)))
      .where(eq(pageTags.pageId, id))
      .orderBy(asc(tags.name)),
  ]);
  const p = toPage(page);
  return {
    ...p,
    tags: tagRows.map((r) => ({ id: r.id, name: r.name, color: r.color })),
    createdByUser: creatorRows[0] ?? { id: p.createdBy, name: 'Removed user' },
    updatedByUser: updaterRows[0] ?? { id: p.updatedBy, name: 'Removed user' },
  };
}

export async function findSpaceBySlug(
  app: FastifyInstance,
  slug: string,
): Promise<(typeof spaces.$inferSelect) | null> {
  const rows = await app.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.slug, slug), isNull(spaces.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPage(
  app: FastifyInstance,
  actorUserId: string,
  spaceId: string,
  input: CreatePageRequest,
): Promise<Page> {
  const slug = await generateUniqueSlug(app, spaceId, input.title);
  if (input.parentPageId != null) {
    const parent = await findPageById(app, input.parentPageId);
    if (!parent || parent.spaceId !== spaceId) {
      throw httpError(400, 'Parent page does not exist or belongs to another space.');
    }
  }
  let orderIndex = input.orderIndex;
  if (orderIndex == null || Number.isNaN(orderIndex)) {
    orderIndex = (await getMaxSiblingOrder(app, spaceId, input.parentPageId ?? null)) + 1;
  }
  const rows = await app.db
    .insert(pages)
    .values({
      spaceId,
      parentPageId: input.parentPageId ?? null,
      title: input.title.trim(),
      slug,
      contentMarkdown: input.contentMarkdown ?? '',
      draftMarkdown: null,
      isDraft: false,
      orderIndex,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .returning();
  return toPage(rows[0]!);
}

export async function updatePage(
  app: FastifyInstance,
  actorUserId: string,
  id: string,
  input: UpdatePageRequest,
): Promise<Page> {
  return app.db.transaction(async tx => {
    const [current] = await tx.select().from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).for('update');
    if (!current) throw httpError(404, 'Page not found.');
    if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      throw httpError(409, 'This page was changed by another session. Copy your draft and reload to compare before saving.');
    }
    const scoped = Object.create(app) as FastifyInstance;
    scoped.db = tx as unknown as FastifyInstance['db'];
    if (input.contentMarkdown !== undefined && input.isDraft === false) {
      const [last] = await tx.select().from(pageVersions).where(eq(pageVersions.pageId, id)).orderBy(desc(pageVersions.versionNumber)).limit(1);
      let version = last?.versionNumber ?? 0;
      if (!last) await tx.insert(pageVersions).values({ pageId: id, versionNumber: ++version, snapshotMarkdown: current.contentMarkdown, authorId: current.updatedBy });
      await tx.insert(pageVersions).values({ pageId: id, versionNumber: ++version, snapshotMarkdown: input.contentMarkdown, authorId: actorUserId });
    }
    return updatePageUnlocked(scoped, actorUserId, id, input);
  });
}

async function updatePageUnlocked(
  app: FastifyInstance,
  actorUserId: string,
  id: string,
  input: UpdatePageRequest,
): Promise<Page> {
  const current = await findPageById(app, id);
  if (!current) {
    throw httpError(404, 'Page not found.');
  }
  const newParentId = input.parentPageId !== undefined ? input.parentPageId : current.parentPageId;
  if (newParentId !== current.parentPageId) {
    await validateNoCycle(app, id, newParentId ?? null);
    if (newParentId != null) {
      const parent = await findPageById(app, newParentId);
      if (!parent || parent.spaceId !== current.spaceId) {
        throw httpError(400, 'Parent page does not exist or belongs to another space.');
      }
    }
  }
  const newTitle = input.title != null ? input.title.trim() : current.title;
  const newSlug =
    input.title != null && input.title.trim() !== current.title
      ? await generateUniqueSlug(app, current.spaceId, newTitle, id)
      : current.slug;
  let newOrderIndex = current.orderIndex;
  if (input.orderIndex != null && !Number.isNaN(input.orderIndex)) {
    newOrderIndex = input.orderIndex;
  } else if (newParentId !== current.parentPageId) {
    newOrderIndex = (await getMaxSiblingOrder(app, current.spaceId, newParentId ?? null)) + 1;
  }
  const updated = await app.db
    .update(pages)
    .set({
      title: newTitle,
      slug: newSlug,
      parentPageId: newParentId ?? null,
      orderIndex: newOrderIndex,
      contentMarkdown: input.contentMarkdown !== undefined ? input.contentMarkdown : current.contentMarkdown,
      draftMarkdown: input.draftMarkdown !== undefined ? input.draftMarkdown : current.draftMarkdown,
      isDraft: input.isDraft !== undefined ? input.isDraft : current.isDraft,
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id))
    .returning();
  return toPage(updated[0]!);
}

export async function softDeletePage(app: FastifyInstance, id: string): Promise<void> {
  const now = new Date();
  async function deleteSubtree(rootId: string) {
    const children = await app.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.parentPageId, rootId), isNull(pages.deletedAt)));
    for (const c of children) await deleteSubtree(c.id);
    await app.db.update(pages).set({ deletedAt: now, updatedAt: now }).where(eq(pages.id, rootId));
  }
  await deleteSubtree(id);
}
