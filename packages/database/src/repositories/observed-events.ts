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

// ---------------------------------------------------------------------------
// F1.5 — Enrichment (decoder pump.fun/PumpSwap)
// ---------------------------------------------------------------------------

export interface EnrichmentData {
  id: string;
  direction: 'buy' | 'sell';
  amountSol: string | number | null;
  tokenAmount: string | number | null;
  mint: string;
  counterparty: string;
  enrichSource: string;
}

export interface UnenrichedRow {
  id: string;
  signature: string;
  instructionIndex: number;
  wallet: string;
}

export interface ObservedEventEnrichDelegate {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, unknown>;
    take: number;
    select: Record<string, boolean>;
  }): Promise<UnenrichedRow[]>;
  updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Marca um evento como enriquecido com os campos decodificados.
 * TOCTOU-safe (review 88152bbf): guarda `enrichedAt: null` no WHERE —
 * se outro worker enriqueceu antes, o update não afeta linha alguma e
 * reportamos que não foi gravado (falso positivo de escrita eliminado).
 */
export async function markEnriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  data: EnrichmentData,
): Promise<void> {
  // Fallback deterministico quando o delegate nao tem updateMany com guarda.
  const supportsGuardedWrite = typeof client.observedEvent.updateMany === 'function';
  const payload = {
    direction: data.direction,
    amountSol: data.amountSol,
    tokenAmount: data.tokenAmount,
    mint: data.mint,
    counterparty: data.counterparty,
    enrichSource: data.enrichSource,
    enrichedAt: new Date(),
  };
  try {
    if (supportsGuardedWrite && client.observedEvent.updateMany) {
      const res = (await client.observedEvent.updateMany({
        where: { id: data.id, enrichedAt: null },
        data: payload,
      })) as { count?: number } | undefined;
      if (res && typeof res.count === 'number' && res.count === 0) {
        throw new RepositoryError(
          'DATABASE_ERROR',
          `markEnriched ignorado: ObservedEvent ${data.id} ja estava enriquecido (TOCTOU)`,
          new Error('guarda enrichedAt IS NULL falhou'),
        );
      }
      return;
    }
    await client.observedEvent.update({
      where: { id: data.id },
      data: payload,
    });
  } catch (err) {
    if (err instanceof RepositoryError) throw err;
    throw new RepositoryError('DATABASE_ERROR', `Falha ao enriquecer ObservedEvent ${data.id}`, err);
  }
}

/** Marca o evento como processado sem decodificar (UNKNOWN explícito). */
export async function markUndecodable(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
  reason: string,
): Promise<void> {
  try {
    const guarded = typeof client.observedEvent.updateMany === 'function';
    const payload = {
      enrichSource: `undecodable:${reason}`.slice(0, 128),
      enrichedAt: new Date(),
    };
    if (guarded && client.observedEvent.updateMany) {
      await client.observedEvent.updateMany({
        where: { id, enrichedAt: null },
        data: payload,
      });
      return;
    }
    await client.observedEvent.update({
      where: { id },
      data: payload,
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao marcar undecodable ${id}`, err);
  }
}

/** Busca lote de eventos ainda não enriquecidos para processar (backfill/enricher). */
export async function findUnenriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  opts: { limit: number; maxAttempts: number },
): Promise<UnenrichedRow[]> {
  try {
    return await client.observedEvent.findMany({
      where: { enrichedAt: null, enrichAttempts: { lt: opts.maxAttempts } },
      orderBy: { receivedAt: 'asc' },
      take: opts.limit,
      select: { id: true, signature: true, instructionIndex: true, wallet: true },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', 'Falha ao buscar eventos não enriquecidos', err);
  }
}

/** Incrementa o contador de tentativas de enrichment (evita retry infinito). */
export async function incrementEnrichAttempt(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
): Promise<void> {
  if (!client.observedEvent.updateMany) {
    throw new RepositoryError('DATABASE_ERROR', 'delegate sem updateMany', new Error('unsupported'));
  }
  try {
    await client.observedEvent.updateMany({
      where: { id },
      data: { enrichAttempts: { increment: 1 } },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao incrementar enrichAttempts ${id}`, err);
  }
}
