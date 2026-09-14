import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import type {
  CreateSpaceRequest,
  UpdateSpaceRequest,
  Space as SpaceType,
  SpaceSummary,
} from '@wikicat/shared';
import {
  createSpace,
  findSpaceBySlug,
  findSpaceById,
  listSpaces,
  softDeleteSpace,
  updateSpace,
  isValidSlug,
  isValidHexColor,
} from './spaces.service.js';
import { requireAuth, requireRole } from '../auth/guards.js';

export async function registerSpaces(app: FastifyInstance) {
  app.get<{ Reply: SpaceSummary[] }>(
    '/spaces',
    {
      onRequest: [requireAuth()],
      schema: {
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              name: Type.String(),
              slug: Type.String(),
              description: Type.Union([Type.String(), Type.Null()]),
              color: Type.String(),
              icon: Type.Union([Type.String(), Type.Null()]),
              createdBy: Type.String(),
              createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
              updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
              deletedAt: Type.Union([Type.Unsafe<Date>({ type: 'string', format: 'date-time' }), Type.Null()]),
              pageCount: Type.Number(),
            }),
          ),
        },
      },
    },
    async (request): Promise<SpaceSummary[]> => {
      return listSpaces(request.server);
    },
  );

  app.get<{ Params: { slug: string }; Reply: SpaceType | { error: string; message: string } }>(
    '/spaces/:slug',
    {
      onRequest: [requireAuth()],
      schema: {
        params: Type.Object({
          slug: Type.String({ minLength: 2, maxLength: 120 }),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            name: Type.String(),
            slug: Type.String(),
            description: Type.Union([Type.String(), Type.Null()]),
            color: Type.String(),
            icon: Type.Union([Type.String(), Type.Null()]),
            createdBy: Type.String(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            deletedAt: Type.Union([Type.Unsafe<Date>({ type: 'string', format: 'date-time' }), Type.Null()]),
          }),
          404: Type.Object({ error: Type.String(), message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const row = await findSpaceBySlug(request.server, request.params.slug);
      if (!row) {
        return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
      }
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
    },
  );

  app.post<{ Body: CreateSpaceRequest; Reply: SpaceType | { error: string; message: string } }>(
    '/spaces',
    {
      onRequest: [requireAuth(), requireRole(['admin'])],
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 3, maxLength: 50 }),
          slug: Type.String({ minLength: 2, maxLength: 120 }),
          description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
          color: Type.Optional(Type.String({ minLength: 7, maxLength: 7 })),
          icon: Type.Optional(Type.Union([Type.String({ maxLength: 32 }), Type.Null()])),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            name: Type.String(),
            slug: Type.String(),
            description: Type.Union([Type.String(), Type.Null()]),
            color: Type.String(),
            icon: Type.Union([Type.String(), Type.Null()]),
            createdBy: Type.String(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            deletedAt: Type.Union([Type.Unsafe<Date>({ type: 'string', format: 'date-time' }), Type.Null()]),
          }),
          400: Type.Object({ error: Type.String(), message: Type.String() }),
          409: Type.Object({ error: Type.String(), message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      if (!isValidSlug(body.slug)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Slug inválido: letras minúsculas, números e hífens (ex: meu-espaco-123). Palavras reservadas não são permitidas.',
        });
      }
      if (body.color != null && !isValidHexColor(body.color)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Cor inválida: use formato hex #RRGGBB.',
        });
      }
      try {
        const created = await createSpace(request.server, request.currentUser!.id, body);
        return reply.code(201).send(created);
      } catch (err) {
        const code = (err && typeof err === 'object' && 'statusCode' in err ? Number((err as { statusCode?: unknown }).statusCode) : undefined) ?? 500;
        const msg = (err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message) : undefined) ?? 'Erro ao criar espaço.';
        if (code === 409) {
          return reply.code(409).send({ error: 'Conflict', message: 'Já existe espaço com este slug.' });
        }
        return reply.code(code >= 400 && code < 500 ? code : 500).send({ error: code >= 500 ? 'Internal Server Error' : 'Bad Request', message: msg });
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: UpdateSpaceRequest;
    Reply: SpaceType | { error: string; message: string };
  }>(
    '/spaces/:id',
    {
      onRequest: [requireAuth(), requireRole(['admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 3, maxLength: 50 })),
          slug: Type.Optional(Type.String({ minLength: 2, maxLength: 120 })),
          description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
          color: Type.Optional(Type.String({ minLength: 7, maxLength: 7 })),
          icon: Type.Optional(Type.Union([Type.String({ maxLength: 32 }), Type.Null()])),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            name: Type.String(),
            slug: Type.String(),
            description: Type.Union([Type.String(), Type.Null()]),
            color: Type.String(),
            icon: Type.Union([Type.String(), Type.Null()]),
            createdBy: Type.String(),
            createdAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            updatedAt: Type.Unsafe<Date>({ type: 'string', format: 'date-time' }),
            deletedAt: Type.Union([Type.Unsafe<Date>({ type: 'string', format: 'date-time' }), Type.Null()]),
          }),
          400: Type.Object({ error: Type.String(), message: Type.String() }),
          404: Type.Object({ error: Type.String(), message: Type.String() }),
          409: Type.Object({ error: Type.String(), message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      if (body.slug != null && !isValidSlug(body.slug)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Slug inválido: letras minúsculas, números e hífens. Palavras reservadas não são permitidas.',
        });
      }
      if (body.color != null && !isValidHexColor(body.color)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Cor inválida: use formato hex #RRGGBB.',
        });
      }
      try {
        const updated = await updateSpace(request.server, request.params.id, body);
        return updated;
      } catch (err) {
        const code = (err && typeof err === 'object' && 'statusCode' in err ? Number((err as { statusCode?: unknown }).statusCode) : undefined) ?? 500;
        const msg = (err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message) : undefined) ?? 'Erro ao atualizar espaço.';
        if (code === 404) {
          return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
        }
        if (code === 409) {
          return reply.code(409).send({ error: 'Conflict', message: 'Já existe espaço com este slug.' });
        }
        return reply.code(code >= 400 && code < 500 ? code : 500).send({ error: code >= 500 ? 'Internal Server Error' : 'Bad Request', message: msg });
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: null | { error: string; message: string } }>(
    '/spaces/:id',
    {
      onRequest: [requireAuth(), requireRole(['admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: {
          204: Type.Null(),
          404: Type.Object({ error: Type.String(), message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const exists = await findSpaceById(request.server, request.params.id);
      if (!exists) {
        return reply.code(404).send({ error: 'Not Found', message: 'Espaço não encontrado.' });
      }
      await softDeleteSpace(request.server, request.params.id);
      return reply.code(204).send(null);
    },
  );
}
