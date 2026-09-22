/**
 * Contratos do pipeline de observação on-chain (interface do provider).
 */

export interface ObservedChainEvent {
  signature: string;
  instructionIndex: number;
  wallet: string;
  slot?: bigint;
  blockTime?: Date;
  payload: unknown;
}

export type EventCallback = (event: ObservedChainEvent) => void;

export interface BlockchainDataProvider {
  connect(): Promise<void>;
  subscribeWallets(wallets: string[]): Promise<void>;
  onEvent(cb: EventCallback): void;
  close(): Promise<void>;
}
