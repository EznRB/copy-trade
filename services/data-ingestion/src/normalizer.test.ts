import { describe, it, expect } from 'vitest';
import { normalizeRawNotification } from './normalizer.js';

const SOURCE = 'helius_wss';

describe('normalizeRawNotification', () => {
  it('normaliza entrada válida (campos ausentes → null, action=UNKNOWN)', () => {
    const r = normalizeRawNotification({ signature: 'sig-x', slot: 123, wallet: 'W1' }, SOURCE);
    if (!r.ok) throw new Error('esperava ok');
    expect(r.event.signature).toBe('sig-x');
    expect(r.event.slot).toBe(123);
    expect(r.event.instruction_index).toBe(0);
    expect(r.event.action).toBe('UNKNOWN');
    expect(r.event.sol_amount).toBeNull();
    expect(r.event.price).toBeNull();
    expect(r.event.latency_ms).toBeNull();
    expect(r.event.event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.event.correlation_id).toBeTruthy();
  });

  it('rejeita entrada malformada sem lançar exceção', () => {
    const r = normalizeRawNotification({ slot: 'x' }, SOURCE); // falta signature
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('VALIDATION_ERROR');
  });

  it('wallet ausente vira UNKNOWN; null e undefined são rejeitados', () => {
    const okR = normalizeRawNotification({ signature: 's', slot: 1 }, SOURCE);
    expect(okR.ok && okR.event.wallet).toBe('UNKNOWN');
    expect(normalizeRawNotification(null, SOURCE).ok).toBe(false);
    expect(normalizeRawNotification(undefined, SOURCE).ok).toBe(false);
  });
});
