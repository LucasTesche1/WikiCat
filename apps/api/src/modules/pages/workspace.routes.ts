import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { and, desc, eq } from 'drizzle-orm';
import { parseDocument, type WorkspaceSearchItem } from '@wikicat/shared';
import { pageVersions, users } from '../../db/schema/index.js';
import { requireAuth, requireRole } from '../auth/guards.js';
import { findPageById, updatePage } from './pages.service.js';

export async function registerWorkspace(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string; spaceSlug?: string } }>('/search', {
    onRequest: requireAuth(), schema: { querystring: Type.Object({
      q: Type.Optional(Type.String({ maxLength: 200 })), spaceSlug: Type.Optional(Type.String({ maxLength: 120 })),
    }) },
  }, async request => {
    const start = Date.now();
    const query = request.query.q?.trim() ?? '';
    const scope = request.query.spaceSlug ?? '';
    const rows = await app.sql<{
      pageId: string; title: string; spaceSlug: string; spaceName: string;
      content: string; updatedAt: Date; updatedByName: string;
    }[]>`
      SELECT p.id AS "pageId", p.title, s.slug AS "spaceSlug", s.name AS "spaceName",
        p.content_markdown AS content, p.updated_at AS "updatedAt", u.name AS "updatedByName"
      FROM pages p JOIN spaces s ON s.id = p.space_id JOIN users u ON u.id = p.updated_by
      WHERE p.deleted_at IS NULL AND s.deleted_at IS NULL
        AND (${scope} = '' OR s.slug = ${scope})
        AND (${query} = '' OR p.fts_vector @@ websearch_to_tsquery('simple', ${query})
          OR strpos(lower(p.title), lower(${query})) > 0)
      ORDER BY CASE WHEN ${query} = '' THEN 0 ELSE ts_rank(p.fts_vector, websearch_to_tsquery('simple', ${query})) END DESC,
        p.updated_at DESC LIMIT 31
    `;
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const results: WorkspaceSearchItem[] = rows.slice(0, 30).map(row => {
      const headings = parseDocument(row.content).headings;
      const matchOffset = terms.length ? Math.max(0, row.content.toLocaleLowerCase().indexOf(terms[0]!)) : 0;
      const heading = [...headings].reverse().find(h => h.offset <= matchOffset);
      const titleHeading = headings.find(h => terms.length && terms.every(t => h.text.toLocaleLowerCase().includes(t)));
      const target = titleHeading ?? heading;
      const offset = titleHeading?.offset ?? matchOffset;
      return { pageId: row.pageId, title: row.title, spaceSlug: row.spaceSlug, spaceName: row.spaceName,
        updatedAt: row.updatedAt.toISOString(), updatedByName: row.updatedByName,
        snippet: row.content.slice(Math.max(0, offset - 40), offset + 200).replace(/\s+/g, ' '),
        anchor: target?.id, sectionTitle: target?.text };
    });
    return { results, tookMs: Date.now() - start, hasMore: rows.length > 30 };
  });
  app.get<{ Params: { id: string } }>('/pages/:id/versions', {
    onRequest: requireAuth(), schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) },
  }, async (request, reply) => {
    if (!await findPageById(app, request.params.id)) return reply.code(404).send({ message: 'Página não encontrada.' });
    const rows = await app.db.select({ id: pageVersions.id, versionNumber: pageVersions.versionNumber,
      snapshotMarkdown: pageVersions.snapshotMarkdown, authorName: users.name, createdAt: pageVersions.createdAt,
    }).from(pageVersions).innerJoin(users, eq(users.id, pageVersions.authorId))
      .where(eq(pageVersions.pageId, request.params.id)).orderBy(desc(pageVersions.versionNumber)).limit(50);
    return rows;
  });
  app.post<{ Params: { id: string }; Body: { versionId: string; expectedUpdatedAt: string } }>('/pages/:id/restore', {
    onRequest: [requireAuth(), requireRole(['admin', 'editor'])], schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }), body: Type.Object({
        versionId: Type.String({ format: 'uuid' }), expectedUpdatedAt: Type.String({ format: 'date-time' }),
      }),
    },
  }, async (request, reply) => {
    const [version] = await app.db.select().from(pageVersions).where(and(eq(pageVersions.id, request.body.versionId), eq(pageVersions.pageId, request.params.id)));
    if (!version) return reply.code(404).send({ message: 'Versão não encontrada.' });
    return updatePage(app, request.currentUser!.id, request.params.id, {
      contentMarkdown: version.snapshotMarkdown, draftMarkdown: version.snapshotMarkdown,
      isDraft: false, expectedUpdatedAt: request.body.expectedUpdatedAt,
    });
  });
}
