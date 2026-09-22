/**
 * Utilitário de backoff exponencial com jitter (testável, sem I/O).
 *
 * Semântica:
 * - base(attempt) = min(baseMs * 2^attempt, maxMs)  — determinístico, monótono até o cap.
 * - delay = base * (1 - jitterRatio + 2 * jitterRatio * random())
 *   → delay ∈ [base * (1 - jitterRatio), min(base * (1 + jitterRatio), maxMs+ε)].
 * - O cap final é maxMs: o valor retornado NUNCA excede maxMs e NUNCA é negativo.
 */
export interface BackoffOptions {
  /** Delay base em ms (attempt 0). Default: 500. */
  baseMs?: number;
  /** Teto absoluto em ms. Default: 30_000 (AGENTS.md: cap 30s). */
  maxMs?: number;
  /** Amplitude do jitter simétrico, 0..1. Default: 0.2 (±20%). */
  jitterRatio?: number;
  /** Fonte de aleatoriedade injetável (para testes determinísticos). */
  random?: () => number;
}

export interface ResolvedBackoffOptions {
  baseMs: number;
  maxMs: number;
  jitterRatio: number;
  random: () => number;
}

export function resolveBackoffOptions(opts: BackoffOptions = {}): ResolvedBackoffOptions {
  return {
    baseMs: opts.baseMs ?? 500,
    maxMs: opts.maxMs ?? 30_000,
    jitterRatio: opts.jitterRatio ?? 0.2,
    random: opts.random ?? Math.random,
  };
}

/** Base determinística (sem jitter), limitada pelo cap. Monótona não-decrescente. */
export function backoffBase(attempt: number, opts: BackoffOptions = {}): number {
  const { baseMs, maxMs } = resolveBackoffOptions(opts);
  if (!Number.isFinite(attempt) || attempt < 0) return Math.min(baseMs, maxMs);
  const value = baseMs * 2 ** attempt;
  return Math.min(value, maxMs);
}

/** Delay com jitter simétrico. Nunca negativo, nunca acima de maxMs. */
export function computeBackoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const resolved = resolveBackoffOptions(opts);
  const base = backoffBase(attempt, resolved);
  const factor = 1 - resolved.jitterRatio + 2 * resolved.jitterRatio * resolved.random();
  const delay = base * factor;
  return Math.max(0, Math.min(delay, resolved.maxMs));
}

/**
 * Backoff stateful para loops de reconnect/ retry. `reset()` após sucesso.
 */
export class ExponentialBackoff {
  private attempt = 0;
  private readonly opts: ResolvedBackoffOptions;

  constructor(opts: BackoffOptions = {}) {
    this.opts = resolveBackoffOptions(opts);
  }

  /** Delay da próxima tentativa e avança o contador. */
  nextDelay(): number {
    const attempt = this.attempt;
    this.attempt += 1;
    const base = backoffBase(attempt, this.opts);
    const factor = 1 - this.opts.jitterRatio + 2 * this.opts.jitterRatio * this.opts.random();
    return Math.max(0, Math.min(base * factor, this.opts.maxMs));
  }

  reset(): void {
    this.attempt = 0;
  }

  get currentAttempt(): number {
    return this.attempt;
  }
}

/** Sleep com classificação de erro fora do escopo — utilitário puro. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = (): void => {
      cleanup();
      reject(new Error('aborted'));
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
