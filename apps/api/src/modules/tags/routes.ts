import type { FastifyInstance } from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import type { AddTagRequest } from '@wikicat/shared';
import { requireAuth, requireRole } from '../auth/guards.js';
import { findPageById } from '../pages/pages.service.js';
import { findSpaceBySlug } from '../spaces/spaces.service.js';
import {
  addTagToPage,
  getOrCreateTagInSpace,
  listPagesByTagInSpace,
  listTagsForPage,
  listTagsForSpace,
  removeTagFromPageByName,
  tagRowToStub,
  tagRowToTag,
} from './tags.service.js';

const AddTagSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 64 }),
  color: Type.Optional(Type.String({ pattern: '^#(?:[0-9a-fA-F]{3}){1,2}$' })),
});
type AddTagSchema = Static<typeof AddTagSchema>;

const QueryTagSearch = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 64 })),
});

export async function registerTags(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/pages/:id/tags',
    { onRequest: requireAuth() },
    async (request, reply) => {
      const page = await findPageById(app, request.params.id);
      if (!page) return reply.code(404).send({ error: 'Not Found', message: 'Página não encontrada.' });
      const tags = await listTagsForPage(app, request.params.id);
      return reply.code(200).send(tags);
    },
  );

  app.post<{ Params: { id: string }; Body: AddTagSchema }>(
    '/pages/:id/tags',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: { body: AddTagSchema },
    },
    async (request, reply) => {
      const page = await findPageById(app, request.params.id);
      if (!page) return reply.code(404).send({ error: 'Not Found', message: 'Página não encontrada.' });
      const user = request.currentUser!;
      const body = request.body as AddTagRequest;
      const tag = await getOrCreateTagInSpace(app, page.spaceId, body, user.id);
      await addTagToPage(app, page.id, tag.id);
      return reply.code(201).send(tagRowToStub(tag));
    },
  );

  app.delete<{ Params: { id: string; tagName: string } }>(
    '/pages/:id/tags/:tagName',
    { onRequest: [requireAuth(), requireRole(['editor', 'admin'])] },
    async (request, reply) => {
      await removeTagFromPageByName(app, request.params.id, decodeURIComponent(request.params.tagName));
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { slug: string }; Querystring: Static<typeof QueryTagSearch> }>(
    '/spaces/:slug/tags',
    { onRequest: requireAuth(), schema: { querystring: QueryTagSearch } },
    async (request, reply) => {
      const space = await findSpaceBySlug(app, request.params.slug);
      if (!space) return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
      return reply.code(200).send(await listTagsForSpace(app, space.id, request.query.q ?? null));
    },
  );

  app.get<{ Params: { slug: string; tagName: string } }>(
    '/spaces/:slug/tags/:tagName/pages',
    { onRequest: requireAuth() },
    async (request, reply) => {
      const list = await listPagesByTagInSpace(
        app,
        request.params.slug,
        decodeURIComponent(request.params.tagName),
      );
      return reply.code(200).send(list);
    },
  );
}
