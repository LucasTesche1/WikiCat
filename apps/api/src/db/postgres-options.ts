import type postgres from 'postgres';

export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DATABASE_PRIVATE_URL || env.DATABASE_URL || env.DATABASE_PUBLIC_URL;
}

export function postgresOptions(base: postgres.Options<Record<string, postgres.PostgresType>> = {}) {
  const sslMode = process.env.DB_SSL_MODE || process.env.PGSSLMODE;
  const ssl = sslMode === 'require' ? ('require' as const) : undefined;
  return ssl ? { ...base, ssl } : base;
}
