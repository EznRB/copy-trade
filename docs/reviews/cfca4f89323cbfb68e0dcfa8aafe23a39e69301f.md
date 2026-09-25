# Review cfca4f89323cbfb68e0dcfa8aafe23a39e69301f

- Branch: sprint/f1-5-enrichment
- Data: 2026-09-25 02:16:59
- Gates: lint=1 typecheck=1 test=1 (0 = ok)
- Veredito: **REJEITADO (gates falharam)**

## Saida do code-reviewer

opencode.exe : [0m
No C:\Users\enzo\AppData\Roaming\npm\opencode.ps1:14 caractere:3
+   & "$basedir/node_modules/opencode-ai/bin/opencode.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ([0m:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
> code-reviewer ┬À big-pickle
[0m
[0m$ [0mgit show cfca4f89323cbfb68e0dcfa8aafe23a39e69301f --stat
commit cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:14:46 2026 -0300

    fix(review): consecutiveReconnects reseta em connect()/onOpen + teste de serie de falhas (HIGH cc64b8d)

 packages/solana/src/helius-provider.test.ts | 49 +++++++++++++++++++++++++++++
 packages/solana/src/helius-provider.ts      |  2 ++
 2 files changed, 51 insertions(+)
[0m
[0m$ [0mgit log --oneline -5 cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
cfca4f8 fix(review): consecutiveReconnects reseta em connect()/onOpen + teste de serie de falhas (HIGH cc64b8d)
0167a0d docs(handoff): round 2 de fixes da F1.5
812ef1a fix(lint): remove try/catch inutil no teste do lock
799d048 fix(review): HIGH-3 - instance lock com staleness por idade (PID reusado) + testes
6cd436b fix(review): MEDIUM - fixtures rigorosos campo-a-campo (direction/mint/user), divergencias listadas, 
decodificacao normaliza lado do token quando base=wSOL, relatorio sem BOM
[0m
[0m$ [0mgit show cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
commit cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:14:46 2026 -0300

    fix(review): consecutiveReconnects reseta em connect()/onOpen + teste de serie de falhas (HIGH cc64b8d)

diff --git a/packages/solana/src/helius-provider.test.ts b/packages/solana/src/helius-provider.test.ts
index a2ea248..8cd3f73 100644
--- a/packages/solana/src/helius-provider.test.ts
+++ b/packages/solana/src/helius-provider.test.ts
@@ -160,6 +160,55 @@ describe('HeliusProvider - subscriptions por wallet', () => {
   });
 });
 
+describe('HeliusProvider - reset da serie de falhas', () => {
+  it('N falhas + sucesso + nova falha: NAO entra em estado terminal (serie resetou)', async () => {
+    const logs: string[] = [];
+    const logger = {
+      debug: (m: string) => logs.push(m),
+      info: (m: string) => logs.push(m),
+      warn: (m: string) => logs.push(m),
+      error: (m: string) => logs.push(m),
+    };
+    let mode: 'fail' | 'ok' = 'fail';
+    const p = new HeliusProvider({
+      logger,
+      wsUrl: 'wss://fake.local',
+      backoff: { baseMs: 1, maxMs: 2, jitterRatio: 0 },
+      maxReconnects: 3,
+      webSocketFactory: (_url: string) => {
+        void _url;
+        class W extends EventEmitter {
+          constructor() {
+            super();
+            queueMicrotask(() => {
+              if (mode === 'fail') this.emit('error', new Error('down'));
+              else this.emit('open');
+            });
+          }
+          send(_d: unknown): void {
+            void _d;
+          }
+          ping(): void {}
+          close(): void {
+            this.emit('close', 1006, Buffer.from(''));
+          }
+        }
+        return new W() as unknown as import('ws').WebSocket;
+      },
+    });
+    await expect(p.connect()).rejects.toThrowError(); // falha 1
+    await expect(p.connect()).rejects.toThrowError(); // falha 2
+    // sucesso: agora abre (sem subscriptions -> resolve direto)
+    mode = 'ok';
+    await expect(p.connect()).resolves.toBeUndefined();
+    await p.close();
+    // nova falha apos sucesso: nao pode entrar em terminal imediatamente
+    mode = 'fail';
+    await expect(p.connect()).rejects.toThrowError();
+    expect(logs.some((l) => l.includes('estado terminal'))).toBe(false);
+  });
+});
+
 describe('HeliusProvider - reconnect storm', () => {
   it('apos maxReconnects falhas consecutivas vira estado terminal (sem loop)', async () => {
     vi.useFakeTimers();
diff --git a/packages/solana/src/helius-provider.ts b/packages/solana/src/helius-provider.ts
index 93fb859..e177986 100644
--- a/packages/solana/src/helius-provider.ts
+++ b/packages/solana/src/helius-provider.ts
@@ -143,6 +143,7 @@ export class HeliusProvider implements BlockchainDataProvider {
 
   connect(): Promise<void> {
     this.closed = false;
+    this.consecutiveReconnects = 0; // reset explicito no boot
     return this.openSocket();
   }
 
@@ -204,6 +205,7 @@ export class HeliusProvider implements BlockchainDataProvider {
       const onOpen = (): void => {
         this.lastMessageAt = Date.now();
         this.reconnectBackoff.reset();
+        this.consecutiveReconnects = 0; // sucesso reseta a serie de falhas
         this.logger.info('wss conectado', { urlHost: safeHost(this.wsUrl) });
         // connected s├│ ├® P├ÜBLICO ap├│s todas as subscriptions confirmadas; falha
         // parcial n├úo deixa socket aberto com subs vivas (fecha e rejeita).
[0m
Now let me read the full source file to understand the reconnect logic:
[0mÔåÆ [0mRead packages/solana/src/helius-provider.ts
[0m
[0m$ [0mgit status; git branch --show-current; git log --oneline -3
On branch master
Your branch is ahead of 'origin/master' by 6 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
master
b7364bc review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 0167a0d89fe0f21d6aa83d51e4738a1f4c5e96ae
10f6011 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 812ef1a7f376b01de7f7dbc21ffae9f645e1edc3
1e1d208 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 799d04834d147cbdcc4ad8e46c4b8499d8ad1b00
[0m
The current working-tree file doesn't seem to contain the changes shown in the diff. Let me verify the repository state:
[0m$ [0mgit show cfca4f89323cbfb68e0dcfa8aafe23a39e69301f:packages/solana/src/helius-provider.ts | Select-String 
-Pattern "consecutiveReconnects" -Context 2,2
private readonly subscriptionByWallet = new Map<string, number>();
    /** Contagem de reconexoes consecutivas ÔÇö teto evita reconnect storm infinita. */
>   private consecutiveReconnects = 0;
    private readonly maxReconnects: number;
    private nextRequestId = 1;
    connect(): Promise<void> {
      this.closed = false;
>     this.consecutiveReconnects = 0; // reset explicito no boot
      return this.openSocket();
    }
          this.lastMessageAt = Date.now();
          this.reconnectBackoff.reset();
>         this.consecutiveReconnects = 0; // sucesso reseta a serie de falhas
          this.logger.info('wss conectado', { urlHost: safeHost(this.wsUrl) });
          // connected s├│ ├® P├ÜBLICO ap├│s todas as subscriptions confirmadas; falha
      // Teto de reconnect storm (review HIGH-2): passar do limite vira estado
      // terminal ÔÇö log├ível pela camada superior; n├úo gera loop infinito.
>     if (this.consecutiveReconnects >= this.maxReconnects) {
        this.logger.error('wss reconnects esgotados ÔÇö estado terminal (restart manual necess├írio)', {
          errorClass: 'RPC_ERROR',
        return;
      }
>     this.consecutiveReconnects++;
      const delay = this.reconnectBackoff.nextDelay();
      this.logger.info('wss reconnect agendado', {
        delayMs: delay,
>       attempt: this.consecutiveReconnects,
        maxReconnects: this.maxReconnects,
      });
[0m
The commit lives on `sprint/f1-5-enrichment` while master has diverged. Let me examine the full file at the commit itself:
[0m$ [0mgit show cfca4f89323cbfb68e0dcfa8aafe23a39e69301f:packages/solana/src/helius-provider.ts
/**
 * HeliusProvider ÔÇö stream de transa├º├Áes via WebSocket.
 *
 * FACT (documenta├º├úo Helius Enhanced Websockets): endpoint
 *   wss://mainnet.helius-rpc.com/?api-key=<HELIUS_API_KEY>
 * aceita os mesmos m├®todos de subscription do WSS padr├úo da Solana
 * (logsSubscribe / logsUnsubscribe), com filtro `mentions` por endere├ºo.
 * Fallback: sem API key, conecta no WSS padr├úo da Solana
 * (wss://api.mainnet-beta.solana.com) ÔÇö o formato das mensagens ├® o mesmo
 * (JSON-RPC 2.0, notifica├º├úo `logsNotification`).
 *
 * Refer├¬ncia HTTP Helius (para uso futuro do rpc-provider):
 *   https://mainnet.helius-rpc.com/?api-key=<KEY>
 *
 * Features:
 * - logsSubscribe com { mentions: wallets } e commitment configur├ível.
 * - Reconnect com backoff exponencial + jitter (cap 30s).
 * - Heartbeat: ping a cada 30s; se nenhuma mensagem por 60s ÔåÆ reconnect for├ºado.
 * - Emite eventos crus RawTransactionNotification { signature, slot, value }.
 *   Nenhuma interpreta├º├úo/normaliza├º├úo aqui (responsabilidade da camada superior).
 */

import { WebSocket } from 'ws';
import { ExponentialBackoff } from './backoff.js';
import { ClassifiedError, type LoggerLike } from './rpc-provider.js';
import type { BlockchainDataProvider, EventCallback, ObservedChainEvent } from './chain-event.js';

/** Payload bruto de uma notifica├º├úo logsNotification (campos crus, sem interpreta├º├úo). */
export interface RawTransactionNotification {
  signature: string;
  slot: number;
  /** `value` cru do result da notifica├º├úo (err, logs, etc.) ÔÇö dados hostis, validar downstream. */
  value: unknown;
}

export type RawEventCallback = (notification: RawTransactionNotification) => void;

export interface HeliusProviderOptions {
  logger: LoggerLike;
  /** API key Helius. Se ausente, usa WSS p├║blico da Solana. */
  apiKey?: string;
  /** Override de URL WSS (ex.: devnet). Tem preced├¬ncia sobre apiKey. */
  wsUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Intervalo de ping em ms. Default 30_000. */
  pingIntervalMs?: number;
  /** Sil├¬ncio m├íximo antes de for├ºar reconnect, em ms. Default 60_000. */
  silenceTimeoutMs?: number;
  /** Backoff de reconnect injet├ível (testes). */
  backoff?: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: () => number };
  /** F├íbrica de WebSocket injet├ível (testes). */
  webSocketFactory?: (url: string) => WebSocket;
  /** Teto de reconex├Áes consecutivas antes de estado terminal (default 50). */
  maxReconnects?: number;
}

// FACT (docs Helius, verificado em 2026-09): WSS correto ├® mainnet.helius-rpc.com
// ("LaserStream WebSocket"). wss://atlas-mainnet... retorna HTTP 403.
const HELIUS_WSS_BASE = 'wss://mainnet.helius-rpc.com';
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
  /** Subscriptions por wallet no socket ATUAL (review 2ab477f HIGH-2: sem mapa = leak). */
  private readonly subscriptionByWallet = new Map<string, number>();
  /** Contagem de reconexoes consecutivas ÔÇö teto evita reconnect storm infinita. */
  private consecutiveReconnects = 0;
  private readonly maxReconnects: number;
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
    this.maxReconnects = options.maxReconnects ?? 50;
    this.wsFactory = options.webSocketFactory ?? ((url: string) => new WebSocket(url));
    this.reconnectBackoff = new ExponentialBackoff(this.backoffOpts);
    if (options.wsUrl !== undefined) {
      this.wsUrl = options.wsUrl;
    } else if (options.apiKey !== undefined && options.apiKey.length > 0) {
      this.wsUrl = `${HELIUS_WSS_BASE}?api-key=${encodeURIComponent(options.apiKey)}`;
    } else {
      // ASSUMPTION: fallback no WSS p├║blico Solana ÔÇö mesmo formato de mensagem.
      this.wsUrl = SOLANA_PUBLIC_WSS;
      this.logger.warn('HELIUS_API_KEY ausente ÔÇö usando WSS p├║blico Solana (rate limits menores)');
    }
  }

  onRawEvent(cb: RawEventCallback): void {
    this.rawListeners.push(cb);
  }

  /**
   * Adapta├º├úo para a interface BlockchainDataProvider: emite ObservedChainEvent
   * com os campos conhecidos (signature/slot) e desconhecidos como neutros
   * (instructionIndex 0, wallet ''): logsNotification n├úo identifica a wallet
   * espec├¡fica mencionada ÔÇö a resolu├º├úo ├® responsabilidade da camada de
   * normaliza├º├úo downstream (ver .agents/solana-ingestion.md ┬º2).
   */
  onEvent(cb: EventCallback): void {
    this.eventListeners.push(cb);
  }

  connect(): Promise<void> {
    this.closed = false;
    this.consecutiveReconnects = 0; // reset explicito no boot
    return this.openSocket();
  }

  async subscribeWallets(wallets: string[]): Promise<void> {
    // Base58 estrito (32-44): formato errado ├® VALIDATION_ERROR na borda,
    // nunca chega ao wire (review: "abc" passava com a checagem antiga).
    const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    for (const w of wallets) {
      if (typeof w !== 'string' || !B58.test(w)) {
        throw new ClassifiedError('VALIDATION_ERROR', 'wallet inv├ílida em subscribeWallets');
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
    // logsUnsubscribe de todas as subscriptions ativas (review HIGH-2).
    this.sendAllUnsubscribes();
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    this.subscriptionByWallet.clear();
    if (ws) {
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        try {
          ws.close();
        } catch {
          resolve();
        }
        // N├úo esperar indefinidamente o close handshake.
        setTimeout(resolve, 2_000).unref();
      });
    }
  }

  // ---------------------------------------------------------------- internals

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Anti-├│rf├úo (review HIGH-2): fecha socket anterior ANTES de criar o novo.
      const oldWs = this.ws;
      if (oldWs) {
        try {
          oldWs.removeAllListeners();
          oldWs.close();
        } catch {
          /* socket j├í morto */
        }
      }
      const ws = this.wsFactory(this.wsUrl);
      this.ws = ws;

      const onOpen = (): void => {
        this.lastMessageAt = Date.now();
        this.reconnectBackoff.reset();
        this.consecutiveReconnects = 0; // sucesso reseta a serie de falhas
        this.logger.info('wss conectado', { urlHost: safeHost(this.wsUrl) });
        // connected s├│ ├® P├ÜBLICO ap├│s todas as subscriptions confirmadas; falha
        // parcial n├úo deixa socket aberto com subs vivas (fecha e rejeita).
        void this.sendLogsSubscribe()
          .then(() => {
            this.connected = true;
            this.startHeartbeat();
            resolve();
          })
          .catch((err: unknown) => {
            try {
              ws.close();
            } catch {
              /* noop */
            }
            reject(err);
          });
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
        this.subscriptionByWallet.clear();
        this.clearTimers();
        this.logger.warn('wss fechado', { code, reason: reason.toString() });
        this.scheduleReconnect();
      });
      ws.on('error', (err: Error) => {
        this.logger.error('wss erro', { error: err.message });
      });
    });
  }

  /** Logs de unsubscribe (fire-and-forget) ÔÇö chamado antes de fechar socket. */
  private sendAllUnsubscribes(): void {
    const ws = this.ws;
    if (!ws) return;
    for (const subId of this.subscriptionByWallet.values()) {
      try {
        ws.send(
          JSON.stringify({ jsonrpc: '2.0', id: this.nextRequestId++, method: 'logsUnsubscribe', params: [subId] }),
        );
      } catch (err) {
        this.logger.warn('logsUnsubscribe falhou', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async sendLogsSubscribe(): Promise<void> {
    if (this.wallets.size === 0 || this.ws === null) return;
    // FACT (Helius, observado 2026-09-24): logsSubscribe aceita apenas 1
    // endereco em `mentions` neste plano. Resolver: uma subscription por
    // endereco (Promise.all; se alguma falhar, o connect falha de forma
    // audivel e a rotina de reconnect refaz).
    const wallets = [...this.wallets];
    await Promise.all(wallets.map((wallet) => this.sendSingleSubscribe(wallet)));
  }

  private sendSingleSubscribe(wallet: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'logsSubscribe',
        params: [{ mentions: [wallet] }, { commitment: this.commitment }],
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
        this.pendingSubscribes.set(id, { resolve, reject, wallet });
      });
    });
  }

  private readonly pendingSubscribes = new Map<
    number,
    { resolve: () => void; reject: (e: Error) => void; wallet?: string }
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
      this.logger.warn('wss mensagem n├úo-JSON descartada');
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
        const subId = typeof parsed.result === 'number' ? parsed.result : null;
        if (subId !== null && pending?.wallet) {
          this.subscriptionByWallet.set(pending.wallet, subId);
        }
        this.logger.info('logsSubscribe ativo', {
          wallet: pending?.wallet,
          subscriptionId: subId,
          activeSubscriptions: this.subscriptionByWallet.size,
        });
        pending?.resolve();
      }
      return;
    }

    // Notifica├º├úo de logs
    if (parsed.method === 'logsNotification') {
      const slot = Number(parsed.params?.result?.context?.slot ?? 0);
      const value = parsed.params?.result?.value;
      const signature = typeof value?.signature === 'string' ? value.signature : null;
      if (signature === null) {
        // Dados hostis/malformados: nunca inferir ÔÇö m├®trica/log e descarte.
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
          this.logger.error('listener onEvent lan├ºou exce├º├úo', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      for (const cb of this.rawListeners) {
        try {
          cb(notification);
        } catch (err) {
          this.logger.error('listener onRawEvent lan├ºou exce├º├úo', {
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
        this.logger.warn('wss sil├¬ncio excedeu limite ÔÇö for├ºando reconnect', {
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
        // noop ÔÇö reconnect j├í agendado pelo handler de close
      }
    }
    if (this.reconnectTimer === null) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    // Teto de reconnect storm (review HIGH-2): passar do limite vira estado
    // terminal ÔÇö log├ível pela camada superior; n├úo gera loop infinito.
    if (this.consecutiveReconnects >= this.maxReconnects) {
      this.logger.error('wss reconnects esgotados ÔÇö estado terminal (restart manual necess├írio)', {
        errorClass: 'RPC_ERROR',
        maxReconnects: this.maxReconnects,
      });
      this.closed = true;
      return;
    }
    this.consecutiveReconnects++;
    const delay = this.reconnectBackoff.nextDelay();
    this.logger.info('wss reconnect agendado', {
      delayMs: delay,
      attempt: this.consecutiveReconnects,
      maxReconnects: this.maxReconnects,
    });
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
   * Rejeita todas as subscri├º├Áes pendentes. Sem isso, um socket fechado
   * antes da confirma├º├úo deixaria promises pendentes para sempre (leak).
   */
  private failPendingSubscribes(): void {
    if (this.pendingSubscribes.size === 0) return;
    const err = new ClassifiedError(
      'RPC_ERROR',
      'socket fechado antes da confirma├º├úo de logsSubscribe',
    );
    for (const { reject } of this.pendingSubscribes.values()) reject(err);
    this.pendingSubscribes.clear();
  }
}

/** Extrai host sem expor api-key em logs (seguran├ºa ┬º2). */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/** Refer├¬ncia HTTP documentada (Helius), exportada para configura├º├úo do RpcProvider. */
export const HELIUS_HTTP_BASE = 'https://mainnet.helius-rpc.com';

export function buildHeliusHttpUrl(apiKey: string): string {
  return `${HELIUS_HTTP_BASE}/?api-key=${encodeURIComponent(apiKey)}`;
}

export function buildHeliusWsUrl(apiKey: string): string {
  return `${HELIUS_WSS_BASE}?api-key=${encodeURIComponent(apiKey)}`;
}
[0m
[0m$ [0mgit show cfca4f89323cbfb68e0dcfa8aafe23a39e69301f:packages/solana/src/helius-provider.test.ts
/**
 * Testes do HeliusProvider (review 2ab477f, HIGH-1/HIGH-2). ASCII-only.
 * WebSocket fake injetavel; sem rede.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { HeliusProvider, type RawTransactionNotification } from './helius-provider.js';

class FakeWs extends EventEmitter {
  static instances: FakeWs[] = [];
  static reset(): void { FakeWs.instances = []; }
  sent: Array<Record<string, unknown>> = [];
  closed = 0;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWs.instances.push(this);
    queueMicrotask(() => this.emit('open'));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(data: any, cb?: (err?: Error) => void) {
    this.sent.push(JSON.parse(String(data)));
    cb?.();
  }
  ping(): void {}
  close(): void {
    this.closed++;
    queueMicrotask(() => this.emit('close', 1006, Buffer.from('')));
  }
  terminate(): void {}
}

const W = (c: string) => c.repeat(44); // base58 valido

function providerWithFake(): { provider: HeliusProvider; logs: string[] } {
  const logs: string[] = [];
  const logger = {
    debug: (m: string) => logs.push(`d:${m}`),
    info: (m: string) => logs.push(`i:${m}`),
    warn: (m: string) => logs.push(`w:${m}`),
    error: (m: string) => logs.push(`e:${m}`),
  };
  const p = new HeliusProvider({
    logger,
    wsUrl: 'wss://fake.local',
    backoff: { baseMs: 1, maxMs: 2, jitterRatio: 0 },
    maxReconnects: 50,
    webSocketFactory: (url) => new FakeWs(url) as unknown as import('ws').WebSocket,
  });
  return { provider: p, logs };
}

/** Confirma a subscricao atual pendente com sucesso. */
function confirmSubs(ws: FakeWs): void {
  const pending = ws.sent.filter((m) => m['method'] === 'logsSubscribe');
  for (const m of pending) {
    ws.emit('message', JSON.stringify({ jsonrpc: '2.0', id: m['id'], result: 4242 }));
  }
}

describe('HeliusProvider - subscriptions por wallet', () => {
  beforeEach(() => { FakeWs.reset(); });
  it('N wallets validas geram N logsSubscribe (1 mention cada)', async () => {
    const { provider } = providerWithFake();
    await provider.subscribeWallets([W('A'), W('B')]);
    const p = provider.connect();
    await new Promise((r) => setTimeout(r, 10));
    const ws = FakeWs.instances[0]!;
    confirmSubs(ws);
    await p;
    const subs = ws.sent.filter((m) => m['method'] === 'logsSubscribe');
    expect(subs).toHaveLength(2);
    expect((subs[0]!['params'] as unknown[])[0]).toEqual({ mentions: [W('A')] });
    await provider.close();
  });

  it('rejeita endereco mal-formado na borda (VALIDATION_ERROR)', async () => {
    const { provider } = providerWithFake();
    try {
      await provider.subscribeWallets(['abc']);
      throw new Error('nao deveria passar');
    } catch (err) {
      expect((err as { errorClass?: string }).errorClass).toBe('VALIDATION_ERROR');
    }
  });

  it('sub rejeitada pela RPC: promise falha com RPC_ERROR e socket e fechado', async () => {
    const { provider } = providerWithFake();
    await provider.subscribeWallets([W('A')]);
    const p = provider.connect();
    const bad = providerWithFake();
    void bad;
    await new Promise((r) => setTimeout(r, 10));
    const ws = FakeWs.instances[0]!;
    const sub = ws.sent.find((m) => m['method'] === 'logsSubscribe');
    ws.emit(
      'message',
      JSON.stringify({ jsonrpc: '2.0', id: sub!['id'], error: { code: -32602, message: 'bad' } }),
    );
    await expect(p).rejects.toThrowError(/logsSubscribe rejeitado/);
    // Socket do connect falho foi fechado explicitamente (anti-orfao).
    expect(ws.closed).toBeGreaterThanOrEqual(1);
  });

  it('close() envia logsUnsubscribe para cada sub ativa', async () => {
    const { provider } = providerWithFake();
    await provider.subscribeWallets([W('A'), W('B')]);
    const p = provider.connect();
    await new Promise((r) => setTimeout(r, 10));
    const ws = FakeWs.instances[0]!;
    confirmSubs(ws);
    await p;
    await provider.close();
    const unsubs = ws.sent.filter((m) => m['method'] === 'logsUnsubscribe');
    expect(unsubs).toHaveLength(2);
  });

  it('reconnect nao acumula sockets (sempre 1 vivo) nem duplica subs', async () => {
    const { provider } = providerWithFake();
    await provider.subscribeWallets([W('A')]);
    const p = provider.connect();
    await new Promise((r) => setTimeout(r, 10));
    confirmSubs(FakeWs.instances[0]!);
    await p;
    // Simula queda e reconnect
    FakeWs.instances[0]!.emit('close', 1006, Buffer.from('net'));
    await new Promise((r) => setTimeout(r, 30));
The working tree is on `master`, which has diverged ÔÇö the commit under review lives on `sprint/f1-5-enrichment`. Let me look at the test file at the commit and the review that triggered this fix:
    expect(FakeWs.instances.length).toBe(2);
    confirmSubs(FakeWs.instances[1]!);
    await new Promise((r) => setTimeout(r, 10));
    const subs2 = FakeWs.instances[1]!.sent.filter((m) => m['method'] === 'logsSubscribe');
    expect(subs2).toHaveLength(1); // re-subscribe UMA vez por wallet no socket novo
    await provider.close();
  });

  it('eventos de logsNotification chegam ao onRawEvent com assinatura valida', async () => {
    const { provider } = providerWithFake();
    const got: RawTransactionNotification[] = [];
    provider.onRawEvent((n) => got.push(n));
    await provider.subscribeWallets([W('A')]);
    const p = provider.connect();
    await new Promise((r) => setTimeout(r, 10));
    const ws = FakeWs.instances[0]!;
    confirmSubs(ws);
    await p;
    ws.emit(
      'message',
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'logsNotification',
        params: { result: { context: { slot: 9 }, value: { signature: W('5',) + 'x'.repeat(44) } }, subscription: 4242 
},
      }),
    );
    expect(got).toHaveLength(1);
    expect(got[0]!.signature.length).toBeGreaterThan(0);
    await provider.close();
  });
});

describe('HeliusProvider - reset da serie de falhas', () => {
  it('N falhas + sucesso + nova falha: NAO entra em estado terminal (serie resetou)', async () => {
    const logs: string[] = [];
    const logger = {
      debug: (m: string) => logs.push(m),
      info: (m: string) => logs.push(m),
      warn: (m: string) => logs.push(m),
      error: (m: string) => logs.push(m),
    };
    let mode: 'fail' | 'ok' = 'fail';
    const p = new HeliusProvider({
      logger,
      wsUrl: 'wss://fake.local',
      backoff: { baseMs: 1, maxMs: 2, jitterRatio: 0 },
      maxReconnects: 3,
      webSocketFactory: (_url: string) => {
        void _url;
        class W extends EventEmitter {
          constructor() {
            super();
            queueMicrotask(() => {
              if (mode === 'fail') this.emit('error', new Error('down'));
              else this.emit('open');
            });
          }
          send(_d: unknown): void {
            void _d;
          }
          ping(): void {}
          close(): void {
            this.emit('close', 1006, Buffer.from(''));
          }
        }
        return new W() as unknown as import('ws').WebSocket;
      },
    });
    await expect(p.connect()).rejects.toThrowError(); // falha 1
    await expect(p.connect()).rejects.toThrowError(); // falha 2
    // sucesso: agora abre (sem subscriptions -> resolve direto)
    mode = 'ok';
    await expect(p.connect()).resolves.toBeUndefined();
    await p.close();
    // nova falha apos sucesso: nao pode entrar em terminal imediatamente
    mode = 'fail';
    await expect(p.connect()).rejects.toThrowError();
    expect(logs.some((l) => l.includes('estado terminal'))).toBe(false);
  });
});

describe('HeliusProvider - reconnect storm', () => {
  it('apos maxReconnects falhas consecutivas vira estado terminal (sem loop)', async () => {
    vi.useFakeTimers();
    try {
      const logs: string[] = [];
      const logger = {
        debug: (m: string) => logs.push(m),
        info: (m: string) => logs.push(m),
        warn: (m: string) => logs.push(m),
        error: (m: string) => logs.push(m),
      };
      let failEvery = true;
      const p = new HeliusProvider({
        logger,
        wsUrl: 'wss://fake.local',
        backoff: { baseMs: 1, maxMs: 2, jitterRatio: 0 },
        maxReconnects: 3,
        webSocketFactory: (_url: string) => {
          void _url;
          class FailingWs extends EventEmitter {
            constructor() {
              super();
              queueMicrotask(() => {
                if (failEvery) this.emit('error', new Error('down'));
                this.emit('close', 1006, Buffer.from(''));
              });
            }
            send(): void {}
            ping(): void {}
            close(): void {
              this.emit('close', 1006, Buffer.from(''));
            }
          }
          return new FailingWs() as unknown as import('ws').WebSocket;
        },
      });
      await expect(p.connect()).rejects.toThrowError(/falha ao conectar|logsSubscribe rejeitado/);
      failEvery = false;
      for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(5);
      expect(logs.some((l) => l.includes('estado terminal'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
[0m
[0m$ [0mgit log --all --oneline | Select-String -Pattern "cc64b8d"
cfca4f8 fix(review): consecutiveReconnects reseta em connect()/onOpen + teste de serie de falhas (HIGH cc64b8d)
829323d review(sprint/f1-5-enrichment): REJEITADO cc64b8d9db54422332e4016b2f86a8d332ee389a
cc64b8d fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + 
anti-orfao de sockets + teto maxReconnects + HIGH-2 leak resolvido
[0m
Let me examine the review that rejected the original commit and check the parent commit's state:
[0m$ [0mgit show 829323d --stat; git show 829323d | Select-String -Pattern "consecutiveReconnects|reset|estado 
terminal|ACHADOS|HIGH" -Context 1,1
commit 829323ddb67483f2d5dbab03ca56e5d7c7fcbe34
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 00:51:24 2026 -0300

    review(sprint/f1-5-enrichment): REJEITADO cc64b8d9db54422332e4016b2f86a8d332ee389a

 .../cc64b8d9db54422332e4016b2f86a8d332ee389a.md    | 969 +++++++++++++++++++++
 docs/reviews/state.json                            |   3 +-
 2 files changed, 971 insertions(+), 1 deletion(-)

  +
> +    fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + anti-orfao 
de 
> +sockets + teto maxReconnects + HIGH-2 leak resolvido
  +
  +[0m$ [0mgit log --oneline -5 cc64b8d9db54422332e4016b2f86a8d332ee389a
> +cc64b8d fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + 
> +anti-orfao de sockets + teto maxReconnects + HIGH-2 leak resolvido
  +fd6a5a6 fix(review): testes para markEnriched/markUndecodable/findUnenriched/incrementEnrichAttempt + guarda TOCTOU 
  +
> +    fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + anti-orfao 
de 
> +sockets + teto maxReconnects + HIGH-2 leak resolvido
  +
  +   webSocketFactory?: (url: string) => WebSocket;
> ++  /** Teto de reconexÔö£├ües consecutivas antes de estado terminal (default 50). */
  ++  maxReconnects?: number;
  +-  private subscriptionId: number | null = null;
> ++  /** Subscriptions por wallet no socket ATUAL (review 2ab477f HIGH-2: sem mapa = leak). */
  ++  private readonly subscriptionByWallet = new Map<string, number>();
  ++  /** Contagem de reconexoes consecutivas ├ö├ç├Â teto evita reconnect storm infinita. */
> ++  private consecutiveReconnects = 0;
  ++  private readonly maxReconnects: number;
  +     this.clearTimers();
> ++    // logsUnsubscribe de todas as subscriptions ativas (review HIGH-2).
  ++    this.sendAllUnsubscribes();
  +     return new Promise((resolve, reject) => {
> ++      // Anti-Ôö£ÔöérfÔö£├║o (review HIGH-2): fecha socket anterior ANTES de criar o novo.
  ++      const oldWs = this.ws;
  +         this.lastMessageAt = Date.now();
> +         this.reconnectBackoff.reset();
  +-        this.startHeartbeat();
  +     if (this.closed || this.reconnectTimer !== null) return;
> ++    // Teto de reconnect storm (review HIGH-2): passar do limite vira estado
  ++    // terminal ├ö├ç├Â logÔö£├¡vel pela camada superior; nÔö£├║o gera loop infinito.
> ++    if (this.consecutiveReconnects >= this.maxReconnects) {
> ++      this.logger.error('wss reconnects esgotados ├ö├ç├Â estado terminal (restart manual necessÔö£├¡rio)', {
  ++        errorClass: 'RPC_ERROR',
  ++    }
> ++    this.consecutiveReconnects++;
  +     const delay = this.reconnectBackoff.nextDelay();
  ++      delayMs: delay,
> ++      attempt: this.consecutiveReconnects,
  ++      maxReconnects: this.maxReconnects,
  +
> +    fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + anti-orfao 
de 
> +sockets + teto maxReconnects + HIGH-2 leak resolvido
  +
  ++/**
> ++ * Testes do HeliusProvider (review 2ab477f, HIGH-1/HIGH-2). ASCII-only.
  ++ * WebSocket fake injetavel; sem rede.
  ++  static instances: FakeWs[] = [];
> ++  static reset(): void { FakeWs.instances = []; }
  ++  sent: Array<Record<string, unknown>> = [];
  ++describe('HeliusProvider - subscriptions por wallet', () => {
> ++  beforeEach(() => { FakeWs.reset(); });
  ++  it('N wallets validas geram N logsSubscribe (1 mention cada)', async () => {
  ++describe('HeliusProvider - reconnect storm', () => {
> ++  it('apos maxReconnects falhas consecutivas vira estado terminal (sem loop)', async () => {
  ++    vi.useFakeTimers();
  ++      for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(5);
> ++      expect(logs.some((l) => l.includes('estado terminal'))).toBe(true);
  ++    } finally {
  +
> +    fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect storm) + anti-orfao 
de 
> +sockets + teto maxReconnects + HIGH-2 leak resolvido
  +
  ++/**
> ++ * Testes do RpcProvider (review 2ab477f HIGH-1): param v1 + failover + erro.
  ++ * ASCII-only; sem rede.
  +[0m$ [0mgit show cc64b8d9db54422332e4016b2f86a8d332ee389a:packages/solana/src/helius-provider.ts | Select-String 
> +-Pattern "subscriptionByWallet|maxReconnects|B58|sendAllUnsubscribes|consecutiveReconnects" | ForEach-Object { 
  +$_.LineNumber.ToString() + ": " + $_.Line }
  +97:   private readonly subscriptionByWallet = new Map<string, number>();
> +99:   private consecutiveReconnects = 0;
  +100:   private readonly maxReconnects: number;
  +349:           activeSubscriptions: this.subscriptionByWallet.size,
> +441:     if (this.consecutiveReconnects >= this.maxReconnects) {
  +444:         maxReconnects: this.maxReconnects,
> +449:     this.consecutiveReconnects++;
> +453:       attempt: this.consecutiveReconnects,
  +454:       maxReconnects: this.maxReconnects,
  +    "check:secrets": "node infrastructure/scripts/check-secrets.mjs",
> +    "check:security": "npm run check:secrets && npm audit --audit-level=high"
  +  },
  + 
> +HEAD is now at cc64b8d fix(review): HIGH-1 testes helius-provider (per-wallet subs, base58, unsubscribe, reconnect 
> +storm) + anti-orfao de sockets + teto maxReconnects + HIGH-2 leak resolvido
  +[0m
  +[0m
> +The producer's worktree exists but has no node_modules either. Final verification of my key finding ├ö├ç├Â grep the 
committed blob for any reset of the reconnect counter:
  +[0m$ [0mgit show cc64b8d9db54422332e4016b2f86a8d332ee389a:packages/solana/src/helius-provider.ts | Select-String 
> +-Pattern "consecutiveReconnects|maxReconnects|reconnectBackoff.reset" | ForEach-Object { $_.Line.Trim() }; "---"; 
git 
  +show cc64b8d9db54422332e4016b2f86a8d332ee389a:packages/solana/src/helius-provider.ts | Select-String -Pattern 
  +maxReconnects?: number;
> +private consecutiveReconnects = 0;
  +private readonly maxReconnects: number;
  +this.maxReconnects = options.maxReconnects ?? 50;
> +this.reconnectBackoff.reset();
> +if (this.consecutiveReconnects >= this.maxReconnects) {
  +maxReconnects: this.maxReconnects,
> +this.consecutiveReconnects++;
> +attempt: this.consecutiveReconnects,
  +maxReconnects: this.maxReconnects,
  +[0m
> +I have complete evidence. The committed blob confirms no reset of `consecutiveReconnects` anywhere, and 
`handleMessage` never gates on `params.subscription`. Cleaning up the temp file and delivering the verdict.
  +
  +
> +Commit revisado: `cc64b8d` (sprint/f1-5-enrichment) ├ö├ç├Â "fix(review): HIGH-1 testes helius-provider (... 
per-wallet subs, base58, unsubscribe, reconnect storm) + anti-orfao de sockets + teto maxReconnects + HIGH-2 leak 
resolvido"
  +
  +
> +## ACHADOS
  +
> +### A1 ├ö├ç├Â HIGH ├ö├ç├Â `consecutiveReconnects` NUNCA Ôö£┬« resetado ├ö├Ñ├å teto de "storm" vira teto de 
reconnects do tempo de vida; outage permanente sem recuperaÔö£┬║Ôö£├║o
> +**Arquivo:** `packages/solana/src/helius-provider.ts:437-467` (checagem na 441, incremento na 449; `onOpen` 204-224 
nÔö£├║o reseta)
  +
> +**EvidÔö£┬¼ncia:** o contador Ôö£┬« declarado (`= 0`, linha 99), incrementado em `scheduleReconnect` (449) e 
comparado (441) ├ö├ç├Â e **nunca** zerado. `onOpen` chama `this.reconnectBackoff.reset()` (206) mas nÔö£├║o o 
contador. `connect()` (144-147) reseta `closed` mas nÔö£├║o o contador. `close()` tampouco. Confirmei por grep no blob 
do commit: nenhuma ocorrÔö£┬¼ncia de reset.
  +
> +**Como reproduzir:** provider com `maxReconnects: 3`. Ciclo: conecta ├ö├Ñ├å blip de rede ├ö├Ñ├å close ├ö├Ñ├å 
reconnect **bem-sucedido** (sessÔö£├║o longa) ├ö├Ñ├å blip ├ö├Ñ├å ... Ao terceiro evento de reconnect (mesmo com 
sessÔö£├ües saudÔö£├¡veis entre eles, ou seja, NÔö£├óO consecutivos), o prÔö£Ôöéximo `close` dispara: `3 >= 3` ├ö├Ñ├å 
`closed = true` ├ö├Ñ├å `logger.error('... estado terminal ...')` ├ö├Ñ├å **stream morto para sempre**. Chamar 
`connect()` de novo reseta `closed` mas o contador fica em 3 ├ö├Ñ├å no primeiro close subsequente volta a terminal. 
Ôö£├£nica saÔö£┬ída: nova instÔö£├│ncia (equivale a restart manual ├ö├ç├Â sem observabilidade de quem restarta). Com 
default 50, um daemon de ingestion 24/7 com rede instÔö£├¡vel atinge terminal silenciosamente (sÔö£Ôöé um log entre o 
ruÔö£┬ído) apÔö£Ôöés 50 blips no total.
  +
> +**SugestÔö£├║o:** zerar `consecutiveReconnects` no `onOpen` junto do `reconnectBackoff.reset()`, e tambÔö£┬«m no 
`connect()`. O teste novo (`reconnect storm`) sÔö£Ôöé cobre o caminho de falhas consecutivas; nÔö£├║o cobre reset 
apÔö£Ôöés sucesso. Adicionar teste: N falhas ├ö├Ñ├å sucesso ├ö├Ñ├å nova falha ├ö├Ñ├å nÔö£├║o deve entrar em terminal 
antes de N reconnects *consecutivos*.
  +
  +
> +### A4 ├ö├ç├Â LOW ├ö├ç├Â apÔö£Ôöés `connect()` rejeitado, loop de reconnect continua em background; estado terminal 
nÔö£├║o Ôö£┬« exposto programaticamente
  +**Arquivo:** `packages/solana/src/helius-provider.ts:216-223`, `437-467`
  +
> +**EvidÔö£┬¼ncia:** no catch do onOpen, `ws.close()` ├ö├Ñ├å o handler de `close` (239-244) dispara 
`scheduleReconnect()` ├ö├ç├Â rejeiÔö£┬║Ôö£├║o de `connect()` nÔö£├║o aborta o background; o provider fica tentando 
reconectar (atÔö£┬« maxReconnects) sem que o chamador saiba. O estado terminal sÔö£Ôöé vira `logger.error` com 
`errorClass: 'RPC_ERROR'` como **campo de log** (442-445) ├ö├ç├Â nenhuma promise/evento/status consultÔö£├¡vel; camada 
superior precisa parsear log para detectar. Vai contra a prioridade OBSERVABILIDADE.
  +
  +3. **Race subscribeWallets durante connect()** ├ö├ç├Â janela `connected=false` com subs em voo: wallet perdida (A3).
> +4. **ExecuÔö£┬║Ôö£├║o da suÔö£┬íte:** **nÔö£├║o executÔö£├¡vel** ├ö├ç├Â `node_modules` vazio no repo (0 pacotes; 
sem vitest local); tentei worktree temporÔö£├¡rio em `%TEMP%` (detached HEAD em cc64b8d, junction de node_modules) 
├ö├ç├Â sem dependÔö£┬¼ncias instaladas, `vitest` nÔö£├║o resolve. `mklink` e worktree foram removidos (nenhum 
commit/ref criado). ValidaÔö£┬║Ôö£├║o dos testes (FakeWs, confirmSubs, storm com fake timers, rpc-provider fetchFn) 
foi feita por rastreamento estÔö£├¡tico: o fluxo dos testes Ôö£┬« internamente consistente e deve passar quando as 
dependÔö£┬¼ncias existirem ├ö├ç├Â exceto que **nÔö£├║o hÔö£├¡ teste para reset do contador** (A1) nem para re-sub 
duplicado (A2), exatamente onde estÔö£├║o os bugs.
  +5. **VerificaÔö£┬║Ôö£├║o de encoding:** `helius-provider.test.ts` e `rpc-provider.test.ts` 100% ASCII (bate com o 
cabeÔö£┬║alho "ASCII-only"); `helius-provider.ts` UTF-8 vÔö£├¡lido, sem BOM, sem mojibake.
  +
> +**Achados resumidos:** A1 HIGH (contador de reconnect nunca resetado ├ö├Ñ├å terminal permanente apÔö£Ôöés 
reconnects nÔö£├║o-consecutivos; sem recuperaÔö£┬║Ôö£├║o via `connect()`; sem teste) Ôö¼├Ç A2 MEDIUM (re-sub duplicado 
no subscribe incremental + unsubscribe Ôö£ÔöérfÔö£├║o + notificaÔö£┬║Ôö£├ües sem gate por subscription id ├ö├Ñ├å 
eventos duplicados) Ôö¼├Ç A3 MEDIUM (race `subscribeWallets` durante `connect()` ├ö├Ñ├å wallet nunca subscrita, 
silenciosa) Ôö¼├Ç A4 LOW (reconnect em background apÔö£Ôöés `connect()` rejeitado; terminal sem exposiÔö£┬║Ôö£├║o 
programÔö£├¡tica) Ôö¼├Ç A5 LOW (connect concorrente ├ö├Ñ├å pendings presos, leak introduzido pelo removeAllListeners) 
Ôö¼├Ç A6 LOW (regex base58 heurÔö£┬ística aceita nÔö£├║o-pubkeys).
  +
> +**CondiÔö£┬║Ôö£├║o para aprovaÔö£┬║Ôö£├║o:** zerar `consecutiveReconnects` no `onOpen`/`connect()` + teste que 
comprove reset apÔö£Ôöés sucesso (A1); decidir tratamento do re-sub incremental e filtrar notificaÔö£┬║Ôö£├ües por 
subscription id (A2); fechar a janela do A3; rodar lint/typecheck/test com dependÔö£┬¼ncias instaladas e anexar 
evidÔö£┬¼ncia.
  +
[0m
[0m$ [0mgit diff cfca4f8^ cfca4f8 -- packages/solana/src/helius-provider.ts
diff --git a/packages/solana/src/helius-provider.ts b/packages/solana/src/helius-provider.ts
index 93fb859..e177986 100644
--- a/packages/solana/src/helius-provider.ts
+++ b/packages/solana/src/helius-provider.ts
@@ -143,6 +143,7 @@ export class HeliusProvider implements BlockchainDataProvider {
 
   connect(): Promise<void> {
     this.closed = false;
+    this.consecutiveReconnects = 0; // reset explicito no boot
     return this.openSocket();
   }
 
@@ -204,6 +205,7 @@ export class HeliusProvider implements BlockchainDataProvider {
       const onOpen = (): void => {
         this.lastMessageAt = Date.now();
         this.reconnectBackoff.reset();
+        this.consecutiveReconnects = 0; // sucesso reseta a serie de falhas
         this.logger.info('wss conectado', { urlHost: safeHost(this.wsUrl) });
         // connected s├│ ├® P├ÜBLICO ap├│s todas as subscriptions confirmadas; falha
         // parcial n├úo deixa socket aberto com subs vivas (fecha e rejeita).
[0m
I have the full picture now. Let me verify whether the tests can actually be executed, to empirically confirm my static analysis of the new test:
[0m$ [0mTest-Path "node_modules"; Test-Path "packages\solana\node_modules"; Get-ChildItem -Directory .. | 
Select-Object -ExpandProperty Name
True
False
copy trade
copytrade 2
copytrade-wt-f1-5-enrichment
copytrade-wt-f1-postgres-live
copytrade-wt-f1-security-fixes
copytrade-wt-f1-security-fixes-2
jogos
perfil adrenalin
programa´┐¢´┐¢ao
prompts
[0m
[0m$ [0mgit branch -a; git worktree list
backup/pre-squash-f1-5
* master
+ sprint/f1-5-enrichment
+ sprint/f1-postgres-live
+ sprint/f1-security-fixes
+ sprint/f1-security-fixes-2
  remotes/origin/HEAD -> origin/master
  remotes/origin/dependabot/github_actions/actions/checkout-7
  remotes/origin/dependabot/github_actions/actions/setup-node-7
  remotes/origin/dependabot/npm_and_yarn/fast-check-4.10.2
  remotes/origin/dependabot/npm_and_yarn/prisma-7.10.0
  remotes/origin/dependabot/npm_and_yarn/prisma/client-7.10.0
  remotes/origin/dependabot/npm_and_yarn/protocolo-critico-1885cac2e2
  remotes/origin/dependabot/npm_and_yarn/tooling-3930011c01
  remotes/origin/dependabot/npm_and_yarn/types/node-26.6.2
  remotes/origin/dependabot/npm_and_yarn/zod-4.6.5
  remotes/origin/master
C:/Users/enzo/Desktop/copytrade 2                      b7364bc [master]
C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment     d016b8b [sprint/f1-5-enrichment]
C:/Users/enzo/Desktop/copytrade-wt-f1-postgres-live    cbd49d4 [sprint/f1-postgres-live]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes   19ffacc [sprint/f1-security-fixes]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes-2 df98063 [sprint/f1-security-fixes-2]
[0m
[93m[1m! [0mpermission requested: external_directory (C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment\*); 
auto-rejecting
[0mÔ£ù [0mTest-Path "node_modules"; Test-Path "node_modules\.bin\vitest.cmd"; git log --oneline -3 failed
[91m[1mError: [0mThe user rejected permission to use this specific tool call.
The producer's worktree exists. Let me check if I can empirically validate the test behavior ÔÇö first, does the worktree have dependencies?

