/**
 * Erros classificados dos repositories (AGENTS.md §6 — nunca erro genérico).
 * Não dependem do PrismaClient para permitir fakes em testes.
 */
import type { ErrorClass } from '@ct/types';

export class RepositoryError extends Error {
  readonly errorClass: ErrorClass;
  override readonly cause?: unknown;

  constructor(errorClass: ErrorClass, message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.errorClass = errorClass;
    this.cause = cause;
  }
}

/** Código Prisma para unique constraint violation. Tratado como dado, não erro. */
export const PRISMA_UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
  );
}
