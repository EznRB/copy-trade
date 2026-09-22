/**
 * @ct/types — contratos canônicos do sistema.
 * Regra: nenhum tipo aqui depende de provider externo.
 */

/** Modos de operação (AGENTS.md §3). Default absoluto: PAPER. */
export type TradingMode = 'PAPER' | 'SHADOW' | 'LIVE';

/** Ação detectada em um evento on-chain. UNKNOWN nunca deve ser tratado como inofensivo. */
export type EventAction = 'BUY' | 'SELL' | 'TRANSFER' | 'CREATE' | 'UNKNOWN';

/** Classificação comportamental de wallets. INSIDER_CANDIDATE nunca afirma insider como fato. */
export type WalletClassification =
  | 'SNIPER'
  | 'SCALPER'
  | 'SWING'
  | 'SMART_MONEY'
  | 'KOL'
  | 'DEV'
  | 'INSIDER_CANDIDATE'
  | 'BOT'
  | 'COPY_TRADER'
  | 'UNKNOWN';

/** Estados do ciclo de vida de uma transação (§47). */
export type TransactionStatus =
  'CREATED' | 'SIGNED' | 'SUBMITTED' | 'LANDED' | 'FAILED' | 'EXPIRED' | 'UNKNOWN';

/** Classes de erro classificadas (AGENTS.md §6). Nunca erro genérico sem classe. */
export type ErrorClass =
  | 'DATA_ERROR'
  | 'RPC_ERROR'
  | 'EXECUTION_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'CONFIG_ERROR'
  | 'SECURITY_ERROR'
  | 'STRATEGY_ERROR'
  | 'UNKNOWN_ERROR';

/** Decisão final de um sinal. BLOCK sempre carrega motivo. */
export type SignalDecision = 'BUY' | 'BLOCK' | 'IGNORE';

/** Severidade de regra (§30). */
export type RuleKind = 'HARD_RULE' | 'SOFT_RULE' | 'INFORMATIONAL';

/**
 * Evento normalizado — contrato único do pipeline (§16).
 * Campos indisponíveis são null. NUNCA estimar silenciosamente.
 */
export interface NormalizedEvent {
  event_id: string;
  correlation_id: string;
  /** Provider de origem (ex.: 'helius_wss', 'rpc'). */
  source: string;
  wallet: string;
  signature: string;
  instruction_index: number;
  slot: number;
  block_time: number | null;
  detected_at: number;
  processed_at: number | null;
  token_mint: string;
  action: EventAction;
  sol_amount: number | null;
  token_amount: number | null;
  price: number | null;
  market_cap: number | null;
  liquidity: number | null;
  latency_ms: number | null;
}

/**
 * Chave de deduplicação (§17). Formato: `${signature}:${instruction_index}:${wallet}`.
 */
export function dedupKey(
  e: Pick<NormalizedEvent, 'signature' | 'instruction_index' | 'wallet'>,
): string {
  return `${e.signature}:${e.instruction_index}:${e.wallet}`;
}

/** Marca de tempo por estágio do pipeline de execução (§41). */
export interface LatencyTrace {
  source_detected_at: number;
  local_received_at?: number;
  parsed_at?: number;
  feature_ready_at?: number;
  signal_at?: number;
  transaction_built_at?: number;
  submitted_at?: number;
  landed_at?: number;
}
