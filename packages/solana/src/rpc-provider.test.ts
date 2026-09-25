/**
 * Testes do RpcProvider (review 2ab477f HIGH-1): param v1 + failover + erro.
 * ASCII-only; sem rede.
 */
import { describe, it, expect } from 'vitest';
import { RpcProvider, ClassifiedError } from './rpc-provider.js';

const silent = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const FAST = { baseMs: 1, maxMs: 2, jitterRatio: 0 } as const;

function ep(name: string, tier: 'primary' | 'secondary' | 'tertiary') {
  return { name, url: `https://${name}.example`, tier };
}

describe('RpcProvider', () => {
  it('getTransaction envia maxSupportedTransactionVersion=1', async () => {
    const seen: string[] = [];
    const fetchFn = (async (_u: string | URL | Request, init?: RequestInit) => {
      seen.push(String(JSON.parse(String(init?.body)).params?.[1]?.maxSupportedTransactionVersion));
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const rpc = new RpcProvider([ep('p', 'primary')], { logger: silent, fetchFn });
    await rpc.getTransaction('5'.repeat(88));
    expect(seen).toEqual(['1']);
  });

  it('HTTP 500 no primario classifica como RPC_ERROR', async () => {
    const fetchFn = (async () => new Response('down', { status: 500 })) as unknown as typeof fetch;
    const rpc = new RpcProvider([ep('p', 'primary')], {
      logger: silent,
      fetchFn,
      maxAttempts: 2,
      backoff: FAST,
      requestTimeoutMs: 500,
    });
    await expect(rpc.getSlot()).rejects.toBeInstanceOf(ClassifiedError);
  });

  it('failover: primario morto, secundario responde', async () => {
    const fetchFn = (async (u: string | URL | Request) => {
      if (String(u).includes('p1')) return new Response('down', { status: 500 });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 123 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const rpc = new RpcProvider([ep('p1', 'primary'), ep('s1', 'secondary')], {
      logger: silent,
      fetchFn,
      failoverThreshold: 1,
      maxAttempts: 4,
      backoff: FAST,
      requestTimeoutMs: 500,
    });
    expect(await rpc.getSlot()).toBe(123);
  });
});
