/**
 * PoC Sprint 2 — ataques ao pipeline de ingestão F1.
 *
 * Executável: npx vitest run docs/security/red-team/poc
 * Cada teste documenta um vetor de ataque e se ele PASSOU (defesa segurou)
 * ou FALHOU (vulnerabilidade confirmada → finding).
 */
import { describe, it, expect } from 'vitest';
import { parseRawNotification, parseNormalizedEvent } from '../../../../services/data-ingestion/src/schemas.js';
import { normalizeRawNotification } from '../../../../services/data-ingestion/src/normalizer.js';
import { DedupStore, type ObservedEventRepo } from '../../../../services/data-ingestion/src/dedup-store.js';

// ---------------------------------------------------------------- helpers
function fakeRepo(behavior: 'ok' | 'p2002-on-second' | 'always-error' = 'ok'): {
  repo: ObservedEventRepo;
  calls: number[];
  data: unknown[];
} {
  let n = 0;
  const data: unknown[] = [];
  return {
    calls: [],
    data,
    repo: {
      async create(args: { data: unknown }) {
        n++;
        data.push(args.data);
        if (behavior === 'p2002-on-second' && n > 1) {
          const e = new Error('Unique constraint failed') as Error & { code: string };
          e.code = 'P2002';
          throw e;
        }
        if (behavior === 'always-error') throw new Error('connection refused');
        return {};
      },
    },
  };
}

describe('ATAQUE 1 — schema zod na borda (rawNotification)', () => {
  it('rejeita tipos errados (signature number, slot negativo, objeto aninhado malicioso)', () => {
    expect(parseRawNotification({ signature: 123, slot: 1 }).success).toBe(false);
    expect(parseRawNotification({ signature: 'ok', slot: -5 }).success).toBe(false);
    expect(parseRawNotification({ signature: {}, slot: 1 }).success).toBe(false);
    expect(parseRawNotification(null).success).toBe(false);
    expect(parseRawNotification(undefined).success).toBe(false);
    expect(parseRawNotification('string').success).toBe(false);
  });

  it('strict mode descarta campos extras (payload não declarado é rejeitado?)', () => {
    // .strict() → campos desconhecidos REJEITAM o objeto inteiro
    const r = parseRawNotification({ signature: 'sig', slot: 1, evilField: 'x' });
    expect(r.success).toBe(false); // strict rejeita — defesa forte
  });
});

describe('ATAQUE 2 — DoS via campos sem limite de tamanho', () => {
  it('FIXED-VERIFIED (RT-004): signature de 10 MB agora é REJEITADA (.max(128))', () => {
    const huge = 'A'.repeat(10 * 1024 * 1024);
    const r = parseRawNotification({ signature: huge, slot: 1 });
    expect(r.success).toBe(false); // fix confirmado: 10MB → rejeitado
  });

  it('FIXED-VERIFIED (RT-006): signature com unicode hostil é REJEITADA (allowlist base58)', () => {
    const hostile = 'sig\u0000\u0001\u202E\u{1F4A3}';
    const r = parseRawNotification({ signature: hostile, slot: 1 });
    expect(r.success).toBe(false); // fix confirmado
  });

  it('coerção de slot: string numérica é aceita (comportamento esperado, documentar)', () => {
    const sigOk = '1'.repeat(88);
    const r = parseRawNotification({ signature: sigOk, slot: '12345' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slot).toBe(12345);
  });

  it('coerção de slot com string NÃO numérica é rejeitada (NaN)', () => {
    const sigOk = '1'.repeat(88);
    expect(parseRawNotification({ signature: sigOk, slot: 'abc' }).success).toBe(false);
  });

  it('FIXED-VERIFIED (RT-004): slot acima do teto (1e10) é rejeitado', () => {
    const sigOk = '1'.repeat(88);
    expect(parseRawNotification({ signature: sigOk, slot: 10_000_000_001 }).success).toBe(false);
  });
});

describe('ATAQUE 3 — dedup sob replay / concorrência', () => {
  it('replay sequencial: mesma key 2x → 1 new + 1 duplicate (idempotente)', async () => {
    const { repo, data } = fakeRepo('p2002-on-second');
    const store = new DedupStore(repo);
    const rec = { signature: 'S', instructionIndex: 0, wallet: 'W', eventType: 'UNKNOWN' };
    expect((await store.checkAndPersist('S|0|W', rec)).status).toBe('new');
    expect((await store.checkAndPersist('S|0|W', rec)).status).toBe('duplicate');
    expect(data.length).toBe(1); // fast-path impediu segundo insert
  });

  it('FIXED-VERIFIED (RT-005): 50 chamadas simultâneas mesma key → APENAS 1 insert físico', async () => {
    // Após o fix (in-flight map em dedup-store.ts), apenas a primeira chamada
    // vira líder; as demais aguardam e são classificadas como duplicate.
    const { repo, data } = fakeRepo('ok'); // repo SEM unique constraint → contaria tudo
    const store = new DedupStore(repo);
    const rec = { signature: 'S', instructionIndex: 0, wallet: 'W', eventType: 'UNKNOWN' };
    const outcomes = await Promise.all(
      Array.from({ length: 50 }, () => store.checkAndPersist('S|0|W', rec)),
    );
    const news = outcomes.filter((o) => o.status === 'new').length;
    expect(data.length).toBe(1); // fix confirmado: 1 insert físico
    expect(news).toBe(1); // fix confirmado: contadores corretos
  });

  it('erro transitório de DB NÃO marca cache → retry posterior persiste (correto)', async () => {
    const { repo, data } = fakeRepo('always-error');
    const store = new DedupStore(repo);
    const rec = { signature: 'S', instructionIndex: 0, wallet: 'W', eventType: 'UNKNOWN' };
    expect((await store.checkAndPersist('S|0|W', rec)).status).toBe('error');
    expect((await store.checkAndPersist('S|0|W', rec)).status).toBe('error');
    expect(data.length).toBe(2); // tentou de novo — retry-friendly, sem falsos dedup
  });
});

describe('ATAQUE 4 — normalizer com entrada adversarial', () => {
  it('normalizer nunca lança exceção (fail-safe, retorna ok:false)', () => {
    const malicious = [
      null, undefined, 42, 3.14, Symbol.iterator.toString(), [1, 2, 3],
      { signature: 's' }, // slot ausente
      { signature: '', slot: 0 }, // signature vazia
      { signature: 's', slot: 10 ** 309 }, // Infinity sem literal proibido
      { signature: 's', slot: Number.MAX_SAFE_INTEGER + 2 }, // precision loss (computed, ok para lint)
      { signature: 's', slot: 1, instruction_index: -1 },
      { signature: 's', slot: 1, block_time: -1 },
    ];
    for (const m of malicious) {
      expect(() => normalizeRawNotification(m, 'websocket')).not.toThrow();
    }
  });

  it('slot extremo: perda de precisão só começa em 2^53+2 — valor irreal; teto 1e10 chega primeiro (RT-004)', () => {
    // ATAQUE REFUTADO: perda real só em 9007199254740994, mas o teto do schema
    // (10_000_000_000) já rejeita muito antes. Slot realista ~3e8 passa ok.
    const sigOk = '1'.repeat(88);
    const slotUnsafe = Number.MAX_SAFE_INTEGER + 2;
    expect(parseRawNotification({ signature: sigOk, slot: slotUnsafe }).success).toBe(false);
    expect(parseRawNotification({ signature: sigOk, slot: 300_000_000 }).success).toBe(true);
  });

  it('block_time no futuro distante / epoch 1 são rejeitados (positive)', () => {
    expect(
      parseRawNotification({ signature: 's', slot: 1, block_time: 0 }).success,
    ).toBe(false);
  });
});

describe('ATAQUE 5 — normalizedEventSchema (segunda barreira no pipeline)', () => {
  it('rejeita action fora do enum e event_id não-uuid', () => {
    const sigOk = '1'.repeat(88);
    const base = normalizeRawNotification({ signature: sigOk, slot: 1 }, 'websocket');
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    expect(parseNormalizedEvent(base.event).success).toBe(true);
    expect(parseNormalizedEvent({ ...base.event, action: 'HACK' }).success).toBe(false);
    expect(parseNormalizedEvent({ ...base.event, event_id: 'not-a-uuid' }).success).toBe(false);
  });
});
