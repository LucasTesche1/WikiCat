import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { and, desc, eq } from 'drizzle-orm';
import { parseDocument, type WorkspaceSearchItem } from '@wikicat/shared';
import { pageVersions, users } from '../../db/schema/index.js';
import { requireAuth, requireRole } from '../auth/guards.js';
import { findPageById, updatePage } from './pages.service.js';

function searchTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/i)
        .map(term => term.trim())
        .filter(term => term.length >= 2),
    ),
  ).slice(0, 8);
}

function readableDocumentText(markdown: string): string {
  return markdown
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-z0-9-]*|```/gi, ' '))
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#*_`>|~\-[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestSnippet(content: string, query: string, terms: string[]): { snippet: string; offset: number } {
  const compact = readableDocumentText(content);
  if (!terms.length) return { snippet: compact.slice(0, 260), offset: 0 };
  const lower = compact.toLocaleLowerCase();
  const raw = query.toLocaleLowerCase();
  const candidates = [raw, ...terms].filter(Boolean);
  let offset = -1;
  for (const term of candidates) {
    offset = lower.indexOf(term);
    if (offset >= 0) break;
  }
  if (offset < 0) return { snippet: compact.slice(0, 260), offset: 0 };
  const start = Math.max(0, offset - 80);
  const snippet = compact.slice(start, offset + 260).replace(/\s+/g, ' ').trim();
  return { snippet: `${start > 0 ? '… ' : ''}${snippet}${offset + 260 < content.length ? ' …' : ''}`, offset };
}

function rawMatchOffset(content: string, query: string, terms: string[]): number {
  if (!terms.length) return 0;
  const lower = content.toLocaleLowerCase();
  for (const term of [query.toLocaleLowerCase(), ...terms].filter(Boolean)) {
    const offset = lower.indexOf(term);
    if (offset >= 0) return offset;
  }
  return 0;
}

export async function registerWorkspace(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string; spaceSlug?: string } }>('/search', {
    schema: { querystring: Type.Object({
      q: Type.Optional(Type.String({ maxLength: 200 })), spaceSlug: Type.Optional(Type.String({ maxLength: 120 })),
    }) },
  }, async request => {
    const start = Date.now();
    const query = request.query.q?.trim() ?? '';
    const scope = request.query.spaceSlug ?? '';
    const normalized = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const slugQuery = normalized.replace(/\s+/g, '-');
    const rows = await app.sql<{
      pageId: string; title: string; spaceSlug: string; spaceName: string;
      slug: string; content: string; updatedAt: Date; updatedByName: string; score: number;
    }[]>`
      WITH input AS (
        SELECT
          ${query}::text AS raw,
          lower(${query})::text AS raw_lower,
          ${normalized}::text AS normalized,
          ${slugQuery}::text AS slug_query,
          CASE WHEN ${query} = '' THEN NULL ELSE websearch_to_tsquery('simple', ${query}) END AS tsq
      ),
      terms AS (
        SELECT term
        FROM input, regexp_split_to_table(input.normalized, '\\s+') AS term
        WHERE length(term) >= 2
        LIMIT 8
      ),
      scored AS (
        SELECT
          p.id AS "pageId",
          p.title,
          p.slug,
          s.slug AS "spaceSlug",
          s.name AS "spaceName",
          p.content_markdown AS content,
          p.updated_at AS "updatedAt",
          u.name AS "updatedByName",
          (
            CASE WHEN input.raw = '' THEN 0 ELSE
              CASE WHEN lower(p.title) = input.raw_lower THEN 120 ELSE 0 END +
              CASE WHEN p.slug = input.slug_query THEN 110 ELSE 0 END +
              CASE WHEN lower(p.title) LIKE input.raw_lower || '%' THEN 90 ELSE 0 END +
              CASE WHEN p.slug LIKE input.slug_query || '%' THEN 82 ELSE 0 END +
              CASE WHEN lower(p.title) LIKE '%' || input.raw_lower || '%' THEN 68 ELSE 0 END +
              CASE WHEN p.slug LIKE '%' || input.slug_query || '%' THEN 58 ELSE 0 END +
              CASE WHEN lower(COALESCE(p.tag_names_denorm, '')) LIKE '%' || input.raw_lower || '%' THEN 44 ELSE 0 END +
              CASE WHEN lower(p.content_markdown) LIKE '%' || input.raw_lower || '%' THEN 30 ELSE 0 END +
              COALESCE(ts_rank_cd(p.fts_vector, input.tsq), 0) * 36 +
              GREATEST(similarity(lower(p.title), input.raw_lower), similarity(p.slug, input.slug_query)) * 28 +
              (
                SELECT COALESCE(SUM(
                  CASE WHEN lower(p.title) LIKE '%' || term || '%' THEN 10 ELSE 0 END +
                  CASE WHEN p.slug LIKE '%' || replace(term, ' ', '-') || '%' THEN 9 ELSE 0 END +
                  CASE WHEN lower(COALESCE(p.tag_names_denorm, '')) LIKE '%' || term || '%' THEN 8 ELSE 0 END +
                  CASE WHEN lower(p.content_markdown) LIKE '%' || term || '%' THEN 3 ELSE 0 END
                ), 0)
                FROM terms
              )
            END
          )::float AS score
        FROM pages p
        JOIN spaces s ON s.id = p.space_id
        JOIN users u ON u.id = p.updated_by
        CROSS JOIN input
        WHERE p.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND (${scope} = '' OR s.slug = ${scope})
          AND (
            input.raw = ''
            OR p.fts_vector @@ input.tsq
            OR lower(p.title) LIKE '%' || input.raw_lower || '%'
            OR p.slug LIKE '%' || input.slug_query || '%'
            OR lower(COALESCE(p.tag_names_denorm, '')) LIKE '%' || input.raw_lower || '%'
            OR lower(p.content_markdown) LIKE '%' || input.raw_lower || '%'
            OR EXISTS (
              SELECT 1 FROM terms
              WHERE lower(p.title) LIKE '%' || term || '%'
                 OR p.slug LIKE '%' || term || '%'
                 OR lower(COALESCE(p.tag_names_denorm, '')) LIKE '%' || term || '%'
                 OR lower(p.content_markdown) LIKE '%' || term || '%'
            )
          )
      )
      SELECT *
      FROM scored
      ORDER BY
        CASE WHEN ${query} = '' THEN 0 ELSE score END DESC,
        "updatedAt" DESC
      LIMIT 31
    `;
    const terms = searchTerms(query);
    const results: WorkspaceSearchItem[] = rows.slice(0, 30).map(row => {
      const headings = parseDocument(row.content).headings;
      const { snippet } = bestSnippet(row.content, query, terms);
      const matchOffset = rawMatchOffset(row.content, query, terms);
      const heading = [...headings].reverse().find(h => h.offset <= matchOffset);
      const titleHeading = headings.find(h => terms.length && terms.every(t => h.text.toLocaleLowerCase().includes(t)));
      const target = titleHeading ?? heading;
      return { pageId: row.pageId, title: row.title, spaceSlug: row.spaceSlug, spaceName: row.spaceName,
        updatedAt: new Date(row.updatedAt).toISOString(), updatedByName: row.updatedByName,
        snippet: query
          ? snippet || `${row.title} · ${row.slug}`
          : readableDocumentText(row.content).slice(0, 220) || `${row.title} · ${row.slug}`,
        anchor: target?.id, sectionTitle: target?.text };
    });
    return { results, tookMs: Date.now() - start, hasMore: rows.length > 30 };
  });
  app.get<{ Params: { id: string } }>('/pages/:id/versions', {
    onRequest: requireAuth(), schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) },
  }, async (request, reply) => {
    if (!await findPageById(app, request.params.id)) return reply.code(404).send({ message: 'Page not found.' });
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
    if (!version) return reply.code(404).send({ message: 'Version not found.' });
    return updatePage(app, request.currentUser!.id, request.params.id, {
      contentMarkdown: version.snapshotMarkdown, draftMarkdown: version.snapshotMarkdown,
      isDraft: false, expectedUpdatedAt: request.body.expectedUpdatedAt,
    });
  });
}
