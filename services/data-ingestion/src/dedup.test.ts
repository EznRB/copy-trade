import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DedupStore, isUniqueConstraintError } from './dedup-store.js';
import { dedupKey } from '@ct/types';

/** prisma.observedEvent in-memory com unique constraint simulada. */
function makeMockRepo() {
  const rows = new Map<string, unknown>();
  return {
    rows,
    async create(args: { data: { signature: string; instructionIndex: number; wallet: string } }) {
      const key = dedupKey({
        signature: args.data.signature,
        instruction_index: args.data.instructionIndex,
        wallet: args.data.wallet,
      });
      if (rows.has(key)) {
        const err = new Error('Unique constraint failed');
        (err as Error & { code: string }).code = 'P2002';
        throw err;
      }
      rows.set(key, args.data);
      return {};
    },
  };
}

const record = (sig: string, w = 'W', i = 0) => ({
  eventId: `e-${sig}`,
  correlationId: 'c',
  source: 'test',
  wallet: w,
  signature: sig,
  instructionIndex: i,
  slot: 1,
  blockTime: null,
  detectedAt: new Date(0),
  tokenMint: 'UNKNOWN',
  action: 'UNKNOWN',
});

describe('DedupStore', () => {
  it('duplicata não persiste 2x (unique constraint)', async () => {
    const repo = makeMockRepo();
    const store = new DedupStore(repo);
    const r1 = await store.checkAndPersist('sig1:0:W', record('sig1'));
    const r2 = await store.checkAndPersist('sig1:0:W', record('sig1'));
    expect(r1.status).toBe('new');
    expect(r2.status).toBe('duplicate');
    expect(repo.rows.size).toBe(1);
    expect(store.counters.ingested).toBe(1);
    expect(store.counters.deduplicated).toBe(1);
  });

  it('erro não-unique é classificado como error', async () => {
    const store = new DedupStore({
      async create() {
        throw new Error('connection lost');
      },
    });
    const r = await store.checkAndPersist('k', record('s'));
    expect(r.status).toBe('error');
    expect(store.counters.errors).toBe(1);
    expect(isUniqueConstraintError({ code: 'P2002' })).toBe(true);
  });

  it('property: N ingestões com duplicatas → persistidos == chaves únicas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.nat(), fc.string({ minLength: 1 })), {
          minLength: 0,
          maxLength: 40,
        }),
        async (tuples) => {
          const repo = makeMockRepo();
          const store = new DedupStore(repo);
          for (const [sig, i, w] of tuples) {
            const rec = record(sig, w, i);
            const key = dedupKey({ signature: sig, instruction_index: i, wallet: w });
            await store.checkAndPersist(key, rec);
          }
          const unique = new Set(tuples.map(([s, i, w]) => `${s}:${i}:${w}`)).size;
          expect(repo.rows.size).toBe(unique);
          expect(store.counters.ingested).toBe(unique);
          expect(store.counters.deduplicated).toBe(tuples.length - unique);
        },
      ),
    );
  });
});
