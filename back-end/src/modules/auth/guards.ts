import type { onRequestAsyncHookHandler } from 'fastify';
import type { UserRole } from '@wikicat/shared';
import type { SessionUser } from './auth.service.js';
import { isAllowedRole, isAuthTokenRevoked, findUserById } from './auth.service.js';

export function requireAuth(): onRequestAsyncHookHandler {
  return async (request, reply) => {
    try {
      const payload = (await request.jwtVerify()) as {
        sub?: string;
        jti?: string;
      };
      if (!payload.sub || !payload.jti) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token.' });
      }
      const revoked = await isAuthTokenRevoked(request.server, payload.jti);
      if (revoked) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Session revoked. Sign in again.' });
      }
      const user = await findUserById(request.server, payload.sub);
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'User not found.' });
      }
      const sessionUser: SessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        themePreference: user.themePreference as SessionUser['themePreference'],
        jti: payload.jti,
      };
      request.currentUser = sessionUser;
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required.' });
    }
  };
}

export function requireRole(roles: UserRole[]): onRequestAsyncHookHandler {
  return async (request, reply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required.' });
    }
    if (!isAllowedRole(request.currentUser.role, roles)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Insufficient permission. Required role: ${roles.join(', ')}.`,
      });
    }
  };
}
