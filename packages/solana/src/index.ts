/**
 * @ct/solana — providers de acesso à blockchain Solana (Fase 1).
 *
 * - RpcProvider: JSON-RPC padrão Solana via fetch, com failover
 *   primary → secondary → tertiary e retry com backoff + jitter.
 * - HeliusProvider: stream WSS (Helius Enhanced Websockets ou WSS público
 *   Solana como fallback) via logsSubscribe com mentions.
 *
 * Zero lógica de trading. Nenhum endpoint inventado: apenas JSON-RPC Solana
 * documentado e endpoints públicos Helius/Solana.
 */

export type { ObservedChainEvent, EventCallback, BlockchainDataProvider } from './chain-event.js';

export {
  ExponentialBackoff,
  backoffBase,
  computeBackoffDelay,
  resolveBackoffOptions,
  sleep,
  type BackoffOptions,
  type ResolvedBackoffOptions,
} from './backoff.js';

export {
  ClassifiedError,
  RpcProvider,
  type LoggerLike,
  type RpcHealth,
  type RpcEndpoint,
  type RpcFailoverEvent,
  type RpcProviderOptions,
  type SignatureInfo,
  type SignaturePage,
  type GetSignaturesOptions,
} from './rpc-provider.js';

export {
  HeliusProvider,
  HELIUS_HTTP_BASE,
  buildHeliusHttpUrl,
  buildHeliusWsUrl,
  type HeliusProviderOptions,
  type RawTransactionNotification,
  type RawEventCallback,
} from './helius-provider.js';
