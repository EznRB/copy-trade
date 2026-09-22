/**
 * Provider factory — escolhe implementação por config, sempre atrás da
 * interface BlockchainDataProvider (nunca acoplar a provider específico).
 *
 * Prioridade: Helius (com API key) → WSS público Solana (mesmo protocolo,
 * HeliusProvider faz o fallback internamente) → SOLANA_RPC_WSS explícita.
 */
import { HeliusProvider } from '@ct/solana';
import type { BlockchainDataProvider } from '@ct/solana';
import type { AppConfig } from '@ct/config';
import type { LoggerLike } from '@ct/solana';

export interface DataProviderFactoryDeps {
  logger: LoggerLike;
}

export function createDataProvider(
  config: AppConfig,
  deps: DataProviderFactoryDeps,
): BlockchainDataProvider {
  return new HeliusProvider({
    logger: deps.logger,
    ...(config.HELIUS_API_KEY !== undefined ? { apiKey: config.HELIUS_API_KEY } : {}),
    ...(config.SOLANA_RPC_WSS !== undefined ? { wsUrl: config.SOLANA_RPC_WSS } : {}),
  });
}
