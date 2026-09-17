import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import type { CreateTemplateRequest, UpdateTemplateRequest } from '@wikicat/shared';
import { requireAuth, requireRole } from '../auth/guards.js';
import { sendError } from '../../lib/http-errors.js';
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from './templates.service.js';

const TemplateBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 160 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  contentMarkdown: Type.String({ minLength: 1 }),
  key: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});

const ErrorResp = Type.Object({ error: Type.String(), message: Type.String() });

export async function registerTemplates(app: FastifyInstance) {
  app.get('/templates', async () => listTemplates(app));

  app.post<{ Body: CreateTemplateRequest }>('/templates', {
    onRequest: [requireAuth(), requireRole(['admin'])],
    schema: { body: TemplateBody, response: { 400: ErrorResp, 409: ErrorResp } },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await createTemplate(app, request.currentUser!.id, request.body));
    } catch (err) {
      return sendError(reply, err, 'Failed to create template.');
    }
  });

  app.patch<{ Params: { id: string }; Body: UpdateTemplateRequest }>('/templates/:id', {
    onRequest: [requireAuth(), requireRole(['admin'])],
    schema: { params: Type.Object({ id: Type.String() }), body: Type.Partial(TemplateBody), response: { 400: ErrorResp, 404: ErrorResp, 409: ErrorResp } },
  }, async (request, reply) => {
    try {
      return await updateTemplate(app, request.params.id, request.body);
    } catch (err) {
      return sendError(reply, err, 'Failed to update template.');
    }
  });

  app.delete<{ Params: { id: string } }>('/templates/:id', {
    onRequest: [requireAuth(), requireRole(['admin'])],
    schema: { params: Type.Object({ id: Type.String() }), response: { 404: ErrorResp, 409: ErrorResp } },
  }, async (request, reply) => {
    try {
      await deleteTemplate(app, request.params.id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err, 'Failed to delete template.');
    }
  });
}
