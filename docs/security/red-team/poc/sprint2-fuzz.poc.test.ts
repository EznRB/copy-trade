/**
 * PoC Sprint 2 — property-based fuzzing (fast-check) no normalizer + dedup.
 * Executável: npx vitest run --config docs/security/red-team/poc/vitest.poc.config.mjs
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeRawNotification } from '../../../../services/data-ingestion/src/normalizer.js';
import { parseRawNotification } from '../../../../services/data-ingestion/src/schemas.js';

describe('FUZZ 1 — normalizer nunca crasha com NADA', () => {
  it('property: para qualquer input arbitrário, normalizeRawNotification retorna (nunca joga)', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = normalizeRawNotification(input, 'websocket');
        expect(r).toHaveProperty('ok');
        if (!r.ok) expect(r.error).toBeInstanceOf(Error);
      }),
      { numRuns: 500 },
    );
  });
});

describe('FUZZ 2 — o que PASSA na validação revela o envelope aceito', () => {
  it('property: inputs arbitrários que passam são sempre objetos com signature string non-empty + slot int>=0', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = parseRawNotification(input);
        if (!r.success) return; // rejeitado, ok
        // invariantes garantidas pós-parse:
        expect(typeof r.data.signature).toBe('string');
        expect(r.data.signature.length).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(r.data.slot)).toBe(true);
        expect(r.data.slot).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('property: descobrir se algum input aleatório consegue signature vazia ou slot negativo (should never happen)', () => {
    let violations = 0;
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = parseRawNotification(input);
        if (r.success && (r.data.signature.length === 0 || r.data.slot < 0 || !Number.isInteger(r.data.slot))) {
          violations++;
        }
      }),
      { numRuns: 2000 },
    );
    expect(violations).toBe(0); // invariante de segurança
  });
});
