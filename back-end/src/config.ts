import 'dotenv/config';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import Ajv from 'ajv';

const EnvSchema = Type.Object({
  NODE_ENV: Type.Optional(Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')])),
  PORT: Type.Optional(Type.Number({ default: 3000 })),
  HOST: Type.Optional(Type.String({ default: '0.0.0.0' })),
  LOG_LEVEL: Type.Optional(Type.Union([Type.Literal('trace'), Type.Literal('debug'), Type.Literal('info'), Type.Literal('warn'), Type.Literal('error')], { default: 'info' })),
  DATABASE_URL: Type.String({ minLength: 1 }),
  JWT_SECRET: Type.String({ minLength: 16 }),
  COOKIE_SECRET: Type.String({ minLength: 16 }),
  SESSION_MAX_AGE_SECONDS: Type.Optional(Type.Number({ default: 86400 * 7 })),
  ATTACHMENTS_DIR: Type.Optional(Type.String({ default: '/attachments' })),
  ATTACHMENTS_LARGE_DIR: Type.Optional(Type.String({ default: '/attachments-large' })),
  PUBLIC_BASE_URL: Type.Optional(Type.String()),
  WEB_ORIGIN: Type.Optional(Type.String()),
  MAX_ATTACHMENT_STANDARD_MB: Type.Optional(Type.Number({ default: 20 })),
  MAX_ATTACHMENT_LARGE_MB: Type.Optional(Type.Number({ default: 2048 })),
  INIT_ADMIN_EMAIL: Type.Optional(Type.String()),
  INIT_ADMIN_PASSWORD: Type.Optional(Type.String()),
  INIT_ADMIN_NAME: Type.Optional(Type.String({ default: 'Administrator' })),
});

type Env = Static<typeof EnvSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

type AjvCtor = new (opts: { allErrors: boolean; useDefaults: boolean; coerceTypes: boolean }) => {
  compile: (schema: unknown) => ((data: unknown) => boolean) & {
    errors?: { instancePath?: string; message?: string }[] | null;
  };
};

export const registerConfig = fp(async (app: FastifyInstance) => {
  const mod = Ajv as unknown as { default?: unknown };
  const Ctor = (mod.default ?? Ajv) as AjvCtor;
  const ajv = new Ctor({ allErrors: true, useDefaults: true, coerceTypes: true });
  const validate = ajv.compile(EnvSchema);
  const valid = validate(process.env);
  if (!valid) {
    const errs = validate.errors ?? [];
    const msg = errs.map((e) => `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`).join('; ');
    app.log.error(`Environment validation failed: ${msg}`);
    throw new Error(`Invalid configuration: ${msg}`);
  }
  app.decorate('config', process.env as unknown as Env);
  app.log.info('Environment configuration loaded and validated');
});
