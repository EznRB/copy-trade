import { describe, expect, it } from 'vitest';

import { appendAuditLog, type AuditLogDelegate } from './audit-log.js';

interface Captured {
  actor: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}

function makeFakeAuditLog(behavior: { failWith?: Error } = {}) {
  const captured: Captured[] = [];
  const auditLog: AuditLogDelegate = {
    async create({ data }: { data: Captured }) {
      if (behavior.failWith) throw behavior.failWith;
      captured.push(data);
      return { id: `audit-${captured.length}` };
    },
  };
  return { client: { auditLog }, captured };
}

describe('appendAuditLog (append-only: nenhuma API de update/delete existe)', () => {
  it('mapeia who/what/why/target corretamente', async () => {
    const { client, captured } = makeFakeAuditLog();
    const when = new Date('2026-09-21T12:00:00Z');
    await appendAuditLog(client, {
      who: 'agent:risk-security',
      what: 'risk.config.update',
      target: 'MAX_POSITION_LAMPORTS',
      why: 'gate F10 aprovada',
      when,
      details: { before: 100, after: 200 },
    });
    const entry = captured[0];
    expect(entry?.actor).toBe('agent:risk-security');
    expect(entry?.action).toBe('risk.config.update');
    expect(entry?.target).toBe('MAX_POSITION_LAMPORTS');
    expect(entry?.details?.['why']).toBe('gate F10 aprovada');
    expect(entry?.details?.['when']).toBe('2026-09-21T12:00:00.000Z');
    expect(entry?.details?.['data']).toEqual({ before: 100, after: 200 });
  });

  it('rejeita append anônimo (VALIDATION_ERROR, não toca no client)', async () => {
    const { client, captured } = makeFakeAuditLog();
    await expect(
      appendAuditLog(client, { who: '', what: 'x' }),
    ).rejects.toMatchObject({ errorClass: 'VALIDATION_ERROR' });
    expect(captured).toHaveLength(0);
  });

  it('erros de DB propagam classificados', async () => {
    const { client } = makeFakeAuditLog({ failWith: new Error('disk full') });
    await expect(
      appendAuditLog(client, { who: 'a', what: 'b' }),
    ).rejects.toMatchObject({ errorClass: 'DATABASE_ERROR' });
  });
});
