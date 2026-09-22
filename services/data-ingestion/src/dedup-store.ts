/**
 * DedupStore — deduplicação em duas camadas (AGENTS.md §2.6 idempotência).
 *
 * (a) Cache em memória (LRU simples, limite configurável) — fast-path.
 * (b) Banco: insert com @@unique([signature, instruction_index, wallet]).
 *     Conflito de unique constraint = duplicata. A camada (b) é a AUTORIDADE:
 *     garante idempotência mesmo entre restarts do processo.
 *
 * Erros: apenas o erro de unique constraint (Prisma P2002) é classificado
 * como duplicata. Qualquer outro erro de persistência é DATABASE_ERROR.
 */

/** Interface mínima do repositório (prisma.observedEvent). */
export interface ObservedEventRepo {
  create(data: {
    data: {
      eventId: string;
      correlationId: string;
      source: string;
      wallet: string;
      signature: string;
      instructionIndex: number;
      slot: number;
      blockTime: number | null;
      detectedAt: Date;
      tokenMint: string;
      action: string;
    };
  }): Promise<unknown>;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

export type DedupOutcome =
  | { status: 'new' }
  | { status: 'duplicate' }
  | { status: 'error'; error: Error };

export class DedupCounters {
  ingested = 0;
  deduplicated = 0;
  errors = 0;
}

export class DedupStore {
  private readonly seen = new Set<string>();
  readonly counters = new DedupCounters();

  constructor(
    private readonly repo: ObservedEventRepo,
    private readonly maxCacheSize = Number(process.env['INGESTION_DEDUP_CACHE_SIZE'] ?? 50_000),
  ) {}

  /** Insere a chave no cache LRU (evict do mais antigo ao exceder o limite). */
  private remember(key: string): void {
    if (this.seen.has(key)) this.seen.delete(key);
    this.seen.add(key);
    if (this.seen.size > this.maxCacheSize) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  /**
   * Verifica e persiste. Retorna 'duplicate' se a dedupKey já existe
   * (cache ou unique constraint do banco).
   */
  async checkAndPersist(
    key: string,
    record: Parameters<ObservedEventRepo['create']>[0]['data'],
  ): Promise<DedupOutcome> {
    // Fast-path: memória (só evita trabalho; NUNCA é a autoridade final).
    if (this.seen.has(key)) {
      this.counters.deduplicated++;
      return { status: 'duplicate' };
    }

    try {
      await this.repo.create({ data: record });
      this.remember(key);
      this.counters.ingested++;
      return { status: 'new' };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.remember(key);
        this.counters.deduplicated++;
        return { status: 'duplicate' };
      }
      this.counters.errors++;
      return {
        status: 'error',
        error: err instanceof Error ? err : new Error(`DATABASE_ERROR: ${String(err)}`),
      };
    }
  }
}
