/**
 * DedupStore — deduplicação em duas camadas (AGENTS.md §2.6 idempotência).
 *
 * (a) Cache em memória (LRU simples, limite configurável) — fast-path.
 * (b) Banco: insert com @@unique([signature, instructionIndex, wallet]).
 *     Conflito (Prisma P2002) = duplicata. A camada (b) é a AUTORIDADE:
 *     garante idempotência mesmo entre restarts do processo.
 *
 * Erros: apenas P2002 é classificado como duplicata. Qualquer outro erro de
 * persistência é DATABASE_ERROR.
 */

/** JSON recursivo compatível com Prisma.InputJsonValue (mantém o package desacoplado). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Shape alinhado ao model ObservedEvent real (packages/database/prisma/schema.prisma). */
export interface ObservedEventInsertData {
  signature: string;
  instructionIndex: number;
  wallet: string;
  eventType: string;
  slot?: bigint | null;
  blockTime?: Date | null;
  /** Prisma Json fields não aceitam null direto (usar Prisma.JsonNull); omitimos quando ausente. */
  payload?: Exclude<JsonValue, null>;
}

/** Interface mínima do repositório (prisma.observedEvent). */
export interface ObservedEventRepo {
  create(args: { data: ObservedEventInsertData }): Promise<unknown>;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
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
  /** Waiters que receberam o resultado agregado de uma operação em voo com erro (RT-005). */
  joined = 0;
}

export class DedupStore {
  private readonly seen = new Set<string>();
  /**
   * RT-005: mapa de operações em voo. Concorrência sobre a mesma dedupKey
   * (reconnect storm) NÃO cria N inserts paralelos que inflam contadores —
   * somente o primeiro vira líder de insert; os demais aguardam o líder.
   *
   * SEMÂNTICA DOS CONTADORES (documentada — review 19ffacc, achado 2):
   * - ingested      : inserts que persistiram de fato no DB (autoridade).
   * - deduplicated  : eventos classificados como duplicata (cache hit, P2002,
   *                   ou waiter cujo líder persistiu/era duplicata).
   * - errors        : tentativas de persistência MAL-SUCEDIDAS — conta 1 por
   *                   operação-líder que falhou (não por tentativa de reexecução,
   *                   pois não há reexecução automática).
   * - joined        : callers que receberam o resultado AGREGADO de uma operação
   *                   em voo concluída com erro (sem retry, sem nova ida ao DB).
   *
   * Em um burst de N chamadas com a mesma key e DB fora do ar:
   *   errors=1, joined=N-1, exatamente 1 chamada a repo.create.
   * Nenhum waiter vira novo líder: erro transitório é propagado como está
   * (o produtor upstream decide re-tentar; retry de escrita financeira/eventual
   * nunca é feito cegamente aqui — AGENTS.md retries+idempotência).
   */
  private readonly inFlight = new Map<string, Promise<DedupOutcome>>();
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

  private async persistLeader(key: string, record: ObservedEventInsertData): Promise<DedupOutcome> {
    try {
      await this.repo.create({ data: record });
      this.remember(key);
      this.counters.ingested++; // contabiliza APÓS insert real (RT-005)
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
    // SEM finally-delete aqui: o cleanup mora em checkAndPersist com auto-verificação
    // (review achado 3 — sync-throw executaria finally antes de inFlight.set).
  }

  /**
   * Verifica e persiste. Retorna 'duplicate' se a dedupKey já existe
   * (cache, unique constraint do banco OU operação em voo concluída com sucesso).
   * Erro do líder é PROPAGADO aos waiters (sem re-tentativa cega).
   */
  async checkAndPersist(key: string, record: ObservedEventInsertData): Promise<DedupOutcome> {
    // Fast-path: memória (só evita trabalho; NUNCA é a autoridade final).
    if (this.seen.has(key)) {
      this.counters.deduplicated++;
      return { status: 'duplicate' };
    }

    // RT-005: dedup concorrente — join na operação em voo da mesma key.
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      const leaderOutcome = await existing;
      if (leaderOutcome.status === 'error') {
        // Review achado 2: NÃO virar líder; propagar o erro do líder.
        this.counters.joined++;
        return leaderOutcome;
      }
      this.counters.deduplicated++;
      return { status: 'duplicate' };
    }

    const promise = this.persistLeader(key, record);
    this.inFlight.set(key, promise);
    // Cleanup protegido contra envenenamento por sync-throw (achado 3):
    // .then sempre executa em microtask APÓS o set acima; deleta apenas a
    // própria entrada (outra operação jamais remove a alheia).
    void promise.then(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    return promise;
  }

  /** Apenas observabilidade/teste: tamanho do mapa em voo. */
  get inFlightSize(): number {
    return this.inFlight.size;
  }
}
