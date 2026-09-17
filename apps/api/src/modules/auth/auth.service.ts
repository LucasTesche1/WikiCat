import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { eq, isNull, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { UserRole } from '@wikicat/shared';
import { users, authTokens } from '../../db/schema/index.js';

export const BCRYPT_COST = 12;

export type UserRow = typeof users.$inferSelect;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  themePreference: 'system' | 'light' | 'dark';
  jti: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SessionUser;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function isPasswordStrong(password: string): boolean {
  if (password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export function isAllowedRole(current: UserRole, required: UserRole[]): boolean {
  if (required.includes(current)) return true;
  if (current === 'admin') return true;
  if (current === 'editor' && required.includes('editor')) return true;
  return false;
}

export async function findUserByEmail(app: FastifyInstance, email: string): Promise<UserRow | null> {
  const rows = await app.db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(app: FastifyInstance, id: string): Promise<UserRow | null> {
  const rows = await app.db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureInitialAdmin(app: FastifyInstance): Promise<void> {
  const { INIT_ADMIN_EMAIL, INIT_ADMIN_PASSWORD, INIT_ADMIN_NAME } = app.config;
  if (!INIT_ADMIN_EMAIL || !INIT_ADMIN_PASSWORD) {
    app.log.warn(
      'INIT_ADMIN_EMAIL / INIT_ADMIN_PASSWORD are not configured; initial admin seed skipped.',
    );
    return;
  }
  const exists = await findUserByEmail(app, INIT_ADMIN_EMAIL);
  if (exists) return;
  const pwHash = hashPassword(INIT_ADMIN_PASSWORD);
  await app.db.insert(users).values({
    email: INIT_ADMIN_EMAIL,
    name: INIT_ADMIN_NAME ?? 'Administrator',
    passwordHash: pwHash,
    role: 'admin',
  });
  app.log.info(`Seed: initial admin user created (${INIT_ADMIN_EMAIL}).`);
}

export async function createUser(
  app: FastifyInstance,
  input: { email: string; name: string; password: string; role: UserRole },
): Promise<UserRow> {
  const pwHash = hashPassword(input.password);
  const rows = await app.db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: pwHash,
      role: input.role,
    })
    .returning();
  return rows[0]!;
}

export function generateJti(): string {
  return crypto.randomUUID();
}

export async function revokeAuthToken(app: FastifyInstance, jti: string): Promise<void> {
  await app.db
    .update(authTokens)
    .set({ revokedAt: new Date() })
    .where(eq(authTokens.tokenJti, jti));
}

export async function isAuthTokenRevoked(app: FastifyInstance, jti: string): Promise<boolean> {
  const rows = await app.db
    .select({ revokedAt: authTokens.revokedAt, expiresAt: authTokens.expiresAt })
    .from(authTokens)
    .where(eq(authTokens.tokenJti, jti))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  if (row.revokedAt != null) return true;
  if (row.expiresAt.getTime() < Date.now()) return true;
  return false;
}

export function createSessionPayload(user: UserRow, jti: string): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    themePreference: user.themePreference as SessionUser['themePreference'],
    jti,
  };
}
