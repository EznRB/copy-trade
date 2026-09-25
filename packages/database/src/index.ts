/**
 * @ct/database — PrismaClient singleton.
 * Nunca commitar DATABASE_URL (ver docs/security/secret-policy.md).
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __ctPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__ctPrisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.__ctPrisma = prisma;
}

export { PrismaClient };
export type * from '@prisma/client';

// Repositories — client sempre injetado (testável, sem singleton escondido).
export {
  insertObservedEvent,
  existsObservedEvent,
  markEnriched,
  markUndecodable,
  findUnenriched,
  incrementEnrichAttempt,
  type InsertResult,
  type ObservedEventInsertData,
  type ObservedEventDelegate,
  type EnrichmentData,
  type UnenrichedRow,
  type ObservedEventEnrichDelegate,
} from './repositories/observed-events.js';
export {
  recordSystemEvent,
  type SystemEventInput,
  type SystemEventSeverity,
} from './repositories/system-events.js';
export {
  appendAuditLog,
  type AuditLogInput,
} from './repositories/audit-log.js';
export {
  RepositoryError,
  isUniqueViolation,
  PRISMA_UNIQUE_VIOLATION,
} from './repositories/errors.js';
