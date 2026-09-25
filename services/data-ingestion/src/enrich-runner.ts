/**
 * enrich-runner.ts — loop/worker de enrichment F1.5 (usado pelo serviço e
 * pelo script one-shot de backfill). Batch de eventos não enriquecidos,
 * rate-limit configurável, sem Throw no loop.
 */
import type { Enricher } from './enricher.js';

export interface UnenrichedStore {
  findUnenriched(limit: number, maxAttempts: number): Promise<
    Array<{ id: string; signature: string }>
  >;
}

export interface RunnerStats {
  seen: number;
  enriched: number;
  undecodable: number;
  retried: number;
}

export class EnrichRunner {
  readonly stats: RunnerStats = { seen: 0, enriched: 0, undecodable: 0, retried: 0 };
  private stopFlag = false;

  constructor(
    private readonly store: UnenrichedStore,
    private readonly enricher: Enricher,
    private readonly opts: { batchSize: number; maxAttempts: number; sleepMs: number },
  ) {}

  stop(): void {
    this.stopFlag = true;
  }

  /** Uma passada completa até esgotar a fila ou stopFlag. */
  async runUntilEmpty(maxBatches: number = Number.MAX_SAFE_INTEGER): Promise<RunnerStats> {
    for (let b = 0; b < maxBatches && !this.stopFlag; b++) {
      const batch = await this.store.findUnenriched(this.opts.batchSize, this.opts.maxAttempts);
      if (batch.length === 0) break;
      for (const row of batch) {
        if (this.stopFlag) break;
        const r = await this.enricher.enrich(row.id, row.signature);
        this.stats.seen++;
        if (r === 'enriched') this.stats.enriched++;
        else if (r === 'undecodable') this.stats.undecodable++;
        else this.stats.retried++;
        if (this.opts.sleepMs > 0) await new Promise((r2) => setTimeout(r2, this.opts.sleepMs));
      }
    }
    return this.stats;
  }
}
