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
        params: { result: { context: { slot: 9 }, value: { signature: W('5',) + 'x'.repeat(44) } }, subscription: 4242 },
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
