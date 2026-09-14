import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import * as schema from './schema/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<typeof schema>>;
    sql: ReturnType<typeof postgres>;
  }
}

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;
type Sql = ReturnType<typeof postgres>;

export const registerDb = fp(async (app: FastifyInstance) => {
  const url = app.config.DATABASE_URL;
  const sqlClient = postgres(url, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(sqlClient, { schema, logger: app.config.NODE_ENV === 'development' });
  app.decorate('db', db as Drizzle);
  app.decorate('sql', sqlClient as Sql);
  app.addHook('onClose', async () => {
    await sqlClient.end();
  });
  app.log.info('Drizzle/Postgres client registered');
});

export { schema };
