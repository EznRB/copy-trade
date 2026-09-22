/**
 * IngestionPipeline — NormalizedEvent → validação → dedup → persistência.
 * Nunca crasha o loop: erro de um evento é logado, contado e isolado.
 */
import { dedupKey, type NormalizedEvent } from '@ct/types';
import type { Logger } from '@ct/logging';
import { parseNormalizedEvent } from './schemas.js';
import { DedupStore, type DedupOutcome } from './dedup-store.js';

export interface PipelineStats {
  ingested: number;
  deduplicated: number;
  validationErrors: number;
  databaseErrors: number;
}

export class IngestionPipeline {
  private running = false;
  private validationErrors = 0;
  private databaseErrors = 0;

  constructor(
    private readonly store: DedupStore,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.running = true;
    this.logger.info('ingestion pipeline started');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info('ingestion pipeline stopped', { ...this.stats() });
  }

  async ingest(event: NormalizedEvent): Promise<DedupOutcome | { status: 'invalid' }> {
    if (!this.running) return { status: 'invalid' };

    const parsed = parseNormalizedEvent(event);
    if (!parsed.success) {
      this.validationErrors++;
      this.logger.warn('evento rejeitado — VALIDATION_ERROR', {
        errorClass: 'VALIDATION_ERROR',
        error: parsed.error.message,
      });
      return { status: 'invalid' };
    }

    const e = parsed.data;
    const key = dedupKey(e);
    const outcome = await this.store.checkAndPersist(key, {
      signature: e.signature,
      instructionIndex: e.instruction_index,
      wallet: e.wallet,
      eventType: e.action,
      slot: BigInt(e.slot),
      blockTime: e.block_time !== null ? new Date(e.block_time * 1000) : null,
      payload: {
        event_id: e.event_id,
        correlation_id: e.correlation_id,
        source: e.source,
        detected_at: e.detected_at,
        token_mint: e.token_mint,
      } as Record<string, string | number>,
    });

    if (outcome.status === 'error') {
      this.databaseErrors++;
      this.logger.error('falha de persistência — DATABASE_ERROR', {
        errorClass: 'DATABASE_ERROR',
        dedupKey: key,
        error: outcome.error.message,
      });
    }
    return outcome;
  }

  stats(): PipelineStats {
    return {
      ingested: this.store.counters.ingested,
      deduplicated: this.store.counters.deduplicated,
      validationErrors: this.validationErrors,
      databaseErrors: this.databaseErrors,
    };
  }
}
