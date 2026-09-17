import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import type { Attachment } from '@wikicat/shared';
import { createReadStream } from 'node:fs';
import {
  uploadAttachment,
  findAttachmentById,
  listAttachmentsForPage,
  assertValidContentLength,
  resolveFullFilesystemPath,
  assertPathTierCoherence,
  type Tier,
} from './attachments.service.js';
import { requireAuth, requireRole } from '../auth/guards.js';
import { sendError } from '../../lib/http-errors.js';

const DateSchema = Type.Unsafe<Date>({ type: 'string', format: 'date-time' });
const ErrorResp = Type.Object({ error: Type.String(), message: Type.String() });

const AttachmentResp = Type.Object({
  id: Type.String(),
  pageId: Type.String(),
  fileName: Type.String(),
  originalName: Type.String(),
  mimeType: Type.String(),
  sizeBytes: Type.Number(),
  storagePath: Type.String(),
  storageTier: Type.Union([Type.Literal('standard'), Type.Literal('large')]),
  uploadedBy: Type.String(),
  createdAt: DateSchema,
});

export async function registerAttachments(app: FastifyInstance) {
  async function handleUpload(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    tier: Tier,
  ) {
    try {
      assertValidContentLength(app, req, tier);
    } catch (err) {
      return sendError(reply, err, 'Size validation error.');
    }

    const pageId = req.params.id;
    const actorId = req.currentUser!.id;
    const parts = req.parts();

    try {
      for await (const part of parts) {
        if (part.type !== 'file') continue;

        try {
          const created = await uploadAttachment(
            app,
            pageId,
            actorId,
            tier,
            part.file as unknown as NodeJS.ReadableStream,
            part.filename,
            part.mimetype || 'application/octet-stream',
            Number(req.headers['content-length'] ?? 0),
          );
          return reply.code(201).send(created);
        } catch (err) {
          return sendError(reply, err, 'Failed to save attachment.');
        }
      }

      return reply.code(400).send({ error: 'Bad Request', message: 'No file received in multipart/form-data field "file".' });
    } catch (err) {
      req.server.log.warn({ err }, 'Multipart upload failed');
      return reply.code(500).send({ error: 'Internal Server Error', message: 'An unexpected error occurred.' });
    }
  }

  app.post<{ Params: { id: string }; Reply: Attachment | { error: string; message: string } }>(
    '/pages/:id/attachments',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 201: AttachmentResp, 400: ErrorResp, 403: ErrorResp, 413: ErrorResp },
      },
    },
    (req, reply) => handleUpload(req, reply, 'standard'),
  );

  app.post<{ Params: { id: string }; Reply: Attachment | { error: string; message: string } }>(
    '/pages/:id/attachments/large',
    {
      onRequest: [requireAuth(), requireRole(['editor', 'admin'])],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 201: AttachmentResp, 400: ErrorResp, 403: ErrorResp, 411: ErrorResp, 413: ErrorResp },
      },
    },
    (req, reply) => handleUpload(req, reply, 'large'),
  );

  app.get<{ Params: { id: string }; Reply: Attachment[] }>(
    '/pages/:id/attachments',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(AttachmentResp) },
      },
    },
    async (req) => listAttachmentsForPage(req.server, req.params.id),
  );

  app.get<{ Params: { id: string }; Reply: unknown }>(
    '/attachments/:id/download',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 404: ErrorResp, 500: ErrorResp },
      },
    },
    async (req, reply) => {
      const row = await findAttachmentById(req.server, req.params.id);
      if (!row) {
        return reply.code(404).send({ error: 'Not Found', message: 'Attachment not found.' });
      }
      const tier = (row.storageTier ?? 'standard') as Tier;
      try {
        assertPathTierCoherence(tier, row.storagePath);
      } catch (err) {
        req.server.log.error({ storagePath: row.storagePath, tier, err }, 'storage_path/tier consistency failed for attachment');
        return reply.code(500).send({ error: 'Internal Server Error', message: 'Inconsistent attachment (path and tier do not match). Contact the administrator.' });
      }
      const full = resolveFullFilesystemPath(req.server, tier, row.storagePath);
      const safeName = encodeURIComponent(row.originalName || row.fileName);
      reply.header('Content-Disposition', `attachment; filename="${row.fileName}"; filename*=UTF-8''${safeName}`);
      reply.header('Content-Type', row.mimeType || 'application/octet-stream');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'private, max-age=31536000, immutable');
      reply.removeHeader('Content-Length');
      return reply.send(createReadStream(full) as unknown as string);
    },
  );
}
