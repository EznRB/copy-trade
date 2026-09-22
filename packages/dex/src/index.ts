/**
 * @ct/dex — Abstração de roteamento/quoting de DEXs Solana.
 *
 * TODO(FASE-9): implementar Raydium / Jupiter / PumpSwap SOMENTE após
 * verificar documentação oficial de cada venue. Nada aqui chama rede.
 */

export type DexVenue = 'raydium' | 'jupiter' | 'pumpswap';

export interface QuoteInput {
  mintIn: string;
  mintOut: string;
  amountInLamports: bigint;
  slippageBps: number;
}

export interface QuoteResult {
  venue: DexVenue;
  amountOutExpectedLamports: bigint;
  priceImpactPct?: number;
  estimatedFeeLamports?: bigint;
}

export interface BuildSwapRequest {
  quote: QuoteResult;
  wallet: string;
  correlationId: string;
}

export interface BuiltSwap {
  /** Transação serializada (formato definido pelo venue — UNKNOWN até Fase 9). */
  transaction: unknown;
}

export interface DexRouter {
  readonly venue: DexVenue;
  quote(input: QuoteInput): Promise<QuoteResult>;
  buildSwap(request: BuildSwapRequest): Promise<BuiltSwap>;
}

export class UnimplementedDexRouter implements DexRouter {
  constructor(readonly venue: DexVenue) {}

  quote(_input: QuoteInput): Promise<QuoteResult> {
    throw new Error(
      `TODO(FASE-9): quote para ${this.venue} não implementado — verificar docs oficiais`,
    );
  }

  buildSwap(_request: BuildSwapRequest): Promise<BuiltSwap> {
    throw new Error(`TODO(FASE-9): buildSwap para ${this.venue} não implementado`);
  }
}
