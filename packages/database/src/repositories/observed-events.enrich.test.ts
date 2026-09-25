/**
 * Testes dos metodos de enrichment do ObservedEvent (review 88152bbf/5299d25):
 * markEnriched, markUndecodable, findUnenriched, incrementEnrichAttempt.
 * Fakes em memoria; nunca importa o singleton prisma.
 */
import { describe, it, expect } from 'vitest';
import {
  markEnriched,
  markUndecodable,
  findUnenriched,
  incrementEnrichAttempt,
  type UnenrichedRow,
} from './observed-events.js';
import { RepositoryError } from './errors.js';

interface Row {
  id: string;
  signature: string;
  instructionIndex: number;
  wallet: string;
  enrichedAt: Date | null;
  enrichAttempts: number;
  receivedAt: Date;
  direction?: string | null;
  mint?: string | null;
}

/** Delegate fake com update guardado (TOCTOU), updateMany, findMany ordenado. */
function fakeDelegate(initial: Row[]) {
  const rows = [...initial];
  return {
    rows,
    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
      const r = rows.find((x) => x.id === args.where.id);
      if (!r) throw new Error('not found');
      Object.assign(r, args.data);
      return r;
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const { id, enrichedAt } = args.where as { id?: string; enrichedAt?: Date | null };
      let count = 0;
      for (const r of rows) {
        if (id !== undefined && r.id !== id) continue;
        if ('enrichedAt' in args.where) {
          if (enrichedAt === null) {
            if (r.enrichedAt !== null) continue;
          }
        }
        Object.assign(r, args.data);
        count++;
      }
      return { count };
    },
    async findMany(args: {
      where: Record<string, unknown>;
      orderBy: Record<string, unknown>;
      take: number;
      select: Record<string, boolean>;
    }): Promise<UnenrichedRow[]> {
      const out = rows
        .filter((r) => {
          const w = args.where as { enrichedAt?: null; enrichAttempts?: { lt?: number } };
          if (w.enrichedAt === null && r.enrichedAt !== null) return false;
          if (w.enrichAttempts && r.enrichAttempts >= (w.enrichAttempts.lt ?? Infinity))
            return false;
          return true;
        })
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
        .slice(0, args.take)
        .map((r) => ({
          id: r.id,
          signature: r.signature,
          instructionIndex: r.instructionIndex,
          wallet: r.wallet,
        }));
      return out;
    },
    async updateManyInc(args: { where: { id: string }; data: Record<string, unknown> }) {
      const r = rows.find((x) => x.id === args.where.id);
      if (!r) return { count: 0 };
      const inc = (args.data['enrichAttempts'] as { increment: number }).increment;
      r.enrichAttempts += inc;
      return { count: 1 };
    },
  };
}

const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  signature: id,
  instructionIndex: 0,
  wallet: 'W',
  enrichedAt: null,
  enrichAttempts: 0,
  receivedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('markEnriched', () => {
  it('persiste todos os campos + enrichedAt', async () => {
    const d = fakeDelegate([row('a')]);
    await markEnriched({ observedEvent: d }, {
      id: 'a',
      direction: 'buy',
      amountSol: '0.5',
      tokenAmount: '1000',
      mint: 'M'.repeat(44),
      counterparty: 'C'.repeat(44),
      enrichSource: 'pump-decoder-v1:pump_buy',
    });
    expect(d.rows[0]!.direction).toBe('buy');
    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
  });

  it('TOCTOU: escrita guardada nao sobrescreve evento ja enriquecido', async () => {
    const d = fakeDelegate([row('a', { enrichedAt: new Date() })]);
    await expect(
      markEnriched({ observedEvent: d }, {
        id: 'a',
        direction: 'sell',
        amountSol: '1',
        tokenAmount: '1',
        mint: 'M'.repeat(44),
        counterparty: 'C'.repeat(44),
        enrichSource: 'pump-decoder-v1:pump_sell',
      }),
    ).rejects.toThrowError(RepositoryError);
  });

  it('delegate sem updateMany cai no update simples (compat)', async () => {
    const d = fakeDelegate([row('a')]);
    const noUM = { ...d } as Omit<typeof d, 'updateMany'>;
    delete (noUM as Record<string, unknown>).updateMany;
    await markEnriched({ observedEvent: noUM }, {
      id: 'a',
      direction: 'buy',
      amountSol: null,
      tokenAmount: '10',
      mint: 'M'.repeat(44),
      counterparty: 'C'.repeat(44),
      enrichSource: 'pump-decoder-v1:pump_buy',
    });
    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
  });
});

describe('markUndecodable', () => {
  it('marca com reason truncada a 128 chars', async () => {
    const d = fakeDelegate([row('a')]);
    const long = 'x'.repeat(500);
    await markUndecodable({ observedEvent: d }, 'a', long);
    const src = (d.rows[0] as unknown as Record<string, unknown>)['enrichSource'] as string;
    expect(src.startsWith('undecodable:')).toBe(true);
    expect(src.length).toBeLessThanOrEqual(128);
    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
  });
});

describe('findUnenriched', () => {
  it('filtra enrichedAt null e enrichAttempts < max, ordena por receivedAt asc, respeita take', async () => {
    const d = fakeDelegate([
      row('old', { receivedAt: new Date('2026-01-01') }),
      row('new', { receivedAt: new Date('2026-02-01') }),
      row('enriched', { enrichedAt: new Date() }),
      row('maxed', { enrichAttempts: 5 }),
    ]);
    const out = await findUnenriched({ observedEvent: d }, { limit: 10, maxAttempts: 5 });
    expect(out.map((r) => r.id)).toEqual(['old', 'new']);
    const one = await findUnenriched({ observedEvent: d }, { limit: 1, maxAttempts: 5 });
    expect(one.map((r) => r.id)).toEqual(['old']);
  });
});

describe('incrementEnrichAttempt', () => {
  it('incrementa via updateMany', async () => {
    const d = fakeDelegate([row('a')]);
    // usa o updateMany de incremento do prisma (fake aproxima shape do Prisma)
    const shaped = {
      ...d,
      updateMany: d.updateManyInc.bind(d),
    };
    await incrementEnrichAttempt({ observedEvent: shaped }, 'a');
    expect(d.rows[0]!.enrichAttempts).toBe(1);
  });

  it('delegate sem updateMany lanca RepositoryError', async () => {
    const d = fakeDelegate([row('a')]);
    const noUM = { ...d } as Omit<typeof d, 'updateMany'>;
    delete (noUM as Record<string, unknown>).updateMany;
    await expect(incrementEnrichAttempt({ observedEvent: noUM }, 'a')).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});
