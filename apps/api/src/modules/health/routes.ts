import type { FastifyInstance } from 'fastify';
import type { HealthStatus } from '@wikicat/shared';

export async function registerHealth(app: FastifyInstance) {
  app.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
            db: { type: 'string', enum: ['ok', 'unhealthy'] },
            appVersion: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['status', 'appVersion', 'timestamp'],
        },
      },
    },
  }, async (): Promise<HealthStatus> => ({
    status: 'ok',
    db: 'ok',
    appVersion: '0.1.0',
    timestamp: new Date().toISOString(),
  }));
}
