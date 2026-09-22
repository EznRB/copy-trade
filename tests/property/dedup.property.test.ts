import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { dedupKey, type NormalizedEvent } from '../../packages/types/src/index.js';

/**
 * Property tests de idempotência (§17): processar o mesmo evento
 * (signature + instruction_index + wallet) N vezes não pode duplicar.
 */

const eventArb: fc.Arbitrary<NormalizedEvent> = fc.record({
  event_id: fc.uuid(),
  correlation_id: fc.uuid(),
  source: fc.constantFrom('helius_wss', 'rpc'),
  wallet: fc.string({ minLength: 32, maxLength: 44 }),
  signature: fc.string({ minLength: 32, maxLength: 88 }),
  instruction_index: fc.integer({ min: 0, max: 20 }),
  slot: fc.integer({ min: 0 }),
  block_time: fc.integer({ min: 0 }),
  detected_at: fc.integer({ min: 0 }),
  processed_at: fc.integer({ min: 0 }),
  token_mint: fc.string({ minLength: 32, maxLength: 44 }),
  action: fc.constantFrom('BUY', 'SELL', 'TRANSFER', 'CREATE', 'UNKNOWN'),
  sol_amount: fc.float({ min: 0, max: 1000, noNaN: true }),
  token_amount: fc.float({ min: 0, noNaN: true }),
  price: fc.float({ min: 0, noNaN: true }),
  market_cap: fc.float({ min: 0, noNaN: true }),
  liquidity: fc.float({ min: 0, noNaN: true }),
  latency_ms: fc.integer({ min: 0 }),
});

/** Simulador mínimo do sink idempotente: chave vista → descarta. */
class DedupSink {
  private seen = new Set<string>();
  processed = 0;
  ingested = 0;
  ingest(e: NormalizedEvent): boolean {
    this.ingested += 1;
    const key = dedupKey(e);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.processed += 1;
    return true;
  }
}

describe('dedup idempotente (property)', () => {
  it('duplicatas arbitrárias nunca são processadas duas vezes', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 50 }), (events) => {
        const sink = new DedupSink();
        // ingestão 2x + ordem embaralhada
        for (const e of [...events, ...events, ...events].reverse()) sink.ingest(e);
        const unique = new Set(events.map(dedupKey)).size;
        expect(sink.processed).toBe(unique);
        expect(sink.ingested).toBe(events.length * 3);
      }),
    );
  });

  it('eventos distintos com mesma signature mas wallet/instrução diferentes não colidem', () => {
    fc.assert(
      fc.property(
        eventArb,
        fc.integer({ min: 0, max: 20 }),
        fc.string({ minLength: 32, maxLength: 44 }),
        (e, idx, w) => {
          const a = { ...e, instruction_index: idx, wallet: w };
          const b = { ...e };
          const same = dedupKey(a) === dedupKey(b);
          expect(same).toBe(a.instruction_index === b.instruction_index && a.wallet === b.wallet);
        },
      ),
    );
  });
});
