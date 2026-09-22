import { describe, expect, it } from 'vitest';

import { recordSystemEvent, type SystemEventDelegate } from './system-events.js';

interface Captured {
  kind: string;
  severity: string;
  message: string;
  details?: unknown;
}

function makeFakeSystemEvents(behavior: { failWith?: Error } = {}) {
  const captured: Captured[] = [];
  const systemEvent: SystemEventDelegate = {
    async create({ data }: { data: Captured }) {
      if (behavior.failWith) throw behavior.failWith;
      captured.push(data);
      return { id: `sys-${captured.length}` };
    },
  };
  return { client: { systemEvent }, captured };
}

describe('recordSystemEvent', () => {
  it('mapeia type/metadata/severity para kind/details/severity', async () => {
    const { client, captured } = makeFakeSystemEvents();
    const res = await recordSystemEvent(client, {
      type: 'provider_disconnected',
      message: 'helius ws caiu',
      severity: 'error',
      metadata: { attempts: 3 },
    });
    expect(res.id).toBe('sys-1');
    expect(captured[0]).toEqual({
      kind: 'provider_disconnected',
      severity: 'error',
      message: 'helius ws caiu',
      details: { attempts: 3 },
    });
  });

  it('severity default é "info" e metadata é omitida quando ausente', async () => {
    const { client, captured } = makeFakeSystemEvents();
    await recordSystemEvent(client, { type: 'boot', message: 'ok' });
    expect(captured[0]?.severity).toBe('info');
    expect(captured[0]).not.toHaveProperty('details');
  });

  it('erros propagam como DATABASE_ERROR', async () => {
    const { client } = makeFakeSystemEvents({ failWith: new Error('x') });
    await expect(
      recordSystemEvent(client, { type: 't', message: 'm' }),
    ).rejects.toMatchObject({ errorClass: 'DATABASE_ERROR' });
  });
});
