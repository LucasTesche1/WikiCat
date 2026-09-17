import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import type {
  AuthLoginRequest,
  AuthMeResponse,
  CreateUserRequest,
  UpdatePasswordRequest,
  UserRole,
} from '@wikicat/shared';
import {
  ensureInitialAdmin,
  findUserByEmail,
  verifyPassword,
  createUser,
  generateJti,
  createSessionPayload,
  revokeAuthToken,
  findUserById,
  isPasswordStrong,
  hashPassword,
} from './auth.service.js';
import { requireAuth, requireRole } from './guards.js';
import { authTokens, users } from '../../db/schema/index.js';

export async function registerAuth(app: FastifyInstance) {
  await ensureInitialAdmin(app);

  app.post<{ Body: AuthLoginRequest }>(
    '/auth/login',
    {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email', minLength: 3, maxLength: 255 }),
          password: Type.String({ minLength: 1, maxLength: 256 }),
        }),
        response: {
          200: Type.Object({
            ok: Type.Boolean(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.String(),
              role: Type.Union([Type.Literal('admin'), Type.Literal('editor'), Type.Literal('viewer')]),
              themePreference: Type.Union([
                Type.Literal('system'),
                Type.Literal('light'),
                Type.Literal('dark'),
              ]),
            }),
          }),
          401: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const email = body.email.trim().toLowerCase();
      const user = await findUserByEmail(app, email);
      const userOk = user != null;
      const pwOk = user ? verifyPassword(body.password, user.passwordHash) : false;
      if (!userOk || !pwOk) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials.',
        });
      }
      const jti = generateJti();
      const maxAge = app.config.SESSION_MAX_AGE_SECONDS ?? 86400 * 7;
      const expiresAt = new Date(Date.now() + maxAge * 1000);
      await app.db.insert(authTokens).values({
        tokenJti: jti,
        userId: user.id,
        expiresAt,
      });
      const tokenPayload = { sub: user.id, jti };
      const token = app.jwt.sign(tokenPayload, { expiresIn: maxAge, jti, noTimestamp: false });
      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: app.config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
        signed: true,
      });
      const responseUser: AuthMeResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        themePreference: user.themePreference as AuthMeResponse['themePreference'],
      };
      return { ok: true, user: responseUser };
    },
  );

  app.post<{ Body: CreateUserRequest }>(
    '/auth/register',
    {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email', maxLength: 255 }),
          name: Type.String({ minLength: 2, maxLength: 255 }),
          password: Type.String({ minLength: 10, maxLength: 128 }),
          role: Type.Union([
            Type.Literal('admin'),
            Type.Literal('editor'),
            Type.Literal('viewer'),
          ]),
        }),
        response: {
          201: Type.Object({ ok: Type.Boolean(), id: Type.String() }),
          400: Type.Object({ error: Type.String(), message: Type.String() }),
          409: Type.Object({ error: Type.String(), message: Type.String() }),
        },
      },
      onRequest: [requireAuth(), requireRole(['admin'])],
    },
    async (request, reply) => {
      const body = request.body;
      if (!isPasswordStrong(body.password)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message:
            'Weak password: use at least 10 characters, 1 uppercase letter, and 1 number.',
        });
      }
      const email = body.email.trim().toLowerCase();
      const already = await findUserByEmail(app, email);
      if (already) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'A user with this email already exists.',
        });
      }
      const created = await createUser(app, {
        email,
        name: body.name,
        password: body.password,
        role: body.role,
      });
      reply.code(201);
      return { ok: true, id: created.id };
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        response: { 204: Type.Null() },
      },
      onRequest: [requireAuth()],
    },
    async (request, reply) => {
      if (request.currentUser?.jti) {
        await revokeAuthToken(app, request.currentUser.jti);
      }
      reply.clearCookie('auth_token', { path: '/' });
      return reply.code(204).send();
    },
  );

  app.get<{ Reply: AuthMeResponse }>(
    '/auth/me',
    {
      schema: {
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.String(),
            role: Type.Union([Type.Literal('admin'), Type.Literal('editor'), Type.Literal('viewer')]),
            themePreference: Type.Union([
              Type.Literal('system'),
              Type.Literal('light'),
              Type.Literal('dark'),
            ]),
          }),
        },
      },
      onRequest: [requireAuth()],
    },
    async (request) => {
      const u = request.currentUser!;
      const fresh = await findUserById(app, u.id);
      return {
        id: fresh?.id ?? u.id,
        email: fresh?.email ?? u.email,
        name: fresh?.name ?? u.name,
        role: (fresh?.role as AuthMeResponse['role']) ?? u.role,
        themePreference:
          (fresh?.themePreference as AuthMeResponse['themePreference']) ?? u.themePreference,
      };
    },
  );

  app.patch<{ Body: UpdatePasswordRequest }>(
    '/auth/me/password',
    {
      schema: {
        body: Type.Object({
          currentPassword: Type.String(),
          newPassword: Type.String({ minLength: 10, maxLength: 128 }),
        }),
      },
      onRequest: [requireAuth()],
    },
    async (request, reply) => {
      const body = request.body;
      const me = request.currentUser!;
      const row = await findUserById(app, me.id);
      if (!row || !verifyPassword(body.currentPassword, row.passwordHash)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Current password is incorrect.',
        });
      }
      if (!isPasswordStrong(body.newPassword)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'New password is weak (minimum 10 characters, uppercase letter, and number).',
        });
      }
      const hash = hashPassword(body.newPassword);
      await app.db.update(authTokens).set({ revokedAt: new Date() }).where(eq(authTokens.userId, me.id));
      await app.db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, me.id));
      reply.clearCookie('auth_token', { path: '/' });
      return reply.code(204).send();
    },
  );
}
