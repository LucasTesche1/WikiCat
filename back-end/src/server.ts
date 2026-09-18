import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerConfig } from './config.js';
import { registerDb } from './db/index.js';
import { registerHealth } from './modules/health/routes.js';
import { registerAuth } from './modules/auth/routes.js';
import { registerSpaces } from './modules/spaces/routes.js';
import { registerPages } from './modules/pages/routes.js';
import { registerAttachments } from './modules/attachments/routes.js';
import { registerTags } from './modules/tags/routes.js';
import { registerWorkspace } from './modules/pages/workspace.routes.js';
import { registerTemplates } from './modules/templates/routes.js';
import type { HealthStatus } from '@wikicat/shared';
import { errorDetails } from './lib/http-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      serializers: {
        res(reply) {
          return { statusCode: reply.statusCode };
        },
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
    trustProxy: true,
  });

  registerConfig(app);

  app.register(cors, {
    origin: app.config.WEB_ORIGIN ? app.config.WEB_ORIGIN.split(',') : true,
    credentials: true,
  });

  app.register(cookie, {
    secret: app.config.COOKIE_SECRET,
    hook: 'onRequest',
  });

  app.register(jwt, {
    secret: app.config.JWT_SECRET,
    cookie: {
      cookieName: 'auth_token',
      signed: true,
    },
    sign: {
      algorithm: 'HS256',
      iss: 'wikicat',
      aud: 'wikicat-web',
    },
    verify: {
      allowedIss: 'wikicat',
      allowedAud: 'wikicat-web',
    },
  });

  app.register(fastifyMultipart, {
    limits: { files: 1, headerPairs: 200 },
    throwFileSizeLimit: true,
  });

  const webDist = path.resolve(__dirname, '..', 'public');
  const hasWebDist = fs.existsSync(webDist);
  if (hasWebDist) {
    app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      decorateReply: true,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      },
    });
  }

  app.register(registerDb);
  app.register(registerHealth, { prefix: '/api' });
  app.register(registerAuth, { prefix: '/api' });
  app.register(registerSpaces, { prefix: '/api' });
  app.register(registerPages, { prefix: '/api' });
  app.register(registerAttachments, { prefix: '/api' });
  app.register(registerTags, { prefix: '/api' });
  app.register(registerWorkspace, { prefix: '/api' });
  app.register(registerTemplates, { prefix: '/api' });

  app.get('/health', async (): Promise<HealthStatus> => ({
    status: 'ok',
    db: 'ok',
    appVersion: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.setNotFoundHandler((_request, reply) => {
    const req = _request.raw;
    const url = (req && req.url) || _request.url || '';
    if (url.startsWith('/api/')) {
      reply.status(404).send({ error: 'Not Found', message: 'Endpoint not found' });
      return;
    }
    if (hasWebDist) {
      reply.code(200).sendFile('index.html');
      return;
    }
    reply.status(404).send({ error: 'Not Found', message: 'Endpoint not found' });
  });

  app.setErrorHandler((err: unknown, _request, reply) => {
    const details = errorDetails(err, 'An unexpected error occurred.');
    app.log.warn({ err, status: details.statusCode }, 'HTTP error');
    reply.status(details.statusCode).send({
      error: details.statusCode >= 500 ? 'Internal Server Error' : details.error,
      message: details.statusCode >= 500 ? 'An unexpected error occurred.' : details.message,
    });
  });

  return app;
}

async function main() {
  const app = createApp();
  try {
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
    app.log.info(`WikiCat API listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  main();
}
