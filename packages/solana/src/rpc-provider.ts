/**
 * RpcProvider — client concreto de JSON-RPC da Solana (API pública padrão,
 * documentada em https://solana.com/docs/rpc/http) via fetch nativo (Node 20).
 *
 * FACT: endpoints suportados são JSON-RPC HTTP(S) genéricos — nenhum endpoint
 * proprietário é assumido. Funciona com RPC público, Helius
 * (https://mainnet.helius-rpc.com) ou qualquer RPC compatível.
 *
 * - Failover automático primary → secondary → tertiary após N falhas
 *   consecutivas (configurável, default 3); cada transição dispara onFailover.
 * - Retry por requisição com backoff exponencial + jitter (cap 30s).
 * - Timeout por requisição (default 10s) via AbortController.
 * - Nenhuma lógica de trading; erros classificados com ErrorClass.
 */

import type { ErrorClass } from '@ct/types';
import { ExponentialBackoff, sleep } from './backoff.js';

/** Interface mínima de logger (compatível estruturalmente com @ct/logging). */
export interface LoggerLike {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export class ClassifiedError extends Error {
  constructor(
    readonly errorClass: ErrorClass,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ClassifiedError';
  }
}

export type RpcHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface RpcEndpoint {
  name: string;
  url: string;
  tier: 'primary' | 'secondary' | 'tertiary';
}

export interface RpcFailoverEvent {
  fromTier: RpcEndpoint['tier'];
  toTier: RpcEndpoint['tier'];
  reason: string;
  at: Date;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  err: unknown;
  memo: string | null;
  blockTime: number | null;
}

export interface SignaturePage {
  signatures: SignatureInfo[];
  /** Assinatura mais antiga da página — usar como `before` na próxima chamada. */
  oldestSignature: string | null;
  /** true se provavelmente há mais páginas (página retornou cheia). */
  hasMore: boolean;
}

export interface GetSignaturesOptions {
  limit?: number;
  before?: string;
  until?: string;
}

export interface RpcProviderOptions {
  logger: LoggerLike;
  /** Falhas consecutivas antes de failover. Default 3. */
  failoverThreshold?: number;
  /** Timeout por requisição HTTP em ms. Default 10_000. */
  requestTimeoutMs?: number;
  /** Tentativas totais máximas por chamada (incluindo failovers). Default 6. */
  maxAttempts?: number;
  /** Overrides de backoff (testes). */
  backoff?: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: () => number };
  /** fetch injetável (testes). Default: globalThis.fetch. */
  fetchFn?: typeof fetch;
}

interface JsonRpcErrorPayload {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: JsonRpcErrorPayload;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_FAILOVER_THRESHOLD = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

export class RpcProvider {
  private readonly endpoints: RpcEndpoint[];
  private readonly logger: LoggerLike;
  private readonly failoverThreshold: number;
  private readonly requestTimeoutMs: number;
  private readonly maxAttempts: number;
  private readonly backoffOpts: RpcProviderOptions['backoff'];
  private readonly fetchFn: typeof fetch;
  private readonly failoverListeners: Array<(e: RpcFailoverEvent) => void> = [];
  private activeIndex = 0;
  private consecutiveFailures = 0;
  private requestId = 0;

  constructor(endpoints: RpcEndpoint[], options: RpcProviderOptions) {
    if (endpoints.length === 0) {
      throw new ClassifiedError('CONFIG_ERROR', 'ao menos um RpcEndpoint é obrigatório');
    }
    // Ordem determinística por tier, preservando ordem relativa dentro do tier.
    const tierOrder: Record<RpcEndpoint['tier'], number> = {
      primary: 0,
      secondary: 1,
      tertiary: 2,
    };
    this.endpoints = [...endpoints].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
    this.logger = options.logger;
    this.failoverThreshold = options.failoverThreshold ?? DEFAULT_FAILOVER_THRESHOLD;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.backoffOpts = options.backoff;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    if (typeof this.fetchFn !== 'function') {
      throw new ClassifiedError('CONFIG_ERROR', 'fetch não disponível (Node >= 20 requerido)');
    }
  }

  onFailover(cb: (event: RpcFailoverEvent) => void): void {
    this.failoverListeners.push(cb);
  }

  getActiveEndpoint(): Promise<RpcEndpoint> {
    const endpoint = this.endpoints[this.activeIndex];
    if (!endpoint) {
      throw new ClassifiedError('CONFIG_ERROR', 'nenhum endpoint ativo disponível');
    }
    return Promise.resolve(endpoint);
  }

  async getHealth(endpoint: RpcEndpoint): Promise<RpcHealth> {
    try {
      await this.rawCall<unknown>(endpoint, 'getHealth', []);
      return 'healthy';
    } catch (err) {
      this.logger.warn('rpc getHealth falhou', {
        endpoint: endpoint.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'down';
    }
  }

  /** getSlot — FACT: método padrão do JSON-RPC Solana. */
  async getSlot(commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'): Promise<number> {
    return this.call<number>('getSlot', [{ commitment }]);
  }

  /**
   * getSignaturesForAddress com paginação automática (`before`).
   * Retorna até `limit` assinaturas (default 1000, máximo da API por página).
   */
  async getSignaturesForAddress(
    address: string,
    options: GetSignaturesOptions = {},
  ): Promise<SignatureInfo[]> {
    const pageLimit = Math.min(options.limit ?? 1000, 1000);
    const out: SignatureInfo[] = [];
    let before = options.before;
    for (;;) {
      const page = await this.getSignaturesPage(address, {
        limit: pageLimit,
        ...(before !== undefined ? { before } : {}),
        ...(options.until !== undefined ? { until: options.until } : {}),
      });
      out.push(...page.signatures);
      if (!page.hasMore || page.oldestSignature === null) break;
      if (options.limit !== undefined && out.length >= options.limit) break;
      before = page.oldestSignature;
    }
    return options.limit !== undefined ? out.slice(0, options.limit) : out;
  }

  /** Uma página de getSignaturesForAddress (sem auto-paginação). */
  async getSignaturesPage(address: string, options: GetSignaturesOptions = {}): Promise<SignaturePage> {
    const params: Record<string, unknown> = { limit: options.limit ?? 1000 };
    if (options.before !== undefined) params['before'] = options.before;
    if (options.until !== undefined) params['until'] = options.until;
    const raw = await this.call<RawSignatureInfo[]>('getSignaturesForAddress', [address, params]);
    const signatures = raw.map((s) => ({
      signature: String(s.signature),
      slot: Number(s.slot),
      err: s.err ?? null,
      memo: s.memo ?? null,
      blockTime: typeof s.blockTime === 'number' ? s.blockTime : null,
    }));
    const oldest = signatures.length > 0 ? signatures[signatures.length - 1]!.signature : null;
    return {
      signatures,
      oldestSignature: oldest,
      hasMore: signatures.length >= (options.limit ?? 1000),
    };
  }

  /**
   * getTransaction com encoding jsonParsed e maxSupportedTransactionVersion: 0
   * (FACT: requerido para transações versionadas/v0 com address lookup tables).
   */
  async getTransaction(signature: string): Promise<unknown | null> {
    return this.call<unknown | null>('getTransaction', [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
    ]);
  }

  /**
   * Núcleo: tenta a chamada no endpoint ativo; após `failoverThreshold`
   * falhas consecutivas, faz failover para o próximo endpoint e continua.
   * Espera total máxima: `maxAttempts` tentativas com backoff entre elas.
   */
  async call<T>(method: string, params: unknown[]): Promise<T> {
    const backoff = new ExponentialBackoff(this.backoffOpts);
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const endpoint = this.endpoints[this.activeIndex];
      if (!endpoint) throw new ClassifiedError('CONFIG_ERROR', 'nenhum endpoint configurado');
      try {
        const result = await this.rawCall<T>(endpoint, method, params);
        this.recordSuccess();
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure(endpoint, method, err);
        const delay = backoff.nextDelay();
        await sleep(delay).catch(() => undefined);
      }
    }
    throw new ClassifiedError(
      'RPC_ERROR',
      `rpc ${method} esgotou ${this.maxAttempts} tentativas`,
      lastError,
    );
  }

  private async rawCall<T>(endpoint: RpcEndpoint, method: string, params: unknown[]): Promise<T> {
    const id = ++this.requestId;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(endpoint.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ClassifiedError('RPC_ERROR', `rpc ${method} falha de rede/timeout`, err);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new ClassifiedError('RPC_ERROR', `rpc ${method} HTTP ${response.status}`);
    }
    let payload: JsonRpcResponse<T>;
    try {
      payload = (await response.json()) as JsonRpcResponse<T>;
    } catch (err) {
      throw new ClassifiedError('DATA_ERROR', `rpc ${method} resposta não-JSON`, err);
    }
    if (payload.error) {
      throw new ClassifiedError(
        'RPC_ERROR',
        `rpc ${method} erro ${payload.error.code}: ${payload.error.message}`,
      );
    }
    return payload.result as T;
  }

  private recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.logger.debug('rpc endpoint recuperado', {
        endpoint: this.endpoints[this.activeIndex]?.name,
      });
    }
    this.consecutiveFailures = 0;
  }

  private recordFailure(endpoint: RpcEndpoint, method: string, err: unknown): void {
    this.consecutiveFailures += 1;
    this.logger.warn('rpc chamada falhou', {
      endpoint: endpoint.name,
      method,
      consecutiveFailures: this.consecutiveFailures,
      error: err instanceof Error ? err.message : String(err),
    });
    if (this.consecutiveFailures >= this.failoverThreshold) {
      this.failover(`falhas consecutivas >= ${this.failoverThreshold} em ${endpoint.name}`);
    }
  }

  private failover(reason: string): void {
    const from = this.endpoints[this.activeIndex];
    if (!from) return;
    const nextIndex = (this.activeIndex + 1) % this.endpoints.length;
    const to = this.endpoints[nextIndex];
    if (!to || nextIndex === this.activeIndex) {
      // Único endpoint: não há para onde falhar; reseta contador para retry puro.
      this.consecutiveFailures = 0;
      return;
    }
    this.activeIndex = nextIndex;
    this.consecutiveFailures = 0;
    const event: RpcFailoverEvent = {
      fromTier: from.tier,
      toTier: to.tier,
      reason,
      at: new Date(),
    };
    this.logger.warn('rpc failover', {
      from: from.name,
      to: to.name,
      reason,
    });
    for (const cb of this.failoverListeners) {
      try {
        cb(event);
      } catch (err) {
        this.logger.error('listener onFailover lançou exceção', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

interface RawSignatureInfo {
  signature: string;
  slot: number;
  err?: unknown;
  memo?: string | null;
  blockTime?: number | null;
}
