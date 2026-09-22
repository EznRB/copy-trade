/**
 * HeliusProvider — stream de transações via WebSocket.
 *
 * FACT (documentação Helius Enhanced Websockets): endpoint
 *   wss://atlas-mainnet.helius-rpc.com?api-key=<HELIUS_API_KEY>
 * aceita os mesmos métodos de subscription do WSS padrão da Solana
 * (logsSubscribe / logsUnsubscribe), com filtro `mentions` por endereço.
 * Fallback: sem API key, conecta no WSS padrão da Solana
 * (wss://api.mainnet-beta.solana.com) — o formato das mensagens é o mesmo
 * (JSON-RPC 2.0, notificação `logsNotification`).
 *
 * Referência HTTP Helius (para uso futuro do rpc-provider):
 *   https://mainnet.helius-rpc.com/?api-key=<KEY>
 *
 * Features:
 * - logsSubscribe com { mentions: wallets } e commitment configurável.
 * - Reconnect com backoff exponencial + jitter (cap 30s).
 * - Heartbeat: ping a cada 30s; se nenhuma mensagem por 60s → reconnect forçado.
 * - Emite eventos crus RawTransactionNotification { signature, slot, value }.
 *   Nenhuma interpretação/normalização aqui (responsabilidade da camada superior).
 */

import { WebSocket } from 'ws';
import { ExponentialBackoff } from './backoff.js';
import { ClassifiedError, type LoggerLike } from './rpc-provider.js';
import type { BlockchainDataProvider, EventCallback, ObservedChainEvent } from './chain-event.js';

/** Payload bruto de uma notificação logsNotification (campos crus, sem interpretação). */
export interface RawTransactionNotification {
  signature: string;
  slot: number;
  /** `value` cru do result da notificação (err, logs, etc.) — dados hostis, validar downstream. */
  value: unknown;
}

export type RawEventCallback = (notification: RawTransactionNotification) => void;

export interface HeliusProviderOptions {
  logger: LoggerLike;
  /** API key Helius. Se ausente, usa WSS público da Solana. */
  apiKey?: string;
  /** Override de URL WSS (ex.: devnet). Tem precedência sobre apiKey. */
  wsUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Intervalo de ping em ms. Default 30_000. */
  pingIntervalMs?: number;
  /** Silêncio máximo antes de forçar reconnect, em ms. Default 60_000. */
  silenceTimeoutMs?: number;
  /** Backoff de reconnect injetável (testes). */
  backoff?: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: () => number };
  /** Fábrica de WebSocket injetável (testes). */
  webSocketFactory?: (url: string) => WebSocket;
}

const HELIUS_WSS_BASE = 'wss://atlas-mainnet.helius-rpc.com';
const SOLANA_PUBLIC_WSS = 'wss://api.mainnet-beta.solana.com';

interface LogsNotificationValue {
  signature?: unknown;
  err?: unknown;
  logs?: unknown;
}

interface JsonRpcNotification {
  jsonrpc?: string;
  method?: string;
  params?: {
    result?: {
      context?: { slot?: unknown };
      value?: LogsNotificationValue;
    };
    subscription?: unknown;
  };
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export class HeliusProvider implements BlockchainDataProvider {
  private readonly logger: LoggerLike;
  private readonly wsUrl: string;
  private readonly commitment: 'processed' | 'confirmed' | 'finalized';
  private readonly pingIntervalMs: number;
  private readonly silenceTimeoutMs: number;
  private readonly backoffOpts: HeliusProviderOptions['backoff'];
  private readonly wsFactory: (url: string) => WebSocket;
  private readonly rawListeners: RawEventCallback[] = [];
  private readonly eventListeners: EventCallback[] = [];
  private readonly wallets = new Set<string>();

  private ws: WebSocket | null = null;
  private subscriptionId: number | null = null;
  private nextRequestId = 1;
  private reconnectBackoff: ExponentialBackoff;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private closed = false;
  private connected = false;

  constructor(options: HeliusProviderOptions) {
    this.logger = options.logger;
    this.commitment = options.commitment ?? 'confirmed';
    this.pingIntervalMs = options.pingIntervalMs ?? 30_000;
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 60_000;
    this.backoffOpts = options.backoff;
    this.wsFactory = options.webSocketFactory ?? ((url: string) => new WebSocket(url));
    this.reconnectBackoff = new ExponentialBackoff(this.backoffOpts);
    if (options.wsUrl !== undefined) {
      this.wsUrl = options.wsUrl;
    } else if (options.apiKey !== undefined && options.apiKey.length > 0) {
      this.wsUrl = `${HELIUS_WSS_BASE}?api-key=${encodeURIComponent(options.apiKey)}`;
    } else {
      // ASSUMPTION: fallback no WSS público Solana — mesmo formato de mensagem.
      this.wsUrl = SOLANA_PUBLIC_WSS;
      this.logger.warn('HELIUS_API_KEY ausente — usando WSS público Solana (rate limits menores)');
    }
  }

  onRawEvent(cb: RawEventCallback): void {
    this.rawListeners.push(cb);
  }

  /**
   * Adaptação para a interface BlockchainDataProvider: emite ObservedChainEvent
   * com os campos conhecidos (signature/slot) e desconhecidos como neutros
   * (instructionIndex 0, wallet ''): logsNotification não identifica a wallet
   * específica mencionada — a resolução é responsabilidade da camada de
   * normalização downstream (ver .agents/solana-ingestion.md §2).
   */
  onEvent(cb: EventCallback): void {
    this.eventListeners.push(cb);
  }

  connect(): Promise<void> {
    this.closed = false;
    return this.openSocket();
  }

  async subscribeWallets(wallets: string[]): Promise<void> {
    for (const w of wallets) {
      if (typeof w !== 'string' || w.length === 0) {
        throw new ClassifiedError('VALIDATION_ERROR', 'wallet inválida em subscribeWallets');
      }
      this.wallets.add(w);
    }
    if (this.connected) {
      await this.sendLogsSubscribe();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    this.subscriptionId = null;
    if (ws) {
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        try {
          ws.close();
        } catch {
          resolve();
        }
        // Não esperar indefinidamente o close handshake.
        setTimeout(resolve, 2_000).unref();
      });
    }
  }

  // ---------------------------------------------------------------- internals

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = this.wsFactory(this.wsUrl);
      this.ws = ws;

      const onOpen = (): void => {
        this.connected = true;
        this.lastMessageAt = Date.now();
        this.reconnectBackoff.reset();
        this.startHeartbeat();
        this.logger.info('wss conectado', { urlHost: safeHost(this.wsUrl) });
        void this.sendLogsSubscribe()
          .then(() => resolve())
          .catch((err: unknown) => reject(err));
      };

      ws.once('open', onOpen);
      ws.once('error', (err) => {
        if (!this.connected) {
          reject(
            new ClassifiedError('RPC_ERROR', `wss falha ao conectar: ${err.message}`, err),
          );
        }
      });

      ws.on('message', (data: unknown) => this.handleMessage(data));
      ws.on('pong', () => {
        this.lastMessageAt = Date.now();
      });
      ws.on('close', (code: number, reason: Buffer) => {
        this.connected = false;
        this.subscriptionId = null;
        this.clearTimers();
        this.logger.warn('wss fechado', { code, reason: reason.toString() });
        this.scheduleReconnect();
      });
      ws.on('error', (err: Error) => {
        this.logger.error('wss erro', { error: err.message });
      });
    });
  }

  private sendLogsSubscribe(): Promise<void> {
    if (this.wallets.size === 0 || this.ws === null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'logsSubscribe',
        params: [
          { mentions: [...this.wallets] },
          { commitment: this.commitment },
        ],
      });
      const ws = this.ws;
      if (!ws) {
        resolve();
        return;
      }
      ws.send(message, (err?: Error) => {
        if (err) {
          reject(new ClassifiedError('RPC_ERROR', `logsSubscribe falhou: ${err.message}`, err));
          return;
        }
        // Confirmação chega como resposta JSON-RPC com result = subscription id;
        // resolução ocorre em handleMessage via pending map simplificado:
        this.pendingSubscribes.set(id, { resolve, reject });
      });
    });
  }

  private readonly pendingSubscribes = new Map<
    number,
    { resolve: () => void; reject: (e: Error) => void }
  >();

  private handleMessage(data: unknown): void {
    this.lastMessageAt = Date.now();
    let text: string;
    if (typeof data === 'string') {
      text = data;
    } else if (Buffer.isBuffer(data)) {
      text = data.toString('utf8');
    } else if (Array.isArray(data)) {
      text = Buffer.concat(data).toString('utf8');
    } else {
      this.logger.warn('wss mensagem de tipo inesperado descartada');
      return;
    }

    let parsed: JsonRpcNotification;
    try {
      parsed = JSON.parse(text) as JsonRpcNotification;
    } catch {
      this.logger.warn('wss mensagem não-JSON descartada');
      return;
    }

    // Resposta a logsSubscribe
    if (parsed.id !== undefined && this.pendingSubscribes.has(Number(parsed.id))) {
      const pending = this.pendingSubscribes.get(Number(parsed.id));
      this.pendingSubscribes.delete(Number(parsed.id));
      if (parsed.error) {
        pending?.reject(
          new ClassifiedError(
            'RPC_ERROR',
            `logsSubscribe rejeitado: ${parsed.error.message}`,
          ),
        );
      } else {
        if (typeof parsed.result === 'number') this.subscriptionId = parsed.result;
        this.logger.info('logsSubscribe ativo', {
          subscriptionId: this.subscriptionId,
          wallets: this.wallets.size,
        });
        pending?.resolve();
      }
      return;
    }

    // Notificação de logs
    if (parsed.method === 'logsNotification') {
      const slot = Number(parsed.params?.result?.context?.slot ?? 0);
      const value = parsed.params?.result?.value;
      const signature = typeof value?.signature === 'string' ? value.signature : null;
      if (signature === null) {
        // Dados hostis/malformados: nunca inferir — métrica/log e descarte.
        this.logger.warn('logsNotification malformada descartada', { slot });
        return;
      }
      const notification: RawTransactionNotification = {
        signature,
        slot: Number.isFinite(slot) ? slot : 0,
        value,
      };
      const observed: ObservedChainEvent = {
        signature,
        instructionIndex: 0,
        wallet: '',
        slot: BigInt(notification.slot),
        payload: value,
      };
      for (const cb of this.eventListeners) {
        try {
          cb(observed);
        } catch (err) {
          this.logger.error('listener onEvent lançou exceção', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      for (const cb of this.rawListeners) {
        try {
          cb(notification);
        } catch (err) {
          this.logger.error('listener onRawEvent lançou exceção', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.clearTimers();
    this.pingTimer = setInterval(() => {
      const ws = this.ws;
      if (ws === null) return;
      const silenceMs = Date.now() - this.lastMessageAt;
      if (silenceMs > this.silenceTimeoutMs) {
        this.logger.warn('wss silêncio excedeu limite — forçando reconnect', {
          silenceMs,
          silenceTimeoutMs: this.silenceTimeoutMs,
        });
        this.forceReconnect();
        return;
      }
      try {
        ws.ping();
      } catch (err) {
        this.logger.warn('wss ping falhou', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, this.pingIntervalMs);
    this.pingTimer.unref?.();
  }

  private forceReconnect(): void {
    const ws = this.ws;
    if (ws !== null) {
      this.ws = null;
      try {
        ws.terminate();
      } catch {
        // noop — reconnect já agendado pelo handler de close
      }
    }
    if (this.reconnectTimer === null) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    const delay = this.reconnectBackoff.nextDelay();
    this.logger.info('wss reconnect agendado', { delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closed) return;
      this.openSocket().catch((err: unknown) => {
        this.logger.error('wss reconnect falhou', {
          error: err instanceof Error ? err.message : String(err),
        });
        this.scheduleReconnect();
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private clearTimers(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.failPendingSubscribes();
  }

  /**
   * Rejeita todas as subscrições pendentes. Sem isso, um socket fechado
   * antes da confirmação deixaria promises pendentes para sempre (leak).
   */
  private failPendingSubscribes(): void {
    if (this.pendingSubscribes.size === 0) return;
    const err = new ClassifiedError(
      'RPC_ERROR',
      'socket fechado antes da confirmação de logsSubscribe',
    );
    for (const { reject } of this.pendingSubscribes.values()) reject(err);
    this.pendingSubscribes.clear();
  }
}

/** Extrai host sem expor api-key em logs (segurança §2). */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/** Referência HTTP documentada (Helius), exportada para configuração do RpcProvider. */
export const HELIUS_HTTP_BASE = 'https://mainnet.helius-rpc.com';

export function buildHeliusHttpUrl(apiKey: string): string {
  return `${HELIUS_HTTP_BASE}/?api-key=${encodeURIComponent(apiKey)}`;
}

export function buildHeliusWsUrl(apiKey: string): string {
  return `${HELIUS_WSS_BASE}?api-key=${encodeURIComponent(apiKey)}`;
}
