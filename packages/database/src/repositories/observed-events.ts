/**
 * Repository de ObservedEvent — dedup de eventos on-chain (AGENTS.md regra 6).
 * Chave de idempotência: signature + instructionIndex + wallet
 * (@@unique no schema → constraint ObservedEvent_signature_instructionIndex_wallet_key).
 *
 * O client é injetado (nunca importa o singleton) para permitir fakes em testes.
 */
import { isUniqueViolation, RepositoryError } from './errors.js';

export interface ObservedEventInsertData {
  signature: string;
  instructionIndex: number;
  wallet: string;
  eventType: string;
  slot?: bigint | null;
  blockTime?: Date | null;
  payload?: unknown;
}

export interface ObservedEventDelegate {
  create(args: { data: ObservedEventInsertData }): Promise<unknown>;
  findUnique(args: {
    where: {
      signature_instructionIndex_wallet: {
        signature: string;
        instructionIndex: number;
        wallet: string;
      };
    };
    select?: { id: true };
  }): Promise<{ id: string } | null>;
}

export type InsertResult = 'inserted' | 'duplicate';

/**
 * Insere um evento observado. Idempotente:
 * - unique violation (P2002) na chave de dedup → 'duplicate' (não é erro);
 * - qualquer outro erro → RepositoryError(DATABASE_ERROR).
 */
export async function insertObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  data: ObservedEventInsertData,
): Promise<InsertResult> {
  try {
    await client.observedEvent.create({ data });
    return 'inserted';
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'duplicate';
    }
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao inserir ObservedEvent (${data.signature}:${data.instructionIndex}:${data.wallet})`,
      err,
    );
  }
}

/** Verifica existência pela chave de dedup, sem lançar. */
export async function existsObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  key: { signature: string; instructionIndex: number; wallet: string },
): Promise<boolean> {
  try {
    const found = await client.observedEvent.findUnique({
      where: { signature_instructionIndex_wallet: key },
      select: { id: true },
    });
    return found !== null;
  } catch (err) {
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao consultar ObservedEvent (${key.signature}:${key.instructionIndex}:${key.wallet})`,
      err,
    );
  }
}
