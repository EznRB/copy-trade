/**
 * Testes do enricher F1.5 (ASCII-only). Base58, extracao de instrucoes
 * (outer+inner), caminhos de erro e idempotencia — dados hostis nunca throw.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  base58ToBytes,
  collectInstructionCalls,
  Enricher,
  type ParsedTx,
  type EnrichStore,
  type TxFetcher,
} from './enricher.js';
import { PUMP_BUY_ENCODER_FOR_TESTS as pumpBuyEnc, PUMP_PROGRAM_ADDRESS } from '@ct/pumpfun';

const A = (c: string, n: number) => c.repeat(n);
const MINT = A('M', 44);
const CURVE = A('C', 44);
const USER = A('U', 44);
const FILLER = A('F', 32);
const SIG = '5'.repeat(88);

function base58(bytes: number[]): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = alphabet[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out || '1';
}

/** Monta uma tx jsonParsed parcial com uma instrucao pump.buy valida. */
function makeTxWithPumpBuy(): ParsedTx {
  const dataBytes = new Uint8Array(
    pumpBuyEnc().encode({ amount: 1000n, maxSolCost: 5000n, trackVolume: [false] }),
  );
  const accounts = Array.from({ length: 16 }, () => FILLER);
  accounts[2] = MINT;
  accounts[3] = CURVE;
  accounts[6] = USER;
  const allKeys = [PUMP_PROGRAM_ADDRESS, ...new Set(accounts)];
  const msgKeys = allKeys.map((pubkey) => ({ pubkey }));
  const accountIndexes = accounts.map((a) => allKeys.indexOf(a));
  return {
    transaction: {
      message: {
        accountKeys: msgKeys,
        instructions: [
          {
            programId: PUMP_PROGRAM_ADDRESS,
            accounts: accountIndexes as unknown as string[],
            data: base58(Array.from(dataBytes)),
          },
        ],
      },
    },
    meta: { innerInstructions: [] },
  };
}

function fakeStore(): EnrichStore & { calls: { m: string[]; u: string[] } } {
  const calls = { m: [] as string[], u: [] as string[] };
  return {
    calls,
    async markEnriched(id) {
      calls.m.push(id);
    },
    async markUndecodable(id) {
      calls.u.push(id);
    },
    async bumpAttempt() {},
  };
}

describe('base58ToBytes', () => {
  it('round-trip com o encoder de teste', () => {
    const raw = [1, 2, 3, 4, 5, 6, 7, 8, 200, 0, 255];
    const s = base58(raw);
    const back = base58ToBytes(s);
    expect(back).toEqual(Uint8Array.from(raw));
  });
  it('rejeita nao-base58', () => {
    expect(base58ToBytes('0OIl')).toBeNull();
    expect(base58ToBytes('')).toBeNull();
  });
});

describe('collectInstructionCalls', () => {
  it('extrai instrucao pump.buy com programId/contas/data', () => {
    const tx = makeTxWithPumpBuy();
    const calls = collectInstructionCalls(tx);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.programId).toBe(PUMP_PROGRAM_ADDRESS);
    expect(calls[0]!.accounts[2]).toBe(MINT);
    expect(calls[0]!.data.length).toBeGreaterThan(8);
  });

  it('tx sem message e nula', () => {
    expect(collectInstructionCalls({} as ParsedTx)).toEqual([]);
    expect(collectInstructionCalls(null as unknown as ParsedTx)).toEqual([]);
  });

  it('instrucao com conta fantasma e descartada (sem throw)', () => {
    const tx = makeTxWithPumpBuy();
    const ix = tx.transaction!.message!.instructions![0]!;
    (ix as unknown as { accounts: number[] }).accounts = [9999, 8888]; // indices invalidos
    expect(collectInstructionCalls(tx)).toEqual([]);
  });
});

describe('Enricher', () => {
  it('enriquece quando encontra pump.buy', async () => {
    const fetcher: TxFetcher = { getTransaction: async () => makeTxWithPumpBuy() };
    const store = fakeStore();
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const en = new Enricher(fetcher, store, log);
    const r = await en.enrich('row1', SIG);
    expect(r).toBe('enriched');
    expect(store.calls.m).toEqual(['row1']);
  });

  it('marca undecodable quando nada decodifica', async () => {
    const fetcher: TxFetcher = {
      getTransaction: async () =>
        ({ transaction: { message: { accountKeys: [], instructions: [] } }, meta: {} }) as ParsedTx,
    };
    const store = fakeStore();
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const en = new Enricher(fetcher, store, log);
    expect(await en.enrich('row2', SIG)).toBe('undecodable');
    expect(store.calls.u).toEqual(['row2']);
  });

  it('erro de RPC => retry (nunca marca undecodable em falha transitoria)', async () => {
    const fetcher: TxFetcher = {
      getTransaction: async () => {
        throw new Error('429');
      },
    };
    const store = fakeStore();
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const en = new Enricher(fetcher, store, log);
    expect(await en.enrich('row3', SIG)).toBe('retry');
    expect(store.calls.u).toEqual([]);
    expect(store.calls.m).toEqual([]);
  });
});
