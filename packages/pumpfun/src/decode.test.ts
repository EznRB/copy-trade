/**
 * Testes do decoder F1.5 (ASCII-only). Caminho positivo + payloads adversariais
 * (truncado, contas fora de ordem/ausentes, mint invalido, discriminador nulo).
 * Tudo hostil DEVE retornar null sem throw (dados on-chain sao hostis).
 */
import { describe, it, expect } from 'vitest';
import { decodePumpInstruction } from './decode.js';
import {
  BUY_DISCRIMINATOR as PUMP_BUY,
  SELL_DISCRIMINATOR as PUMP_SELL,
  getBuyInstructionDataEncoder as pumpBuyEnc,
  getSellInstructionDataEncoder as pumpSellEnc,
} from './generated/pump/instructions/index.js';
import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
import {
  BUY_DISCRIMINATOR as AMM_BUY,
  SELL_DISCRIMINATOR as AMM_SELL,
  getBuyInstructionDataEncoder as ammBuyEnc,
  getSellInstructionDataEncoder as ammSellEnc,
} from './generated/pump_amm/instructions/index.js';
import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';

const A = (c: string, n: number) => c.repeat(n); // base58 valido
const MINT = A('M', 44);
const CURVE = A('C', 44);
const USER = A('U', 44);
const POOL = A('P', 44);
const FILLER = A('F', 32);

/** 16 contas validas na ordem da IDL pump.* (mint=2, curve=3, user=6). */
function pumpAccounts(): string[] {
  const acc = Array.from({ length: 16 }, () => FILLER);
  acc[2] = MINT;
  acc[3] = CURVE;
  acc[6] = USER;
  return acc;
}

/** 23 contas na ordem canonica da IDL pump_amm.* buy (pool=0, user=1, baseMint=3, quoteMint=4). */
function ammAccounts(): string[] {
  const acc = Array.from({ length: 23 }, () => FILLER);
  acc[0] = POOL;
  acc[1] = USER;
  acc[3] = MINT;
  acc[4] = 'So11111111111111111111111111111111111111112'; // quote = wSOL
  return acc;
}

function toBytes(x: ArrayLike<number>): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new Uint8Array(Array.from(x)).buffer as ArrayBuffer);
}
function buyData(): Uint8Array<ArrayBuffer> {
  return toBytes(pumpBuyEnc().encode({ amount: 1000n, maxSolCost: 5000n, trackVolume: [false] }));
}
function sellData(): Uint8Array<ArrayBuffer> {
  return toBytes(pumpSellEnc().encode({ amount: 777n, minSolOutput: 42n }));
}
function ammBuyData(): Uint8Array<ArrayBuffer> {
  return toBytes(ammBuyEnc().encode({ baseAmountOut: 9n, maxQuoteAmountIn: 99n, trackVolume: [false] }));
}
function ammSellData(): Uint8Array<ArrayBuffer> {
  return toBytes(ammSellEnc().encode({ baseAmountIn: 11n, minQuoteAmountOut: 22n }));
}

describe('decoder F1.5 - caminho positivo (sintetico)', () => {
  it('pump buy decodifica kind/mint/user/amounts', () => {
    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), pumpAccounts());
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('pump_buy');
    expect(d!.direction).toBe('buy');
    expect(d!.mint).toBe(MINT);
    expect(d!.user).toBe(USER);
    expect(d!.counterparty).toBe(CURVE);
    expect(d!.tokenAmount).toBe('1000');
    expect(d!.solAmount).toBe('5000');
  });

  it('pump sell decodifica', () => {
    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), pumpAccounts());
    expect(d!.kind).toBe('pump_sell');
    expect(d!.direction).toBe('sell');
    expect(d!.tokenAmount).toBe('777');
    expect(d!.solAmount).toBe('42');
  });

  it('pumpswap buy decodifica pool/baseMint', () => {
    const d = decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), ammAccounts());
    expect(d!.kind).toBe('pumpswap_buy');
    expect(d!.mint).toBe(MINT);
    expect(d!.counterparty).toBe(POOL);
    expect(d!.tokenAmount).toBe('9');
    expect(d!.solAmount).toBe('99');
  });

  it('pool base=wSOL inverte o lado do token (fixtures reais): sell de ix = buy do token', () => {
    const acc = ammAccounts();
    acc[3] = 'So11111111111111111111111111111111111111112'; // baseMint = wSOL
    acc[4] = MINT; // quoteMint = token real
    const d = decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), acc);
    // buy da instrucao (baseOut=wSOL) => usuario RECEBE wSOL e da token = sell semantico
    expect(d!.direction).toBe('sell');
    expect(d!.kind).toBe('pumpswap_sell');
    expect(d!.mint).toBe(MINT);
    expect(d!.solAmount).toBe('9'); // baseAmountOut (lado wSOL)
    expect(d!.tokenAmount).toBeNull(); // quoteMint e o token; amount da instrucao e do lado wSOL
  });
});

describe('decoder F1.5 - payloads adversariais (null, nunca throw)', () => {
  it('data vazia', () => {
    expect(
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, new Uint8Array(0), pumpAccounts()),
    ).toBeNull();
  });

  it('instrucao truncada (4 bytes)', () => {
    expect(
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData().slice(0, 4), pumpAccounts()),
    ).toBeNull();
  });

  it('discriminador conhecido mas payload truncado', () => {
    expect(
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, new Uint8Array(PUMP_BUY), pumpAccounts()),
    ).toBeNull();
  });

  it('discriminador desconhecido', () => {
    expect(
      decodePumpInstruction(
        PUMP_PROGRAM_ADDRESS,
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0]),
        pumpAccounts(),
      ),
    ).toBeNull();
  });

  it('contas ausentes (5 em vez de 16)', () => {
    expect(
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), pumpAccounts().slice(0, 5)),
    ).toBeNull();
  });

  it('contas fora de ordem (mint invalido na posicao 2)', () => {
    const acc = pumpAccounts();
    acc[2] = 'INVALID!';
    expect(decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), acc)).toBeNull();
  });

  it('mint nao-base58 rejeitado', () => {
    const acc = pumpAccounts();
    acc[2] = '0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl';
    expect(decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), acc)).toBeNull();
  });

  it('programa desconhecido retorna null', () => {
    expect(
      decodePumpInstruction(
        'So11111111111111111111111111111111111111112',
        buyData(),
        pumpAccounts(),
      ),
    ).toBeNull();
  });

  it('AMM com contas insuficientes', () => {
    expect(
      decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), ammAccounts().slice(0, 10)),
    ).toBeNull();
  });

  it('bytes arbitrarios nao-throw', () => {
    const bad = new Uint8Array(ammBuyData());
    bad.set(AMM_BUY.slice(), 0);
    bad.set([1, 2, 3, 4], 8);
    expect(() =>
      decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, bad, ammAccounts()),
    ).not.toThrow();
  });
});

describe('decoder F1.5 - gates por contagem canonica da IDL (review A-1)', () => {
  it('pump SELL com exatas 14 contas (IDL) decodifica', () => {
    const acc14 = pumpAccounts().slice(0, 14);
    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), acc14);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('pump_sell');
    expect(d!.mint).toBe(MINT);
  });

  it('pump sell com 13 contas (abaixo da IDL) retorna null', () => {
    expect(
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), pumpAccounts().slice(0, 13)),
    ).toBeNull();
  });

  it('pump_amm SELL com exatas 21 contas (IDL) decodifica', () => {
    const acc21 = ammAccounts().slice(0, 21);
    const d = decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammSellData(), acc21);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('pumpswap_sell');
    expect(AMM_SELL).toHaveLength(8);
  });
});

describe('decoder F1.5 - discriminadores da IDL oficial', () => {
  it('pump/pumpswap discriminators existem com 8 bytes', () => {
    expect(PUMP_BUY).toHaveLength(8);
    expect(PUMP_SELL).toHaveLength(8);
    expect(AMM_BUY).toHaveLength(8);
  });
});
