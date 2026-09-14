import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import type {
  CreatePageRequest,
  UpdatePageRequest,
  Page,
  PageWithRelations,
  PageTreeNode,
} from '@wikicat/shared';
import {
  createPage,
  updatePage,
  softDeletePage,
  buildPageTree,
  getPageWithRelations,
  findSpaceBySlug,
  findPageById,
} from './pages.service.js';
import { requireAuth, requireRole } from '../auth/guards.js';

const ErrorResp = Type.Object({ error: Type.String(), message: Type.String() });
const DateSchema = Type.Unsafe<Date>({ type: 'string', format: 'date-time' });
const NullableDate = Type.Union([DateSchema, Type.Null()]);

const PageNodeSchema: unknown = Type.Recursive((Self) =>
  Type.Object({
    id: Type.String(),
    title: Type.String(),
    slug: Type.String(),
    parentPageId: Type.Union([Type.String(), Type.Null()]),
    orderIndex: Type.Number(),
    children: Type.Array(Self),
  }),
);

const PageResponseSchema = Type.Object({
  id: Type.String(),
  spaceId: Type.String(),
  parentPageId: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  slug: Type.String(),
  contentMarkdown: Type.String(),
  draftMarkdown: Type.Union([Type.String(), Type.Null()]),
  isDraft: Type.Boolean(),
  orderIndex: Type.Number(),
  createdBy: Type.String(),
  updatedBy: Type.String(),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  deletedAt: NullableDate,
});

const PageWithRelationsSchema = Type.Intersect([
  PageResponseSchema,
  Type.Object({
    tags: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })),
    createdByUser: Type.Object({ id: Type.String(), name: Type.String() }),
    updatedByUser: Type.Object({ id: Type.String(), name: Type.String() }),
  }),
]);

export async function registerPages(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Reply: PageTreeNode[] | { error: string; message: string } }>(
    '/spaces/:slug/pages/tree',
    {
      onRequest: [requireAuth()],
      schema: {
        params: Type.Object({ slug: Type.String({ minLength: 2, maxLength: 120 }) }),
        response: {
          200: Type.Array(PageNodeSchema as never),
          404: ErrorResp,
        },
      },
    },
    async (request, reply) => {
      const space = await findSpaceBySlug(request.server, request.params.slug);
      if (!space) {
        return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
      }
      return buildPageTree(request.server, space.id);
    },
  );

  app.get<{ Params: { id: string }; Reply: PageWithRelations | { error: string; message: string } }>(
    '/pages/:id',
    {
      onRequest: [requireAuth()],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: {
          200: PageWithRelationsSchema,
          404: ErrorResp,
        },
      },
    },
    async (request, reply) => {
      const p = await getPageWithRelations(request.server, request.params.id);
      if (!p) {
        return reply.code(404).send({ error: 'Not Found', message: 'Página não encontrada.' });
      }
      return p;
    },
  );

  app.post<{
    Params: { slug: string };
    Body: CreatePageRequest;
    Reply: Page | { error: string; message: string };
  }>(
    '/spaces/:slug/pages',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: {
        params: Type.Object({ slug: Type.String({ minLength: 2, maxLength: 120 }) }),
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 255 }),
          parentPageId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          orderIndex: Type.Optional(Type.Integer()),
          contentMarkdown: Type.Optional(Type.String()),
        }),
        response: {
          201: PageResponseSchema,
          400: ErrorResp,
          404: ErrorResp,
        },
      },
    },
    async (request, reply) => {
      const space = await findSpaceBySlug(request.server, request.params.slug);
      if (!space) {
        return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
      }
      try {
        const created = await createPage(
          request.server,
          request.currentUser!.id,
          space.id,
          request.body,
        );
        return reply.code(201).send(created);
      } catch (err) {
        const code =
          (err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : undefined) ?? 500;
        const msg =
          (err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message)
            : undefined) ?? 'Erro ao criar página.';
        return reply
          .code(code >= 400 && code < 500 ? code : 500)
          .send({ error: code >= 500 ? 'Internal Server Error' : 'Bad Request', message: msg });
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: UpdatePageRequest;
    Reply: Page | { error: string; message: string };
  }>(
    '/pages/:id',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
          parentPageId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          orderIndex: Type.Optional(Type.Integer()),
          contentMarkdown: Type.Optional(Type.String()),
          draftMarkdown: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          isDraft: Type.Optional(Type.Boolean()),
        }),
        response: {
          200: PageResponseSchema,
          400: ErrorResp,
          404: ErrorResp,
        },
      },
    },
    async (request, reply) => {
      try {
        return await updatePage(request.server, request.currentUser!.id, request.params.id, request.body);
      } catch (err) {
        const code =
          (err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : undefined) ?? 500;
        const msg =
          (err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message)
            : undefined) ?? 'Erro ao atualizar página.';
        if (code === 404) {
          return reply.code(404).send({ error: 'Not Found', message: 'Página não encontrada.' });
        }
        return reply
          .code(code >= 400 && code < 500 ? code : 500)
          .send({ error: code >= 500 ? 'Internal Server Error' : 'Bad Request', message: msg });
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: null | { error: string; message: string } }>(
    '/pages/:id',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: {
          204: Type.Null(),
          404: ErrorResp,
        },
      },
    },
    async (request, reply) => {
      const exists = await findPageById(request.server, request.params.id);
      if (!exists) {
        return reply.code(404).send({ error: 'Not Found', message: 'Página não encontrada.' });
      }
      await softDeletePage(request.server, request.params.id);
      return reply.code(204).send(null);
    },
  );
}
