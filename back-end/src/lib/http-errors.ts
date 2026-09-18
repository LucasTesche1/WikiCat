import type { FastifyReply } from 'fastify';

export type ErrorName = 'Bad Request' | 'Unauthorized' | 'Forbidden' | 'Not Found' | 'Conflict' | 'Payload Too Large' | 'Internal Server Error';

export type ErrorResponse = {
  error: string;
  message: string;
};

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly error: ErrorName = statusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
  ) {
    super(message);
    this.name = error;
  }
}

export function httpError(statusCode: number, message: string, error?: ErrorName): HttpError {
  return new HttpError(statusCode, message, error ?? errorNameForStatus(statusCode));
}

export function errorNameForStatus(statusCode: number): ErrorName {
  if (statusCode === 401) return 'Unauthorized';
  if (statusCode === 403) return 'Forbidden';
  if (statusCode === 404) return 'Not Found';
  if (statusCode === 409) return 'Conflict';
  if (statusCode === 413) return 'Payload Too Large';
  if (statusCode >= 500) return 'Internal Server Error';
  return 'Bad Request';
}

export function errorDetails(error: unknown, fallbackMessage: string): {
  statusCode: number;
  message: string;
  error: ErrorName;
} {
  const statusCode =
    error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 500;
  const safeStatusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
  const message =
    error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : fallbackMessage;
  return {
    statusCode: safeStatusCode,
    message,
    error: errorNameForStatus(safeStatusCode),
  };
}

export function sendError(reply: FastifyReply, error: unknown, fallbackMessage: string) {
  const details = errorDetails(error, fallbackMessage);
  return reply.code(details.statusCode).send({
    error: details.error,
    message: details.statusCode >= 500 ? 'An unexpected error occurred.' : details.message,
  } satisfies ErrorResponse);
}
