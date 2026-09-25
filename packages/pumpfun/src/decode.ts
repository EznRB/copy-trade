/**
 * decode.ts — decoder F1.5 sobre os clientes gerados por codama a partir da
 * IDL oficial pump-fun/pump-public-docs (ADR-016: fonte oficial; ADR-020:
 * codama em vez de discriminadores à mão).
 *
 * Regras (dados on-chain hostis):
 * - NUNCA lança exceção em input adversarial — retorna null.
 * - Endereços validados com allowlist base58 (RT-004/006 mantidos fechados).
 * - Valores numéricos da instrução são PARÂMETROS/LIMITES da instrução
 *   (amount = tokens; em buy, sol = maxSolCost/maxQuoteAmountIn; em sell,
 *   sol = minSolOutput/minQuoteAmountOut) — NÃO são valores realizados.
 *   Valores realizados vêm de balance changes (fora do escopo deste decoder).
 */
import { z } from 'zod';
import {
  BUY_DISCRIMINATOR as PUMP_BUY,
  SELL_DISCRIMINATOR as PUMP_SELL,
  getBuyInstructionDataDecoder as pumpBuyDecoder,
  getSellInstructionDataDecoder as pumpSellDecoder,
} from './generated/pump/instructions/index.js';
import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
import {
  BUY_DISCRIMINATOR as AMM_BUY,
  SELL_DISCRIMINATOR as AMM_SELL,
  getBuyInstructionDataDecoder as ammBuyDecoder,
  getSellInstructionDataDecoder as ammSellDecoder,
} from './generated/pump_amm/instructions/index.js';
import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const addressSchema = z.string().regex(BASE58);

export interface DecodedSwap {
  kind: 'pump_buy' | 'pump_sell' | 'pumpswap_buy' | 'pumpswap_sell';
  direction: 'buy' | 'sell';
  mint: string;
  user: string;
  /** Bonding curve (pump.*) ou pool AMM (pumpswap.*). */
  counterparty: string;
  /** Tokens em unidades base (instrução `amount`/`baseAmount*`). */
  tokenAmount: string | null;
  /** SOL em lamports — LIMITE da instrução (maxSolCost / minSolOutput etc.), não realizado. */
  solAmount: string | null;
}

function discEq(data: ArrayLike<number>, disc: ArrayLike<number>): boolean {
  if (data.length < 8 || disc.length < 8) return false;
  for (let i = 0; i < 8; i++) if (data[i] !== disc[i]) return false;
  return true;
}

function validAddr(a: unknown): a is string {
  return typeof a === 'string' && addressSchema.safeParse(a).success;
}

/** Contas mínimas esperadas: pump.buy/sell = 16; pump_amm.buy/sell = 22. */
const PUMP_MIN_ACCOUNTS = 16;
const AMM_MIN_ACCOUNTS = 22;

export function decodePumpInstruction(
  programId: string,
  data: ArrayLike<number>,
  accounts: string[],
): DecodedSwap | null {
  try {
    // Normaliza para Uint8Array: os decoders do codama exigem Uint8Array.
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(Array.from(data));
    if (programId === PUMP_PROGRAM_ADDRESS) {
      if (accounts.length < PUMP_MIN_ACCOUNTS) return null;
      // IDL: mint=2, bondingCurve=3, user=6
      const mint = accounts[2];
      const counterparty = accounts[3];
      const user = accounts[6];
      if (!validAddr(mint) || !validAddr(counterparty) || !validAddr(user)) return null;

      if (discEq(bytes, PUMP_BUY)) {
        const d = pumpBuyDecoder().decode(bytes);
        return {
          kind: 'pump_buy',
          direction: 'buy',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.maxSolCost.toString(),
        };
      }
      if (discEq(bytes, PUMP_SELL)) {
        const d = pumpSellDecoder().decode(bytes);
        return {
          kind: 'pump_sell',
          direction: 'sell',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.minSolOutput.toString(),
        };
      }
      return null;
    }

    if (programId === PUMP_AMM_PROGRAM_ADDRESS) {
      if (accounts.length < AMM_MIN_ACCOUNTS) return null;
      // IDL: pool=0, user=1, baseMint=3, quoteMint=4
      const counterparty = accounts[0];
      const user = accounts[1];
      const baseMint = accounts[3];
      const quoteMint = accounts[4];
      if (!validAddr(baseMint) || !validAddr(quoteMint) || !validAddr(counterparty) || !validAddr(user)) return null;

      const WSOL = 'So11111111111111111111111111111111111111112';
      // Normalização pelo lado do TOKEN (review 2ab477f/fixtures): se a base
      // do pool for wSOL, a semântica buy/sell da instrução se inverte do ponto
      // de vista do token (usuário dá wSOL e recebe token => buy do token).
      const quoteIsWsol = quoteMint === WSOL;
      const baseIsWsol = baseMint === WSOL;
      const tokenMint = quoteIsWsol ? baseMint! : baseIsWsol ? quoteMint! : baseMint!;

      const mapDirection = (ix: 'buy' | 'sell'): 'buy' | 'sell' => {
        if (baseIsWsol) return ix === 'buy' ? 'sell' : 'buy'; // invertido
        return ix;
      };
      const mapKind = (ix: 'buy' | 'sell'): DecodedSwap['kind'] =>
        mapDirection(ix) === 'buy' ? 'pumpswap_buy' : 'pumpswap_sell';

      if (discEq(bytes, AMM_BUY)) {
        const d = ammBuyDecoder().decode(bytes);
        // quoteIn = wSOL gasto (se quote=wSOL); token = baseAmountOut.
        return {
          kind: mapKind('buy'),
          direction: mapDirection('buy'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountOut.toString() : null,
          solAmount: quoteIsWsol ? d.maxQuoteAmountIn.toString() : d.baseAmountOut.toString(),
        };
      }
      if (discEq(bytes, AMM_SELL)) {
        const d = ammSellDecoder().decode(bytes);
        // baseIn = token vendido (se quote=wSOL); quoteOut = wSOL recebido.
        return {
          kind: mapKind('sell'),
          direction: mapDirection('sell'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountIn.toString() : null,
          solAmount: quoteIsWsol ? d.minQuoteAmountOut.toString() : d.baseAmountIn.toString(),
        };
      }
      return null;
    }

    return null; // programa desconhecido — UNKNOWN, nunca inferido
  } catch {
    // Dados hostis/truncados: decode falhou — null, nunca throw.
    return null;
  }
}
