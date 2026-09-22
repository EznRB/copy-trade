import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ExponentialBackoff,
  backoffBase,
  computeBackoffDelay,
  resolveBackoffOptions,
} from './backoff.js';

/**
 * Property tests do backoff (vitest + fast-check):
 * 1. base determinística cresce monotonicamente até o cap;
 * 2. delay nunca é negativo e nunca excede o cap;
 * 3. delay com jitter permanece dentro do intervalo teórico.
 */

const optsArb = fc.record({
  baseMs: fc.integer({ min: 1, max: 10_000 }),
  maxMs: fc.integer({ min: 1, max: 60_000 }),
  jitterRatio: fc.double({ min: 0, max: 1, noNaN: true }),
});

const validOptsArb = optsArb.filter((o) => o.baseMs <= o.maxMs);

// random ∈ [0,1) — inclui extremos via constantFrom para cobrir bordas
const randomArb = fc.oneof(
  fc.constant(0),
  fc.constant(0.999999),
  fc.double({ min: 0, max: 0.999999, noNaN: true }),
);

describe('backoff exponencial + jitter (property)', () => {
  it('base determinística cresce monotonicamente até o cap', () => {
    fc.assert(
      fc.property(validOptsArb, (opts) => {
        const attempts = Array.from({ length: 30 }, (_, i) => i);
        const bases = attempts.map((a) => backoffBase(a, opts));
        for (let i = 1; i < bases.length; i++) {
          expect(bases[i]).toBeGreaterThanOrEqual(bases[i - 1]!);
        }
        // após crescer, estabiliza exatamente no cap
        const last = bases[bases.length - 1]!;
        expect(last).toBe(opts.maxMs);
        // base inicial = baseMs (quando baseMs <= maxMs)
        expect(bases[0]).toBe(opts.baseMs);
      }),
    );
  });

  it('delay nunca é negativo e nunca excede o cap', () => {
    fc.assert(
      fc.property(optsArb, fc.nat({ max: 40 }), randomArb, (opts, attempt, rand) => {
        const delay = computeBackoffDelay(attempt, { ...opts, random: () => rand });
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(opts.maxMs);
      }),
    );
  });

  it('delay com jitter fica dentro do intervalo teórico', () => {
    fc.assert(
      fc.property(optsArb, fc.nat({ max: 40 }), randomArb, (opts, attempt, rand) => {
        const delay = computeBackoffDelay(attempt, { ...opts, random: () => rand });
        const base = backoffBase(attempt, opts);
        const lowerBound = Math.max(0, base * (1 - opts.jitterRatio));
        const upperBound = Math.min(base * (1 + opts.jitterRatio), opts.maxMs);
        const eps = Number.EPSILON * Math.max(1, upperBound) * 4;
        expect(delay).toBeGreaterThanOrEqual(Math.max(0, Math.min(lowerBound, upperBound) - eps));
        expect(delay).toBeLessThanOrEqual(upperBound + eps);
      }),
    );
  });

  it('com jitterRatio = 0 o delay é idêntico à base determinística', () => {
    fc.assert(
      fc.property(validOptsArb, fc.nat({ max: 40 }), randomArb, (opts, attempt, rand) => {
        const delay = computeBackoffDelay(attempt, {
          ...opts,
          jitterRatio: 0,
          random: () => rand,
        });
        expect(delay).toBe(backoffBase(attempt, opts));
      }),
    );
  });

  it('ExponentialBackoff: sequência respeita cap e reset volta ao início', () => {
    fc.assert(
      fc.property(validOptsArb, fc.integer({ min: 1, max: 30 }), (opts, steps) => {
        const backoff = new ExponentialBackoff({ ...opts, jitterRatio: 0 });
        let prev = -1;
        for (let i = 0; i < steps; i++) {
          const d = backoff.nextDelay();
          expect(d).toBeGreaterThanOrEqual(prev);
          expect(d).toBeLessThanOrEqual(opts.maxMs);
          prev = d;
        }
        backoff.reset();
        expect(backoff.currentAttempt).toBe(0);
        expect(backoff.nextDelay()).toBe(backoffBase(0, opts));
      }),
    );
  });

  it('resolveBackoffOptions aplica defaults documentados (cap 30s)', () => {
    const resolved = resolveBackoffOptions();
    expect(resolved.maxMs).toBe(30_000);
    expect(resolved.baseMs).toBeGreaterThan(0);
    expect(resolved.jitterRatio).toBeGreaterThanOrEqual(0);
  });
});
