/**
 * @ct/backtester — Fase 5.
 *
 * Interface do motor de replay histórico. Ainda sem implementação.
 */

/**
 * Resultado bruto por trade simulado — sempre decomposto, nunca PnL bruto isolado.
 */
export interface SimulatedTradePnl {
  grossPnl: bigint;
  fees: bigint;
  slippage: bigint;
  priorityFees: bigint;
  tips: bigint;
  netPnl: bigint;
}

export interface BacktestEngine {
  /**
   * TODO(FASE-5): replay histórico de sinais com realismo obrigatório:
   * - delay de detecção e latência de execução modelados explicitamente
   *   (não assumir execução no preço do evento master);
   * - slippage e impacto de pool por cenário;
   * - fees + priority + tips descontados por trade;
   * - COPY_EXECUTED_PRICE nunca pode ser o MASTER_PRICE:
   *     o preço de execução da cópia é SEMPRE pior (mais caro na compra,
   *     mais barato na venda) que o preço do master, por regra estrutural
   *     do AMM + delay. Qualquer simulação que use MASTER_PRICE como
   *     COPY_EXECUTED_PRICE é inválida e deve falhar.
   * - walk-forward obrigatório; nunca random split.
   * - nunca excluir losers do replay (survivorship bias proibido).
   */
  run(): Promise<never>;
}
