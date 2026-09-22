/**
 * Testes do repository de ObservedEvent com fake em memória.
 * O client é injetado — o singleton Prisma NUNCA é importado aqui.
 */
import { describe, expect, it } from 'vitest';

import {
  existsObservedEvent,
  insertObservedEvent,
  type ObservedEventDelegate,
  type ObservedEventInsertData,
} from './observed-events.js';
import { RepositoryError } from './errors.js';

/** Fake em memória que simula a unique constraint (signature, instructionIndex, wallet). */
function makeFakeClient(behavior: { failWith?: Error } = {}) {
  const store = new Set<string>();
  const key = (d: { signature: string; instructionIndex: number; wallet: string }) =>
    `${d.signature}:${d.instructionIndex}:${d.wallet}`;

  const observedEvent: ObservedEventDelegate = {
    async create({ data }: { data: ObservedEventInsertData }) {
      if (behavior.failWith) throw behavior.failWith;
      const k = key(data);
      if (store.has(k)) {
        const err = new Error('Unique constraint failed') as Error & { code: string };
        err.code = 'P2002';
        throw err;
      }
      store.add(k);
      return { id: `id-${store.size}`, ...data };
    },
    async findUnique({ where }: { where: { signature_instructionIndex_wallet: { signature: string; instructionIndex: number; wallet: string } } }) {
      const k = key(where.signature_instructionIndex_wallet);
      return store.has(k) ? { id: 'found' } : null;
    },
  };
  return { observedEvent };
}

const event = {
  signature: 'sig-abc',
  instructionIndex: 0,
  wallet: 'wallet-xyz',
  eventType: 'BUY',
} satisfies ObservedEventInsertData;

describe('insertObservedEvent', () => {
  it('retorna "inserted" em inserção nova', async () => {
    const client = makeFakeClient();
    await expect(insertObservedEvent(client, event)).resolves.toBe('inserted');
  });

  it('retorna "duplicate" em P2002 (idempotência, não é erro)', async () => {
    const client = makeFakeClient();
    await insertObservedEvent(client, event);
    await expect(insertObservedEvent(client, event)).resolves.toBe('duplicate');
  });

  it('propaga outros erros como RepositoryError(DATABASE_ERROR)', async () => {
    const client = makeFakeClient({ failWith: new Error('connection reset') });
    await expect(insertObservedEvent(client, event)).rejects.toMatchObject({
      name: 'RepositoryError',
      errorClass: 'DATABASE_ERROR',
    });
  });

  it('P2002 sintético vindo de fora também vira "duplicate"', async () => {
    const p2002 = new Error('dup') as Error & { code: string };
    p2002.code = 'P2002';
    const client = makeFakeClient({ failWith: p2002 });
    await expect(insertObservedEvent(client, event)).resolves.toBe('duplicate');
  });
});

describe('existsObservedEvent', () => {
  it('false antes, true depois do insert', async () => {
    const client = makeFakeClient();
    await expect(existsObservedEvent(client, event)).resolves.toBe(false);
    await insertObservedEvent(client, event);
    await expect(existsObservedEvent(client, event)).resolves.toBe(true);
  });

  it('erros de infra propagam classificados', async () => {
    const client = makeFakeClient();
    client.observedEvent.findUnique = () => Promise.reject(new Error('down'));
    await expect(existsObservedEvent(client, event)).rejects.toBeInstanceOf(RepositoryError);
  });
});
