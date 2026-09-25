/**
 * enricher.ts — F1.5: transforma ObservedEvent crus (UNKNOWN) em eventos com
 * direção/valores via decode da transação completa (getTransaction), usando o
 * decoder oficial pump.fun/PumpSwap de @ct/pumpfun (IDL oficial + codama).
 *
 * Regras invioláveis:
 * - Sem eventType real decodificado → UNKNOWN explícito (markUndecodable).
 * - Amounts vindos da INSTRUÇÃO são parâmetros/limites, não realizados —
 *   documentado em decode.ts. O pipeline F1.5 persiste o que decode fornece
 *   e marca enrichSource='pump-decoder-v1' (rastreável; revogável).
 */
import { decodePumpInstruction, type DecodedSwap } from '@ct/pumpfun';

/** Shape mínimo do getTransaction(jsonParsed) que usamos. */
export interface ParsedTx {
  meta?: {
    innerInstructions?: Array<{
      index: number;
      instructions: ParsedInstruction[];
    }> | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey?: string } | string> | null;
      instructions?: ParsedInstruction[] | null;
    } | null;
  } | null;
}

export interface ParsedInstruction {
  programId?: string;
  /** jsonParsed "partially decoded": accounts é indireto pela message. */
  accounts?: string[]; // já resolvidas para endereços (eta)
  data?: string; // base58
  /** jsonParsed fully parsed */
  parsed?: unknown;
}

export interface TxFetcher {
  getTransaction(signature: string): Promise<unknown>;
}

export interface EnrichStore {
  markEnriched(id: string, d: DecodedSwap): Promise<void>;
  markUndecodable(id: string, reason: string): Promise<void>;
  bumpAttempt(id: string): Promise<void>;
}

/** Converte base58 → Uint8Array (alphabet Bitcoin/Solana, sem libs externas). */
export function base58ToBytes(s: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  const map = new Map(
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      .split('')
      .map((c, i) => [c, BigInt(i)] as const),
  );
  let num = 0n;
  for (const ch of s) {
    const v = map.get(ch);
    if (v === undefined) return null;
    num = num * 58n + v;
  }
  const bytes: number[] = [];
  let n = num;
  if (n === 0n) bytes.push(0);
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  // Preserva 0s à esquerda ('1')
  for (const ch of s) {
    if (ch === '1') bytes.unshift(0);
    else break;
  }
  return Uint8Array.from(bytes.reverse().reverse());
}

/**
 * Resolve o array de pubkeys da message para endereços string, combinando
 * instruções externas e internas com índices de conta. Retorna lista de
 * { programId, accountKeys }, ou null se a tx estiver inutilizável.
 */
export function collectInstructionCalls(
  tx: ParsedTx,
): Array<{ programId: string; data: Uint8Array; accounts: string[] }> {
  const keys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(keys)) return [];
  const keyAt = (i: number): string | null => {
    const k = keys[i];
    if (typeof k === 'string') return k;
    return k?.pubkey ?? null;
  };

  const calls: Array<{ programId: string; data: Uint8Array; accounts: string[] }> = [];
  const push = (ix: ParsedInstruction & { programIdIndex?: number; accountKeys?: number[] }) => {
    // jsonParsed: programId já string; "partially decoded" traz programIdIndex + data base58 + accounts (indices)
    const programId = ix.programId ?? (ix.programIdIndex != null ? keyAt(ix.programIdIndex) : null);
    if (!programId) return;
    const accounts = Array.isArray(ix.accounts)
      ? (ix.accounts as unknown[]).map((a) =>
          typeof a === 'string' ? a : typeof a === 'number' ? keyAt(a) : null,
        )
      : null;
    if (!accounts || accounts.some((a) => a === null)) return;
    const dataB58 = typeof ix.data === 'string' ? ix.data : null;
    if (!dataB58) return;
    const bytes = base58ToBytes(dataB58);
    if (!bytes) return;
    calls.push({ programId, data: bytes, accounts: accounts as string[] });
  };

  for (const ix of tx.transaction?.message?.instructions ?? []) push(ix);
  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner?.instructions ?? []) push(ix);
  }
  return calls;
}

export class Enricher {
  private running = 0;

  constructor(
    private readonly fetcher: TxFetcher,
    private readonly store: EnrichStore,
    private readonly logger: {
      info(m: string, f?: Record<string, unknown>): void;
      warn(m: string, f?: Record<string, unknown>): void;
      error(m: string, f?: Record<string, unknown>): void;
    },
    private readonly maxAttempts = 5,
  ) {}

  /** Enriquece um evento por signature. Idempotente por coluna (update por id). */
  async enrich(id: string, signature: string): Promise<'enriched' | 'undecodable' | 'retry'> {
    this.running++;
    try {
      await this.store.bumpAttempt(id);
      const rawTx = await this.fetcher.getTransaction(signature);
      const calls = collectInstructionCalls(rawTx as ParsedTx);
      let decoded: DecodedSwap | null = null;
      for (const c of calls) {
        decoded = decodePumpInstruction(c.programId, c.data, c.accounts);
        if (decoded) break;
      }
      if (!decoded) {
        await this.store.markUndecodable(id, 'no-decodable-instruction');
        return 'undecodable';
      }
      await this.store.markEnriched(id, decoded);
      return 'enriched';
    } catch (err) {
      // Erro transitório de RPC: retry até maxAttempts (sem marcação definitiva).
      this.logger.warn('enrich falhou (retry se attempts < max)', {
        errorClass: 'RPC_ERROR',
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'retry';
    } finally {
      this.running--;
    }
  }
}

export { type DecodedSwap };
