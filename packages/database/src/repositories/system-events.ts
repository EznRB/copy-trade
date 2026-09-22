/**
 * Repository de SystemEvent — telemetria/observabilidade persistida.
 * Mapeamento de campos do domínio para o schema:
 *   type     → kind
 *   metadata → details (Json)
 */
import { RepositoryError } from './errors.js';

export type SystemEventSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface SystemEventInput {
  type: string;
  message: string;
  metadata?: unknown;
  severity?: SystemEventSeverity;
}

export interface SystemEventDelegate {
  create(args: {
    data: { kind: string; severity: string; message: string; details?: unknown };
  }): Promise<unknown>;
}

/** Registra um SystemEvent. Erros propagam como DATABASE_ERROR classificado. */
export async function recordSystemEvent(
  client: { systemEvent: SystemEventDelegate },
  input: SystemEventInput,
): Promise<{ id: string }> {
  try {
    const created = (await client.systemEvent.create({
      data: {
        kind: input.type,
        message: input.message,
        severity: input.severity ?? 'info',
        ...(input.metadata !== undefined ? { details: input.metadata } : {}),
      },
    })) as { id: string };
    return { id: created.id };
  } catch (err) {
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao registrar SystemEvent (type=${input.type})`,
      err,
    );
  }
}
