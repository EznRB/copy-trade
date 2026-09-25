# Review fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e

- Branch: sprint/f1-5-enrichment
- Data: 2026-09-25 00:16:24
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
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e --stat
commit fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 00:12:32 2026 -0300

    fix(review): testes para markEnriched/markUndecodable/findUnenriched/incrementEnrichAttempt + guarda TOCTOU 
(updateMany where enrichedAt null) + schema.prisma ASCII puro

 packages/database/prisma/schema.prisma             |  18 +-
 .../repositories/observed-events.enrich.test.ts    | 194 +++++++++++++++++++++
 .../database/src/repositories/observed-events.ts   |  57 ++++--
 3 files changed, 249 insertions(+), 20 deletions(-)
[0m
[0m$ [0mgit log --oneline -5 fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e; git branch --contains 
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e
fd6a5a6 fix(review): testes para markEnriched/markUndecodable/findUnenriched/incrementEnrichAttempt + guarda TOCTOU 
(updateMany where enrichedAt null) + schema.prisma ASCII puro
5299d25 docs(f1.5): roadmap/handoff/ADR-025 + artefatos de evidencia (fixtures + backfill 10k = 19.1%)
38cdaac chore: lock files fora do repo
2ab477f feat(f1.5): fixtures reais mainnet 10/10 vs Helius Enhanced (8 PumpSwap + 2 curve) + logsSubscribe 1-endereco 
+ getTransaction v1
c438ef1 feat(f1.5): enricher (decode pump/pumpswap) + runner batch + wiring no boot + exports do database
+ sprint/f1-5-enrichment
[0m
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e -- packages/database/prisma/schema.prisma 
packages/database/src/repositories/observed-events.ts
commit fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 00:12:32 2026 -0300

    fix(review): testes para markEnriched/markUndecodable/findUnenriched/incrementEnrichAttempt + guarda TOCTOU 
(updateMany where enrichedAt null) + schema.prisma ASCII puro

diff --git a/packages/database/prisma/schema.prisma b/packages/database/prisma/schema.prisma
index 5a12b12..ee0b14e 100644
--- a/packages/database/prisma/schema.prisma
+++ b/packages/database/prisma/schema.prisma
@@ -1,5 +1,5 @@
-// @ct/database ÔÇö Prisma schema v1 (Fases 1ÔÇô9)
-// Fonte de verdade para persist├¬ncia. Nunca adicionar secrets aqui (somente env refs).
+// @ct/database ? Prisma schema v1 (Fases 1?9)
+// Fonte de verdade para persist?ncia. Nunca adicionar secrets aqui (somente env refs).
 
 datasource db {
   provider = "postgresql"
@@ -25,7 +25,7 @@ model Wallet {
   metrics        WalletMetric[]
   trades         WalletTrade[]
   clusterMembers WalletClusterMember[]
-  // ObservedEvent usa `wallet` como address (String), n├úo FK ÔÇö sem relation aqui.
+  // ObservedEvent usa `wallet` como address (String), n?o FK ? sem relation aqui.
 }
 
 model WalletMetric {
@@ -140,25 +140,25 @@ model ObservedEvent {
   payload          Json?
   receivedAt       DateTime  @default(now())
 
-  // Enrichment F1.5 (decoder pump.fun/PumpSwap) ÔÇö tudo nullable:
+  // Enrichment F1.5 (decoder pump.fun/PumpSwap) ? tudo nullable:
   // eventos antigos e nao decodificaveis ficam null/UNKNOWN, nunca inferidos.
   direction      String? // 'buy' | 'sell'
   amountSol      Decimal?
   tokenAmount    Decimal?
   mint           String?
-  counterparty   String? // bonding curve (µ│Á curve) ou pool PumpSwap
+  counterparty   String? // bonding curve (? curve) ou pool PumpSwap
   enrichSource   String? // ex.: 'pump-decoder-v1'
   enrichedAt     DateTime?
   enrichAttempts Int      @default(0)
 
-  // Chave de dedup (idempot´┐¢ncia - AGENTS.md regra 6)
+  // Chave de dedup (idempotencia - AGENTS.md regra 6)
   @@unique([signature, instructionIndex, wallet])
   @@index([mint])
   @@index([eventType])
 }
 
 // ---------------------------------------------------------------------------
-// Signals (Fases 4ÔÇô7)
+// Signals (Fases 4?7)
 // ---------------------------------------------------------------------------
 
 model Signal {
@@ -189,7 +189,7 @@ model SignalFeature {
 }
 
 // ---------------------------------------------------------------------------
-// Execution (Fases 9ÔÇô10) ÔÇö nunca habilitar LIVE sem aprova├º├úo humana
+// Execution (Fases 9?10) ? nunca habilitar LIVE sem aprova??o humana
 // ---------------------------------------------------------------------------
 
 model Order {
@@ -246,7 +246,7 @@ model ExecutionMetric {
 }
 
 // ---------------------------------------------------------------------------
-// Backtest / ML (Fases 5ÔÇô7)
+// Backtest / ML (Fases 5?7)
 // ---------------------------------------------------------------------------
 
 model BacktestRun {
diff --git a/packages/database/src/repositories/observed-events.ts 
b/packages/database/src/repositories/observed-events.ts
index c785cf4..878cbdd 100644
--- a/packages/database/src/repositories/observed-events.ts
+++ b/packages/database/src/repositories/observed-events.ts
@@ -109,25 +109,48 @@ export interface ObservedEventEnrichDelegate {
   updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
 }
 
-/** Marca um evento como enriquecido com os campos decodificados. */
+/**
+ * Marca um evento como enriquecido com os campos decodificados.
+ * TOCTOU-safe (review 88152bbf): guarda `enrichedAt: null` no WHERE ÔÇö
+ * se outro worker enriqueceu antes, o update n├úo afeta linha alguma e
+ * reportamos que n├úo foi gravado (falso positivo de escrita eliminado).
+ */
 export async function markEnriched(
   client: { observedEvent: ObservedEventEnrichDelegate },
   data: EnrichmentData,
 ): Promise<void> {
+  // Fallback deterministico quando o delegate nao tem updateMany com guarda.
+  const supportsGuardedWrite = typeof client.observedEvent.updateMany === 'function';
+  const payload = {
+    direction: data.direction,
+    amountSol: data.amountSol,
+    tokenAmount: data.tokenAmount,
+    mint: data.mint,
+    counterparty: data.counterparty,
+    enrichSource: data.enrichSource,
+    enrichedAt: new Date(),
+  };
   try {
+    if (supportsGuardedWrite && client.observedEvent.updateMany) {
+      const res = (await client.observedEvent.updateMany({
+        where: { id: data.id, enrichedAt: null },
+        data: payload,
+      })) as { count?: number } | undefined;
+      if (res && typeof res.count === 'number' && res.count === 0) {
+        throw new RepositoryError(
+          'DATABASE_ERROR',
+          `markEnriched ignorado: ObservedEvent ${data.id} ja estava enriquecido (TOCTOU)`,
+          new Error('guarda enrichedAt IS NULL falhou'),
+        );
+      }
+      return;
+    }
     await client.observedEvent.update({
       where: { id: data.id },
-      data: {
-        direction: data.direction,
-        amountSol: data.amountSol,
-        tokenAmount: data.tokenAmount,
-        mint: data.mint,
-        counterparty: data.counterparty,
-        enrichSource: data.enrichSource,
-        enrichedAt: new Date(),
-      },
+      data: payload,
     });
   } catch (err) {
+    if (err instanceof RepositoryError) throw err;
     throw new RepositoryError('DATABASE_ERROR', `Falha ao enriquecer ObservedEvent ${data.id}`, err);
   }
 }
@@ -139,9 +162,21 @@ export async function markUndecodable(
   reason: string,
 ): Promise<void> {
   try {
+    const guarded = typeof client.observedEvent.updateMany === 'function';
+    const payload = {
+      enrichSource: `undecodable:${reason}`.slice(0, 128),
+      enrichedAt: new Date(),
+    };
+    if (guarded && client.observedEvent.updateMany) {
+      await client.observedEvent.updateMany({
+        where: { id, enrichedAt: null },
+        data: payload,
+      });
+      return;
+    }
     await client.observedEvent.update({
       where: { id },
-      data: { enrichSource: `undecodable:${reason}`.slice(0, 128), enrichedAt: new Date() },
+      data: payload,
     });
   } catch (err) {
     throw new RepositoryError('DATABASE_ERROR', `Falha ao marcar undecodable ${id}`, err);
[0m
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e -- 
packages/database/src/repositories/observed-events.enrich.test.ts
commit fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 00:12:32 2026 -0300

    fix(review): testes para markEnriched/markUndecodable/findUnenriched/incrementEnrichAttempt + guarda TOCTOU 
(updateMany where enrichedAt null) + schema.prisma ASCII puro

diff --git a/packages/database/src/repositories/observed-events.enrich.test.ts 
b/packages/database/src/repositories/observed-events.enrich.test.ts
new file mode 100644
index 0000000..6fa4180
--- /dev/null
+++ b/packages/database/src/repositories/observed-events.enrich.test.ts
@@ -0,0 +1,194 @@
+/**
+ * Testes dos metodos de enrichment do ObservedEvent (review 88152bbf/5299d25):
+ * markEnriched, markUndecodable, findUnenriched, incrementEnrichAttempt.
+ * Fakes em memoria; nunca importa o singleton prisma.
+ */
+import { describe, it, expect } from 'vitest';
+import {
+  markEnriched,
+  markUndecodable,
+  findUnenriched,
+  incrementEnrichAttempt,
+  type UnenrichedRow,
+} from './observed-events.js';
+import { RepositoryError } from './errors.js';
+
+interface Row {
+  id: string;
+  signature: string;
+  instructionIndex: number;
+  wallet: string;
+  enrichedAt: Date | null;
+  enrichAttempts: number;
+  receivedAt: Date;
+  direction?: string | null;
+  mint?: string | null;
+}
+
+/** Delegate fake com update guardado (TOCTOU), updateMany, findMany ordenado. */
+function fakeDelegate(initial: Row[]) {
+  const rows = [...initial];
+  return {
+    rows,
+    async update(args: { where: { id: string }; data: Record<string, unknown> }) {
+      const r = rows.find((x) => x.id === args.where.id);
+      if (!r) throw new Error('not found');
+      Object.assign(r, args.data);
+      return r;
+    },
+    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
+      const { id, enrichedAt } = args.where as { id?: string; enrichedAt?: Date | null };
+      let count = 0;
+      for (const r of rows) {
+        if (id !== undefined && r.id !== id) continue;
+        if ('enrichedAt' in args.where) {
+          if (enrichedAt === null) {
+            if (r.enrichedAt !== null) continue;
+          }
+        }
+        Object.assign(r, args.data);
+        count++;
+      }
+      return { count };
+    },
+    async findMany(args: {
+      where: Record<string, unknown>;
+      orderBy: Record<string, unknown>;
+      take: number;
+      select: Record<string, boolean>;
+    }): Promise<UnenrichedRow[]> {
+      const out = rows
+        .filter((r) => {
+          const w = args.where as { enrichedAt?: null; enrichAttempts?: { lt?: number } };
+          if (w.enrichedAt === null && r.enrichedAt !== null) return false;
+          if (w.enrichAttempts && r.enrichAttempts >= (w.enrichAttempts.lt ?? Infinity))
+            return false;
+          return true;
+        })
+        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
+        .slice(0, args.take)
+        .map((r) => ({
+          id: r.id,
+          signature: r.signature,
+          instructionIndex: r.instructionIndex,
+          wallet: r.wallet,
+        }));
+      return out;
+    },
+    async updateManyInc(args: { where: { id: string }; data: Record<string, unknown> }) {
+      const r = rows.find((x) => x.id === args.where.id);
+      if (!r) return { count: 0 };
+      const inc = (args.data['enrichAttempts'] as { increment: number }).increment;
+      r.enrichAttempts += inc;
+      return { count: 1 };
+    },
+  };
+}
+
+const row = (id: string, over: Partial<Row> = {}): Row => ({
+  id,
+  signature: id,
+  instructionIndex: 0,
+  wallet: 'W',
+  enrichedAt: null,
+  enrichAttempts: 0,
+  receivedAt: new Date('2026-01-01T00:00:00Z'),
+  ...over,
+});
+
+describe('markEnriched', () => {
+  it('persiste todos os campos + enrichedAt', async () => {
+    const d = fakeDelegate([row('a')]);
+    await markEnriched({ observedEvent: d }, {
+      id: 'a',
+      direction: 'buy',
+      amountSol: '0.5',
+      tokenAmount: '1000',
+      mint: 'M'.repeat(44),
+      counterparty: 'C'.repeat(44),
+      enrichSource: 'pump-decoder-v1:pump_buy',
+    });
+    expect(d.rows[0]!.direction).toBe('buy');
+    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
+  });
+
+  it('TOCTOU: escrita guardada nao sobrescreve evento ja enriquecido', async () => {
+    const d = fakeDelegate([row('a', { enrichedAt: new Date() })]);
+    await expect(
+      markEnriched({ observedEvent: d }, {
+        id: 'a',
+        direction: 'sell',
+        amountSol: '1',
+        tokenAmount: '1',
+        mint: 'M'.repeat(44),
+        counterparty: 'C'.repeat(44),
+        enrichSource: 'pump-decoder-v1:pump_sell',
+      }),
+    ).rejects.toThrowError(RepositoryError);
+  });
+
+  it('delegate sem updateMany cai no update simples (compat)', async () => {
+    const d = fakeDelegate([row('a')]);
+    const noUM = { ...d } as Omit<typeof d, 'updateMany'>;
+    delete (noUM as Record<string, unknown>).updateMany;
+    await markEnriched({ observedEvent: noUM }, {
+      id: 'a',
+      direction: 'buy',
+      amountSol: null,
+      tokenAmount: '10',
+      mint: 'M'.repeat(44),
+      counterparty: 'C'.repeat(44),
+      enrichSource: 'pump-decoder-v1:pump_buy',
+    });
+    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
+  });
+});
+
+describe('markUndecodable', () => {
+  it('marca com reason truncada a 128 chars', async () => {
+    const d = fakeDelegate([row('a')]);
+    const long = 'x'.repeat(500);
+    await markUndecodable({ observedEvent: d }, 'a', long);
+    const src = (d.rows[0] as unknown as Record<string, unknown>)['enrichSource'] as string;
+    expect(src.startsWith('undecodable:')).toBe(true);
+    expect(src.length).toBeLessThanOrEqual(128);
+    expect(d.rows[0]!.enrichedAt).toBeInstanceOf(Date);
+  });
+});
+
+describe('findUnenriched', () => {
+  it('filtra enrichedAt null e enrichAttempts < max, ordena por receivedAt asc, respeita take', async () => {
+    const d = fakeDelegate([
+      row('old', { receivedAt: new Date('2026-01-01') }),
+      row('new', { receivedAt: new Date('2026-02-01') }),
+      row('enriched', { enrichedAt: new Date() }),
+      row('maxed', { enrichAttempts: 5 }),
+    ]);
+    const out = await findUnenriched({ observedEvent: d }, { limit: 10, maxAttempts: 5 });
+    expect(out.map((r) => r.id)).toEqual(['old', 'new']);
+    const one = await findUnenriched({ observedEvent: d }, { limit: 1, maxAttempts: 5 });
+    expect(one.map((r) => r.id)).toEqual(['old']);
+  });
+});
+
+describe('incrementEnrichAttempt', () => {
+  it('incrementa via updateMany', async () => {
+    const d = fakeDelegate([row('a')]);
+    // usa o updateMany de incremento do prisma (fake aproxima shape do Prisma)
+    const shaped = {
+      ...d,
+      updateMany: d.updateManyInc.bind(d),
+    };
+    await incrementEnrichAttempt({ observedEvent: shaped }, 'a');
+    expect(d.rows[0]!.enrichAttempts).toBe(1);
+  });
+
+  it('delegate sem updateMany lanca RepositoryError', async () => {
+    const d = fakeDelegate([row('a')]);
+    const noUM = { ...d } as Omit<typeof d, 'updateMany'>;
+    delete (noUM as Record<string, unknown>).updateMany;
+    await expect(incrementEnrichAttempt({ observedEvent: noUM }, 'a')).rejects.toBeInstanceOf(
+      RepositoryError,
+    );
+  });
+});
[0m
[0mÔåÆ [0mRead packages/database/src/repositories/observed-events.ts
[0mÔåÆ [0mRead packages/database/src/repositories/errors.ts
Now let me read the full source files to understand the complete context.
[0m
[0m$ [0mgit status; git branch --show-current
On branch master
Your branch is up to date with 'origin/master'.

nothing to commit, working tree clean
master
[0m
The working tree file differs from what the commit modified ÔÇö let me check the branch state and the file at that commit.
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/repositories/observed-events.ts | 
Measure-Object -Line -Word -Character
Lines Words Characters Property
----- ----- ---------- --------
  206   789       6905
[0m
The working tree is on `master`; I need to read the file at the commit under review.
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/repositories/observed-events.ts
/**
 * Repository de ObservedEvent ÔÇö dedup de eventos on-chain (AGENTS.md regra 6).
 * Chave de idempot├¬ncia: signature + instructionIndex + wallet
 * (@@unique no schema ÔåÆ constraint ObservedEvent_signature_instructionIndex_wallet_key).
 *
 * O client ├® injetado (nunca importa o singleton) para permitir fakes em testes.
 */
import { isUniqueViolation, RepositoryError } from './errors.js';

export interface ObservedEventInsertData {
  signature: string;
  instructionIndex: number;
  wallet: string;
  eventType: string;
  slot?: bigint | null;
  blockTime?: Date | null;
  payload?: unknown;
}

export interface ObservedEventDelegate {
  create(args: { data: ObservedEventInsertData }): Promise<unknown>;
  findUnique(args: {
    where: {
      signature_instructionIndex_wallet: {
        signature: string;
        instructionIndex: number;
        wallet: string;
      };
    };
    select?: { id: true };
  }): Promise<{ id: string } | null>;
}

export type InsertResult = 'inserted' | 'duplicate';

/**
 * Insere um evento observado. Idempotente:
 * - unique violation (P2002) na chave de dedup ÔåÆ 'duplicate' (n├úo ├® erro);
 * - qualquer outro erro ÔåÆ RepositoryError(DATABASE_ERROR).
 */
export async function insertObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  data: ObservedEventInsertData,
): Promise<InsertResult> {
  try {
    await client.observedEvent.create({ data });
    return 'inserted';
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'duplicate';
    }
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao inserir ObservedEvent (${data.signature}:${data.instructionIndex}:${data.wallet})`,
      err,
    );
  }
}

/** Verifica exist├¬ncia pela chave de dedup, sem lan├ºar. */
export async function existsObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  key: { signature: string; instructionIndex: number; wallet: string },
): Promise<boolean> {
  try {
    const found = await client.observedEvent.findUnique({
      where: { signature_instructionIndex_wallet: key },
      select: { id: true },
    });
    return found !== null;
  } catch (err) {
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao consultar ObservedEvent (${key.signature}:${key.instructionIndex}:${key.wallet})`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// F1.5 ÔÇö Enrichment (decoder pump.fun/PumpSwap)
// ---------------------------------------------------------------------------

export interface EnrichmentData {
  id: string;
  direction: 'buy' | 'sell';
  amountSol: string | number | null;
  tokenAmount: string | number | null;
  mint: string;
  counterparty: string;
  enrichSource: string;
}

export interface UnenrichedRow {
  id: string;
  signature: string;
  instructionIndex: number;
  wallet: string;
}

export interface ObservedEventEnrichDelegate {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, unknown>;
    take: number;
    select: Record<string, boolean>;
  }): Promise<UnenrichedRow[]>;
  updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Marca um evento como enriquecido com os campos decodificados.
 * TOCTOU-safe (review 88152bbf): guarda `enrichedAt: null` no WHERE ÔÇö
 * se outro worker enriqueceu antes, o update n├úo afeta linha alguma e
 * reportamos que n├úo foi gravado (falso positivo de escrita eliminado).
 */
export async function markEnriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  data: EnrichmentData,
): Promise<void> {
  // Fallback deterministico quando o delegate nao tem updateMany com guarda.
  const supportsGuardedWrite = typeof client.observedEvent.updateMany === 'function';
  const payload = {
    direction: data.direction,
    amountSol: data.amountSol,
    tokenAmount: data.tokenAmount,
    mint: data.mint,
    counterparty: data.counterparty,
    enrichSource: data.enrichSource,
    enrichedAt: new Date(),
  };
  try {
    if (supportsGuardedWrite && client.observedEvent.updateMany) {
      const res = (await client.observedEvent.updateMany({
        where: { id: data.id, enrichedAt: null },
        data: payload,
      })) as { count?: number } | undefined;
      if (res && typeof res.count === 'number' && res.count === 0) {
        throw new RepositoryError(
          'DATABASE_ERROR',
          `markEnriched ignorado: ObservedEvent ${data.id} ja estava enriquecido (TOCTOU)`,
          new Error('guarda enrichedAt IS NULL falhou'),
        );
      }
      return;
    }
    await client.observedEvent.update({
      where: { id: data.id },
      data: payload,
    });
  } catch (err) {
    if (err instanceof RepositoryError) throw err;
    throw new RepositoryError('DATABASE_ERROR', `Falha ao enriquecer ObservedEvent ${data.id}`, err);
  }
}

/** Marca o evento como processado sem decodificar (UNKNOWN expl├¡cito). */
export async function markUndecodable(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
  reason: string,
): Promise<void> {
  try {
    const guarded = typeof client.observedEvent.updateMany === 'function';
    const payload = {
      enrichSource: `undecodable:${reason}`.slice(0, 128),
      enrichedAt: new Date(),
    };
    if (guarded && client.observedEvent.updateMany) {
      await client.observedEvent.updateMany({
        where: { id, enrichedAt: null },
        data: payload,
      });
      return;
    }
    await client.observedEvent.update({
      where: { id },
      data: payload,
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao marcar undecodable ${id}`, err);
  }
}

/** Busca lote de eventos ainda n├úo enriquecidos para processar (backfill/enricher). */
export async function findUnenriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  opts: { limit: number; maxAttempts: number },
): Promise<UnenrichedRow[]> {
  try {
    return await client.observedEvent.findMany({
      where: { enrichedAt: null, enrichAttempts: { lt: opts.maxAttempts } },
      orderBy: { receivedAt: 'asc' },
      take: opts.limit,
      select: { id: true, signature: true, instructionIndex: true, wallet: true },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', 'Falha ao buscar eventos n├úo enriquecidos', err);
  }
}

/** Incrementa o contador de tentativas de enrichment (evita retry infinito). */
export async function incrementEnrichAttempt(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
): Promise<void> {
  if (!client.observedEvent.updateMany) {
    throw new RepositoryError('DATABASE_ERROR', 'delegate sem updateMany', new Error('unsupported'));
  }
  try {
    await client.observedEvent.updateMany({
      where: { id },
      data: { enrichAttempts: { increment: 1 } },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao incrementar enrichAttempts ${id}`, err);
  }
}
[0m
Now let me examine the callers of these functions and the parent version to understand behavior changes. The working tree is on `master`, so I'll explore via git.
[0m$ [0mgit grep -n "markEnriched\|markUndecodable\|findUnenriched\|incrementEnrichAttempt" 
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e -- "*.ts" | Select-String -NotMatch "observed-events"
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/index.ts:29:  markEnriched,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/index.ts:30:  markUndecodable,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/index.ts:31:  findUnenriched,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/src/index.ts:32:  incrementEnrichAttempt,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enrich-runner.ts:9:  findUnenriched(limit: 
number, maxAttempts: number): Promise<
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enrich-runner.ts:38:      const batch = await 
this.store.findUnenriched(this.opts.batchSize, this.opts.maxAttempts);
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.test.ts:72:    async markEnriched(id) {
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.test.ts:75:    async markUndecodable(id) 
{
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts:7: * - Sem eventType real 
decodificado ÔåÆ UNKNOWN expl├¡cito (markUndecodable).
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts:44:  markEnriched(id: string, d: 
DecodedSwap): Promise<void>;
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts:45:  markUndecodable(id: string, 
reason: string): Promise<void>;
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts:146:        await 
this.store.markUndecodable(id, 'no-decodable-instruction');
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts:149:      await 
this.store.markEnriched(id, decoded);
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:19:  markEnriched as repoMarkEnriched,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:20:  markUndecodable as 
repoMarkUndecodable,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:21:  findUnenriched as 
repoFindUnenriched,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:22:  incrementEnrichAttempt as 
repoIncrementAttempt,
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:101:      async markEnriched(id, d: 
DecodedSwap) {
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:113:      async markUndecodable(id, 
reason) {
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts:122:      findUnenriched: (limit, 
maxAttempts) =>
[0m
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e^:packages/database/src/repositories/observed-events.ts
/**
 * Repository de ObservedEvent ÔÇö dedup de eventos on-chain (AGENTS.md regra 6).
 * Chave de idempot├¬ncia: signature + instructionIndex + wallet
 * (@@unique no schema ÔåÆ constraint ObservedEvent_signature_instructionIndex_wallet_key).
 *
 * O client ├® injetado (nunca importa o singleton) para permitir fakes em testes.
 */
import { isUniqueViolation, RepositoryError } from './errors.js';

export interface ObservedEventInsertData {
  signature: string;
  instructionIndex: number;
  wallet: string;
  eventType: string;
  slot?: bigint | null;
  blockTime?: Date | null;
  payload?: unknown;
}

export interface ObservedEventDelegate {
  create(args: { data: ObservedEventInsertData }): Promise<unknown>;
  findUnique(args: {
    where: {
      signature_instructionIndex_wallet: {
        signature: string;
        instructionIndex: number;
        wallet: string;
      };
    };
    select?: { id: true };
  }): Promise<{ id: string } | null>;
}

export type InsertResult = 'inserted' | 'duplicate';

/**
 * Insere um evento observado. Idempotente:
 * - unique violation (P2002) na chave de dedup ÔåÆ 'duplicate' (n├úo ├® erro);
 * - qualquer outro erro ÔåÆ RepositoryError(DATABASE_ERROR).
 */
export async function insertObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  data: ObservedEventInsertData,
): Promise<InsertResult> {
  try {
    await client.observedEvent.create({ data });
    return 'inserted';
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'duplicate';
    }
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao inserir ObservedEvent (${data.signature}:${data.instructionIndex}:${data.wallet})`,
      err,
    );
  }
}

/** Verifica exist├¬ncia pela chave de dedup, sem lan├ºar. */
export async function existsObservedEvent(
  client: { observedEvent: ObservedEventDelegate },
  key: { signature: string; instructionIndex: number; wallet: string },
): Promise<boolean> {
  try {
    const found = await client.observedEvent.findUnique({
      where: { signature_instructionIndex_wallet: key },
      select: { id: true },
    });
    return found !== null;
  } catch (err) {
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao consultar ObservedEvent (${key.signature}:${key.instructionIndex}:${key.wallet})`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// F1.5 ÔÇö Enrichment (decoder pump.fun/PumpSwap)
// ---------------------------------------------------------------------------

export interface EnrichmentData {
  id: string;
  direction: 'buy' | 'sell';
  amountSol: string | number | null;
  tokenAmount: string | number | null;
  mint: string;
  counterparty: string;
  enrichSource: string;
}

export interface UnenrichedRow {
  id: string;
  signature: string;
  instructionIndex: number;
  wallet: string;
}

export interface ObservedEventEnrichDelegate {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, unknown>;
    take: number;
    select: Record<string, boolean>;
  }): Promise<UnenrichedRow[]>;
  updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
}

/** Marca um evento como enriquecido com os campos decodificados. */
export async function markEnriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  data: EnrichmentData,
): Promise<void> {
  try {
    await client.observedEvent.update({
      where: { id: data.id },
      data: {
        direction: data.direction,
        amountSol: data.amountSol,
        tokenAmount: data.tokenAmount,
        mint: data.mint,
        counterparty: data.counterparty,
        enrichSource: data.enrichSource,
        enrichedAt: new Date(),
      },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao enriquecer ObservedEvent ${data.id}`, err);
  }
}

/** Marca o evento como processado sem decodificar (UNKNOWN expl├¡cito). */
export async function markUndecodable(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
  reason: string,
): Promise<void> {
  try {
    await client.observedEvent.update({
      where: { id },
      data: { enrichSource: `undecodable:${reason}`.slice(0, 128), enrichedAt: new Date() },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao marcar undecodable ${id}`, err);
  }
}

/** Busca lote de eventos ainda n├úo enriquecidos para processar (backfill/enricher). */
export async function findUnenriched(
  client: { observedEvent: ObservedEventEnrichDelegate },
  opts: { limit: number; maxAttempts: number },
): Promise<UnenrichedRow[]> {
  try {
    return await client.observedEvent.findMany({
      where: { enrichedAt: null, enrichAttempts: { lt: opts.maxAttempts } },
      orderBy: { receivedAt: 'asc' },
      take: opts.limit,
      select: { id: true, signature: true, instructionIndex: true, wallet: true },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', 'Falha ao buscar eventos n├úo enriquecidos', err);
  }
}

/** Incrementa o contador de tentativas de enrichment (evita retry infinito). */
export async function incrementEnrichAttempt(
  client: { observedEvent: ObservedEventEnrichDelegate },
  id: string,
): Promise<void> {
  if (!client.observedEvent.updateMany) {
    throw new RepositoryError('DATABASE_ERROR', 'delegate sem updateMany', new Error('unsupported'));
  }
  try {
    await client.observedEvent.updateMany({
      where: { id },
      data: { enrichAttempts: { increment: 1 } },
    });
  } catch (err) {
    throw new RepositoryError('DATABASE_ERROR', `Falha ao incrementar enrichAttempts ${id}`, err);
  }
}
[0m
Now let me examine the enricher runner and the ingestion index that wires the delegate, to understand error handling around the new TOCTOU exception.
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enrich-runner.ts
/**
 * enrich-runner.ts ÔÇö loop/worker de enrichment F1.5 (usado pelo servi├ºo e
 * pelo script one-shot de backfill). Batch de eventos n├úo enriquecidos,
 * rate-limit configur├ível, sem Throw no loop.
 */
import type { Enricher } from './enricher.js';

export interface UnenrichedStore {
  findUnenriched(limit: number, maxAttempts: number): Promise<
    Array<{ id: string; signature: string }>
  >;
}

export interface RunnerStats {
  seen: number;
  enriched: number;
  undecodable: number;
  retried: number;
}

export class EnrichRunner {
  readonly stats: RunnerStats = { seen: 0, enriched: 0, undecodable: 0, retried: 0 };
  private stopFlag = false;

  constructor(
    private readonly store: UnenrichedStore,
    private readonly enricher: Enricher,
    private readonly opts: { batchSize: number; maxAttempts: number; sleepMs: number },
  ) {}

  stop(): void {
    this.stopFlag = true;
  }

  /** Uma passada completa at├® esgotar a fila ou stopFlag. */
  async runUntilEmpty(maxBatches: number = Number.MAX_SAFE_INTEGER): Promise<RunnerStats> {
    for (let b = 0; b < maxBatches && !this.stopFlag; b++) {
      const batch = await this.store.findUnenriched(this.opts.batchSize, this.opts.maxAttempts);
      if (batch.length === 0) break;
      for (const row of batch) {
        if (this.stopFlag) break;
        const r = await this.enricher.enrich(row.id, row.signature);
        this.stats.seen++;
        if (r === 'enriched') this.stats.enriched++;
        else if (r === 'undecodable') this.stats.undecodable++;
        else this.stats.retried++;
        if (this.opts.sleepMs > 0) await new Promise((r2) => setTimeout(r2, this.opts.sleepMs));
      }
    }
    return this.stats;
  }
}
[0m
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/index.ts
/**
 * data-ingestion ÔÇö boot do servi├ºo (Fase 1).
 * Graceful shutdown em SIGINT/SIGTERM: para de aceitar eventos, drena,
 * fecha provider e desconecta Prisma.
 */
import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';
import { prisma } from '@ct/database';
import { normalizeRawNotification } from './normalizer.js';
import { DedupStore } from './dedup-store.js';
import { IngestionPipeline } from './pipeline.js';
import { createDataProvider } from './factory.js';
import { InstanceLock } from './instance-lock.js';
import { RetentionJob } from './retention.js';
import { Enricher, type DecodedSwap } from './enricher.js';
import { EnrichRunner } from './enrich-runner.js';
import { RpcProvider } from '@ct/solana';
import {
  markEnriched as repoMarkEnriched,
  markUndecodable as repoMarkUndecodable,
  findUnenriched as repoFindUnenriched,
  incrementEnrichAttempt as repoIncrementAttempt,
} from '@ct/database';
// Nota: prisma.observedEvent (delegate tipado do Prisma) e a interface m├¡nima
// ObservedEventEnrichDelegate divergem por exactOptionalPropertyTypes; o cast
// no ponto de glue (abaixo) ├® consciente ÔÇö os repos validam os payloads.
import type { ObservedEventEnrichDelegate } from '@ct/database';
import type { DecodedSwap as DecodedSwapType } from '@ct/pumpfun';

const SERVICE_NAME = 'data-ingestion';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting', { tradingMode: config.tradingMode });

  // Single-instance (ADR-024): aborta se j├í houver inst├óncia viva rodando.
  const lock = new InstanceLock(
    process.env['INGESTION_LOCK_PATH'] ?? './data/locks/data-ingestion.lock',
  );
  lock.acquire();

  const store = new DedupStore(prisma.observedEvent);
  const pipeline = new IngestionPipeline(store, logger);
  pipeline.start();

  // Reten├º├úo RAW (ADR-024): al├¡vio de disco; agrega├º├úo vem em fases futuras.
  const retention = new RetentionJob(prisma.observedEvent, logger);
  retention.start();

  const provider = createDataProvider(config, { logger });
  /*
   * logsNotification n├úo carrega wallet/instruction_index ÔÇö o enriquecimento
   * (qual wallet do filtro "mentions" disparou, BUY/SELL, mint) ├® Fase 1.5
   * via getTransaction. Por isso consumimos onRawEvent e normalizamos apenas
   * signature+slot; demais campos ficam null/UNKNOWN (nunca estimar).
   */
  if (!('onRawEvent' in provider) || typeof provider.onRawEvent !== 'function') {
    throw new Error('CONFIG_ERROR: provider n├úo exp├Áe onRawEvent (interface esperada)');
  }
  const rawProvider = provider as unknown as {
    onRawEvent: (cb: (n: { signature: string; slot: number; value: unknown }) => void) => void;
  };
  rawProvider.onRawEvent((raw) => {
    const result = normalizeRawNotification(
      { signature: raw.signature, slot: raw.slot },
      'websocket',
      Date.now(),
    );
    if (!result.ok) {
      store.counters.errors++;
      logger.warn('notifica├º├úo crua inv├ílida ÔÇö VALIDATION_ERROR', {
        errorClass: 'VALIDATION_ERROR',
        error: result.error.message,
      });
      return;
    }
    pipeline.ingest(result.event).catch((e: unknown) => {
      // NUNCA deixar erro escapar do loop do event loop.
      logger.error('erro inesperado no loop de ingest├úo ÔÇö UNKNOWN_ERROR', {
        errorClass: 'UNKNOWN_ERROR',
        error: e instanceof Error ? e.message : String(e),
      });
    });
  });
  await provider.connect();

  // ---- F1.5: enricher (decode BUY/SELL real) -------------------------------
  // Ligado por padr├úo em todos os modos (s├│ leitura on-chain + escrita local;
  // nenhuma transa├º├úo ├® enviada). Retries limitados por enrichAttempts.
  const rpc = new RpcProvider(
    [{ name: 'primary', url: config.SOLANA_RPC_HTTP, tier: 'primary' }],
    { logger },
  );
  const enricher = new Enricher(
    { getTransaction: (sig) => rpc.getTransaction(sig) },
    {
      async bumpAttempt(id) {
        await repoIncrementAttempt({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, 
id);
      },
      async markEnriched(id, d: DecodedSwap) {
        const dec: DecodedSwapType = d;
        await repoMarkEnriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, {
          id,
          direction: dec.direction,
          amountSol: dec.solAmount,
          tokenAmount: dec.tokenAmount,
          mint: dec.mint,
          counterparty: dec.counterparty,
          enrichSource: `pump-decoder-v1:${dec.kind}`,
        });
      },
      async markUndecodable(id, reason) {
        await repoMarkUndecodable({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, 
id, reason);
      },
    },
    logger,
  );
  let enrichTimer: NodeJS.Timeout | null = null;
  const runner = new EnrichRunner(
    {
      findUnenriched: (limit, maxAttempts) =>
        repoFindUnenriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, { limit, 
maxAttempts }),
    },
    enricher,
    {
      batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25),
      maxAttempts: Number(process.env['ENRICH_MAX_ATTEMPTS'] ?? 5),
      sleepMs: Number(process.env['ENRICH_SLEEP_MS'] ?? 120), // ~8 req/s no RPC
    },
  );
  const enrichEnabled = (process.env['ENRICH_ENABLED'] ?? 'true') === 'true';
  if (enrichEnabled) {
    enrichTimer = setInterval(() => void runner.runUntilEmpty(1), 2_000);
    enrichTimer.unref?.();
    logger.info('enricher ativo', { batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25) });
  } else {
    logger.warn('enricher DESLIGADO (ENRICH_ENABLED=false)');
  }
  // ---------------------------------------------------------------------------

  // Subscri├º├úo expl├¡cita: sem endere├ºos configurados o pipeline sobe mas n├úo observa nada.
  const watch = (config.INGESTION_WATCH_ADDRESSES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (watch.length === 0) {
    logger.warn('INGESTION_WATCH_ADDRESSES vazio ÔÇö nenhuma subscri├º├úo ativa', {
      errorClass: 'CONFIG_ERROR',
    });
  } else {
    await provider.subscribeWallets(watch);
    logger.info('subscri├º├Áes ativas', { watchCount: watch.length });
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutdown iniciado', { signal });
    runner.stop();
    if (enrichTimer !== null) clearInterval(enrichTimer);
    retention.stop();
    await pipeline.stop(); // drain: para de aceitar novos, stats finais
    await provider.close();
    await prisma.$disconnect();
    lock.release();
    logger.info('shutdown completo', { signal });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  logger.info('pipeline ativo');
}
[0m
Now the enricher itself, which decides 'enriched' | 'undecodable' | 'retried' and calls bumpAttempt:
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:services/data-ingestion/src/enricher.ts
/**
 * enricher.ts ÔÇö F1.5: transforma ObservedEvent crus (UNKNOWN) em eventos com
 * dire├º├úo/valores via decode da transa├º├úo completa (getTransaction), usando o
 * decoder oficial pump.fun/PumpSwap de @ct/pumpfun (IDL oficial + codama).
 *
 * Regras inviol├íveis:
 * - Sem eventType real decodificado ÔåÆ UNKNOWN expl├¡cito (markUndecodable).
 * - Amounts vindos da INSTRU├ç├âO s├úo par├ómetros/limites, n├úo realizados ÔÇö
 *   documentado em decode.ts. O pipeline F1.5 persiste o que decode fornece
 *   e marca enrichSource='pump-decoder-v1' (rastre├ível; revog├ível).
 */
import { decodePumpInstruction, type DecodedSwap } from '@ct/pumpfun';

/** Shape m├¡nimo do getTransaction(jsonParsed) que usamos. */
export interface ParsedTx {
  meta?: {
    innerInstructions?: Array<{
      index: number;
      instructions: ParsedInstruction[];
    }> | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey?: string } | string> | null;
      instructions?: ParsedInstruction[] | null;
    } | null;
  } | null;
}

export interface ParsedInstruction {
  programId?: string;
  /** jsonParsed "partially decoded": accounts ├® indireto pela message. */
  accounts?: string[]; // j├í resolvidas para endere├ºos (eta)
  data?: string; // base58
  /** jsonParsed fully parsed */
  parsed?: unknown;
}

export interface TxFetcher {
  getTransaction(signature: string): Promise<unknown>;
}

export interface EnrichStore {
  markEnriched(id: string, d: DecodedSwap): Promise<void>;
  markUndecodable(id: string, reason: string): Promise<void>;
  bumpAttempt(id: string): Promise<void>;
}

/** Converte base58 ÔåÆ Uint8Array (alphabet Bitcoin/Solana, sem libs externas). */
export function base58ToBytes(s: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  const map = new Map(
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      .split('')
      .map((c, i) => [c, BigInt(i)] as const),
  );
  let num = 0n;
  for (const ch of s) {
    const v = map.get(ch);
    if (v === undefined) return null;
    num = num * 58n + v;
  }
  const bytes: number[] = [];
  let n = num;
  if (n === 0n) bytes.push(0);
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  // Preserva 0s ├á esquerda ('1')
  for (const ch of s) {
    if (ch === '1') bytes.unshift(0);
    else break;
  }
  return Uint8Array.from(bytes.reverse().reverse());
}

/**
 * Resolve o array de pubkeys da message para endere├ºos string, combinando
 * instru├º├Áes externas e internas com ├¡ndices de conta. Retorna lista de
 * { programId, accountKeys }, ou null se a tx estiver inutiliz├ível.
 */
export function collectInstructionCalls(
  tx: ParsedTx,
): Array<{ programId: string; data: Uint8Array; accounts: string[] }> {
  const keys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(keys)) return [];
  const keyAt = (i: number): string | null => {
    const k = keys[i];
    if (typeof k === 'string') return k;
    return k?.pubkey ?? null;
  };

  const calls: Array<{ programId: string; data: Uint8Array; accounts: string[] }> = [];
  const push = (ix: ParsedInstruction & { programIdIndex?: number; accountKeys?: number[] }) => {
    // jsonParsed: programId j├í string; "partially decoded" traz programIdIndex + data base58 + accounts (indices)
    const programId = ix.programId ?? (ix.programIdIndex != null ? keyAt(ix.programIdIndex) : null);
    if (!programId) return;
    const accounts = Array.isArray(ix.accounts)
      ? (ix.accounts as unknown[]).map((a) =>
          typeof a === 'string' ? a : typeof a === 'number' ? keyAt(a) : null,
        )
      : null;
    if (!accounts || accounts.some((a) => a === null)) return;
    const dataB58 = typeof ix.data === 'string' ? ix.data : null;
    if (!dataB58) return;
    const bytes = base58ToBytes(dataB58);
    if (!bytes) return;
    calls.push({ programId, data: bytes, accounts: accounts as string[] });
  };

  for (const ix of tx.transaction?.message?.instructions ?? []) push(ix);
  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner?.instructions ?? []) push(ix);
  }
  return calls;
}

export class Enricher {
  private running = 0;

  constructor(
    private readonly fetcher: TxFetcher,
    private readonly store: EnrichStore,
    private readonly logger: {
      info(m: string, f?: Record<string, unknown>): void;
      warn(m: string, f?: Record<string, unknown>): void;
      error(m: string, f?: Record<string, unknown>): void;
    },
    private readonly maxAttempts = 5,
  ) {}

  /** Enriquece um evento por signature. Idempotente por coluna (update por id). */
  async enrich(id: string, signature: string): Promise<'enriched' | 'undecodable' | 'retry'> {
    this.running++;
    try {
      await this.store.bumpAttempt(id);
      const rawTx = await this.fetcher.getTransaction(signature);
      const calls = collectInstructionCalls(rawTx as ParsedTx);
      let decoded: DecodedSwap | null = null;
      for (const c of calls) {
        decoded = decodePumpInstruction(c.programId, c.data, c.accounts);
        if (decoded) break;
      }
      if (!decoded) {
        await this.store.markUndecodable(id, 'no-decodable-instruction');
        return 'undecodable';
      }
      await this.store.markEnriched(id, decoded);
      return 'enriched';
    } catch (err) {
      // Erro transit├│rio de RPC: retry at├® maxAttempts (sem marca├º├úo definitiva).
      this.logger.warn('enrich falhou (retry se attempts < max)', {
        errorClass: 'RPC_ERROR',
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'retry';
    } finally {
      this.running--;
    }
  }
}

export { type DecodedSwap };
[0m
[0m$ [0mgit grep -n "markEnriched\|markUndecodable\|findUnenriched\|repoMarkEnriched\|repoFindUnenriched" 
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e -- "*.ts" | Select-String -Pattern "backfill|scripts|cli" ; git ls-tree -r 
--name-only fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e | Select-String -Pattern "backfill"
docs/research/f15/backfill-report.json
scripts/f15-backfill.mjs
[0m
Let me check the backfill script (potential concurrent writer), the enricher tests, and schema byte-content at the commit.
[0m$ [0m$content = git show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:packages/database/prisma/schema.prisma; 
$nonAscii = [regex]::Matches($content, '[^\x00-\x7F]'); "non-ascii count: $($nonAscii.Count)"; $nonAscii | 
ForEach-Object { $_.Value } | Sort-Object -Unique
non-ascii count: 0
[0m
Let me verify the parent schema bytes directly (whether the original non-ASCII was valid or already corrupted), and look at the backfill script.
[0m$ [0m$p = git show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e^:packages/database/prisma/schema.prisma; $bytes = 
[System.Text.Encoding]::UTF8.GetBytes($p); $s = [System.Text.Encoding]::UTF8.GetString($bytes); [regex]::Matches($s, 
'[^\x00-\x7F]') | ForEach-Object { "U+{0:X4} = {1}" -f [int][char]$_.Value, $_.Value } | Sort-Object -Unique
U+00A2 = ´┐¢
U+00AC = ´┐¢
U+00B4 = ´┐¢
U+00B5 = ´┐¢
U+00BA = ´┐¢
U+00C1 = ´┐¢
U+00C7 = ´┐¢
U+00D4 = ´┐¢
U+00F4 = ´┐¢
U+00F6 = ´┐¢
U+00FA = ´┐¢
U+2502 = ´┐¢
U+2510 = ´┐¢
U+251C = ´┐¢
[0m
[0m$ [0mgit show fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e:scripts/f15-backfill.mjs
// scripts/f15-backfill.mjs - GATE F1.5 (backfill one-shot):
// Processa um lote de eventos persistidos e reporta cobertura (decoded vs UNKNOWN).
// Uso: node --env-file=.env scripts/f15-backfill.mjs [batchSize] [maxBatches]
import { prisma } from '../packages/database/dist/index.js';
import { RpcProvider } from '../packages/solana/dist/index.js';
import { Enricher } from '../services/data-ingestion/dist/enricher.js';
import { EnrichRunner } from '../services/data-ingestion/dist/enrich-runner.js';
import {
  markEnriched,
  markUndecodable,
  findUnenriched,
  incrementEnrichAttempt,
} from '../packages/database/dist/index.js';

const log = { info: console.error, warn: console.error, error: console.error }; // stderr (stdout = relatorio)

const rpc = new RpcProvider(
  [{ name: 'primary', url: process.env.SOLANA_RPC_HTTP, tier: 'primary' }],
  { logger: log },
);

const enricher = new Enricher(
  { getTransaction: (sig) => rpc.getTransaction(sig) },
  {
    bumpAttempt: (id) => incrementEnrichAttempt({ observedEvent: prisma.observedEvent }, id),
    markEnriched: (id, d) =>
      markEnriched({ observedEvent: prisma.observedEvent }, {
        id,
        direction: d.direction,
        amountSol: d.solAmount,
        tokenAmount: d.tokenAmount,
        mint: d.mint,
        counterparty: d.counterparty,
        enrichSource: `pump-decoder-v1:${d.kind}`,
      }),
    markUndecodable: (id, reason) =>
      markUndecodable({ observedEvent: prisma.observedEvent }, id, reason),
  },
  log,
);

const batchSize = Number(process.argv[2] ?? 50);
const maxBatches = Number(process.argv[3] ?? 200); // default: ate 10k eventos
const runner = new EnrichRunner(
  {
    findUnenriched: (limit, maxAttempts) =>
      findUnenriched({ observedEvent: prisma.observedEvent }, { limit, maxAttempts }),
  },
  enricher,
  { batchSize, maxAttempts: 5, sleepMs: 120 },
);

const started = Date.now();
const stats = await runner.runUntilEmpty(maxBatches);
const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

const bySource = await prisma.observedEvent.groupBy({
  by: ['enrichSource'],
  _count: { _all: true },
});
const coverage = {
  ...stats,
  elapsedSec,
  coveragePct:
    stats.seen > 0 ? ((stats.enriched / stats.seen) * 100).toFixed(1) + '%' : 'n/a',
  enrichSourceBreakdown: bySource,
};
process.stdout.write(JSON.stringify(coverage, null, 2) + '\n');
await prisma.$disconnect();
[0m
The PowerShell string decode is unreliable for byte analysis. Let me extract the parent schema as raw bytes and analyze properly.
[0m$ [0m$blob = git rev-parse "fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e^:packages/database/prisma/schema.prisma"; 
git cat-file blob $blob > "$env:TEMP\opencode\parent-schema.bin"; $bytes = 
[System.IO.File]::ReadAllBytes("$env:TEMP\opencode\parent-schema.bin"); $nonAscii = 0; $bad = 0; for ($i=0; $i -lt 
$bytes.Length; $i++) { if ($bytes[$i] -gt 127) { $nonAscii++ } }; "total bytes: $($bytes.Length), non-ascii bytes: 
$nonAscii"
total bytes: 19908, non-ascii bytes: 34
[0m
[0m$ [0m$bytes = [System.IO.File]::ReadAllBytes("$env:TEMP\opencode\parent-schema.bin"); $len = $bytes.Length; $bad 
= 0; $str = ''; for ($i=0; $i -lt $len; $i++) { if ($bytes[$i] -gt 127) { if ($bytes[$i] -ge 0xC2 -and $bytes[$i] -le 
0xDF -and $i+1 -lt $len -and ($bytes[$i+1] -band 0xC0) -eq 0x80) { $cp = (($bytes[$i] -band 0x1F) -shl 6) -bor 
($bytes[$i+1] -band 0x3F); $str += [char]$cp; $i++ } elseif ($bytes[$i] -ge 0xE0 -and $bytes[$i] -le 0xEF -and $i+2 
-lt $len -and ($bytes[$i+1] -band 0xC0) -eq 0x80 -and ($bytes[$i+2] -band 0xC0) -eq 0x80) { $cp = (($bytes[$i] -band 
0x0F) -shl 12) -bor (($bytes[$i+1] -band 0x3F) -shl 6) -bor ($bytes[$i+2] -band 0x3F); $str += [char]$cp; $i += 2 } 
elseif ($bytes[$i] -ge 0xF0 -and $bytes[$i] -le 0xF7 -and $i+3 -lt $len) { $cp = (($bytes[$i] -band 0x07) -shl 18) 
-bor (($bytes[$i+1] -band 0x3F) -shl 12) -bor (($bytes[$i+2] -band 0x3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str 
+= [char]$cp; $i += 3 } else { $bad++; $str += "´┐¢" } } else { $str += [char]$bytes[$i] } }; "bad sequences: $bad"; 
"extracted chars:"; ($str -split "`n") | Select-String -Pattern "[^ -~]" | ForEach-Object { $_.Line }
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1574912" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1052224" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1574912" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1574912" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1052096" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1051712" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1574912" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
N´┐¢o ´┐¢ poss´┐¢vel converter o valor "1052096" para o tipo "System.Char". Erro: "Valor era muito grande ou muito 
pequeno 
para um caractere."
No linha:1 caractere:915
+ ... 3F) -shl 6) -bor ($bytes[$i+3] -band 0x3F); $str += [char]$cp; $i +=  ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [], RuntimeException
    + FullyQualifiedErrorId : InvalidCastIConvertible
 
bad sequences: 26
extracted chars:
??/ /   @ c t / d a t a b a s e   ? ? P r i s m a   s c h e m a   v 1   ( F a s e s   1 ? ? ) 
 
 / /   F o n t e   d e   v e r d a d e   p a r a   p e r s i s t %? n c i a .   N u n c a   a d i c i o n a r  
 s e c r e t s   a q u i   ( s o m e n t e   e n v   r e f s ) . 
 
 
 
 d a t a s o u r c e   d b   { 
 
     p r o v i d e r   =   " p o s t g r e s q l " 
 
     u r l             =   e n v ( " D A T A B A S E _ U R L " ) 
 
 } 
 
 
 
 g e n e r a t o r   c l i e n t   { 
 
     p r o v i d e r   =   " p r i s m a - c l i e n t - j s " 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   W a l l e t s   ( F a s e   2 ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   W a l l e t   { 
 
     i d                           S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     a d d r e s s                 S t r i n g       @ u n i q u e 
 
     l a b e l                     S t r i n g ? 
 
     c l a s s i f i c a t i o n   S t r i n g ? 
 
     c r e a t e d A t             D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
     u p d a t e d A t             D a t e T i m e   @ u p d a t e d A t 
 
 
 
     m e t r i c s                 W a l l e t M e t r i c [ ] 
 
     t r a d e s                   W a l l e t T r a d e [ ] 
 
     c l u s t e r M e m b e r s   W a l l e t C l u s t e r M e m b e r [ ] 
 
     / /   O b s e r v e d E v e n t   u s a   ` w a l l e t `   c o m o   a d d r e s s   ( S t r i n g ) ,  
 n %? o   F K   ? ? s e m   r e l a t i o n   a q u i . 
 
 } 
 
 
 
 m o d e l   W a l l e t M e t r i c   { 
 
     i d                               S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     w a l l e t I d                   S t r i n g 
 
     w a l l e t                       W a l l e t       @ r e l a t i o n ( f i e l d s :   [ w a l l e t I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     w i n d o w                       S t r i n g   / /   e x . :   " 7 d " ,   " 3 0 d " 
 
     t r a d e C o u n t               I n t             @ d e f a u l t ( 0 ) 
 
     w i n R a t e                     F l o a t ? 
 
     g r o s s P n l L a m p o r t s   B i g I n t       @ d e f a u l t ( 0 ) 
 
     n e t P n l L a m p o r t s       B i g I n t       @ d e f a u l t ( 0 ) 
 
     a v g H o l d S e c o n d s       I n t ? 
 
     c o m p u t e d A t               D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     @ @ i n d e x ( [ w a l l e t I d ,   w i n d o w ] ) 
 
 } 
 
 
 
 m o d e l   W a l l e t T r a d e   { 
 
     i d                                   S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     w a l l e t I d                       S t r i n g 
 
     w a l l e t                           W a l l e t       @ r e l a t i o n ( f i e l d s :  
 [ w a l l e t I d ] ,   r e f e r e n c e s :   [ i d ] ) 
 
     m i n t                               S t r i n g 
 
     s i d e                               S t r i n g   / /   " b u y "   |   " s e l l " 
 
     s i g n a t u r e                     S t r i n g 
 
     i n s t r u c t i o n I n d e x       I n t 
 
     a m o u n t I n L a m p o r t s       B i g I n t ? 
 
     a m o u n t O u t L a m p o r t s     B i g I n t ? 
 
     e x e c u t e d A t                   D a t e T i m e 
 
 
 
     @ @ u n i q u e ( [ s i g n a t u r e ,   i n s t r u c t i o n I n d e x ,   w a l l e t I d ] ) 
 
 } 
 
 
 
 m o d e l   W a l l e t C l u s t e r   { 
 
     i d                     S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     n a m e                 S t r i n g ? 
 
     m e t h o d             S t r i n g   / /   e x . :   " f u n d i n g _ s o u r c e " ,   " h e u r i s t i c " 
 
     c r e a t e d A t       D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     m e m b e r s           W a l l e t C l u s t e r M e m b e r [ ] 
 
 } 
 
 
 
 m o d e l   W a l l e t C l u s t e r M e m b e r   { 
 
     i d                 S t r i n g                 @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c l u s t e r I d   S t r i n g 
 
     c l u s t e r       W a l l e t C l u s t e r   @ r e l a t i o n ( f i e l d s :   [ c l u s t e r I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     w a l l e t I d     S t r i n g 
 
     w a l l e t         W a l l e t                 @ r e l a t i o n ( f i e l d s :   [ w a l l e t I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
 
 
     @ @ u n i q u e ( [ c l u s t e r I d ,   w a l l e t I d ] ) 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   T o k e n s   ( F a s e   3 ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   T o k e n   { 
 
     i d                 S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     m i n t             S t r i n g       @ u n i q u e 
 
     s y m b o l         S t r i n g ? 
 
     n a m e             S t r i n g ? 
 
     c r e a t o r I d   S t r i n g ? 
 
     c r e a t o r       C r e a t o r ?     @ r e l a t i o n ( f i e l d s :   [ c r e a t o r I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     c r e a t e d A t   D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     m e t r i c s         T o k e n M e t r i c [ ] 
 
     r i s k E v e n t s   T o k e n R i s k E v e n t [ ] 
 
 } 
 
 
 
 m o d e l   T o k e n M e t r i c   { 
 
     i d                               S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     t o k e n I d                     S t r i n g 
 
     t o k e n                         T o k e n         @ r e l a t i o n ( f i e l d s :   [ t o k e n I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     l i q u i d i t y L a m p o r t s   B i g I n t ? 
 
     h o l d e r C o u n t             I n t ? 
 
     t o p H o l d e r P c t           F l o a t ? 
 
     c o m p u t e d A t               D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     @ @ i n d e x ( [ t o k e n I d ,   c o m p u t e d A t ] ) 
 
 } 
 
 
 
 m o d e l   T o k e n R i s k E v e n t   { 
 
     i d                 S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     t o k e n I d       S t r i n g 
 
     t o k e n           T o k e n         @ r e l a t i o n ( f i e l d s :   [ t o k e n I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     k i n d             S t r i n g   / /   e x . :   " b u n d l e " ,   " d e v _ d u m p " ,  
 " h o n e y p o t _ s u s p e c t " 
 
     s e v e r i t y     S t r i n g   / /   " i n f o "   |   " w a r n "   |   " c r i t i c a l " 
 
     d e t a i l s       J s o n ? 
 
     d e t e c t e d A t   D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 m o d e l   C r e a t o r   { 
 
     i d                 S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     a d d r e s s       S t r i n g       @ u n i q u e 
 
     r i s k S c o r e   F l o a t ? 
 
     c r e a t e d A t   D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     t o k e n s         T o k e n [ ] 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   I n g e s t i o n   ( F a s e   1 ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   O b s e r v e d E v e n t   { 
 
     i d                               S t r i n g         @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     s i g n a t u r e                 S t r i n g 
 
     i n s t r u c t i o n I n d e x   I n t 
 
     w a l l e t                       S t r i n g 
 
     e v e n t T y p e                 S t r i n g 
 
     s l o t                           B i g I n t ? 
 
     b l o c k T i m e                 D a t e T i m e ? 
 
     p a y l o a d                     J s o n ? 
 
     r e c e i v e d A t               D a t e T i m e     @ d e f a u l t ( n o w ( ) ) 
 
 
 
     / /   E n r i c h m e n t   F 1 . 5   ( d e c o d e r   p u m p . f u n / P u m p S w a p )   ? ? t u d o  
 n u l l a b l e : 
 
     / /   e v e n t o s   a n t i g o s   e   n a o   d e c o d i f i c a v e i s   f i c a m  
 n u l l / U N K N O W N ,   n u n c a   i n f e r i d o s . 
 
     d i r e c t i o n             S t r i n g ?   / /   ' b u y '   |   ' s e l l ' 
 
     a m o u n t S o l             D e c i m a l ? 
 
     t o k e n A m o u n t         D e c i m a l ? 
 
     m i n t                       S t r i n g ? 
 
     c o u n t e r p a r t y       S t r i n g ?   / /   b o n d i n g   c u r v e   ( ? %?   c u r v e )   o u  
 p o o l   P u m p S w a p 
 
     e n r i c h S o u r c e       S t r i n g ?   / /   e x . :   ' p u m p - d e c o d e r - v 1 ' 
 
     e n r i c h e d A t           D a t e T i m e ? 
 
     e n r i c h A t t e m p t s   I n t             @ d e f a u l t ( 0 ) 
 
 
 
     / /   C h a v e   d e   d e d u p   ( i d e m p o t ? %? n c i a   -   A G E N T S . m d   r e g r a   6 ) 
 
     @ @ u n i q u e ( [ s i g n a t u r e ,   i n s t r u c t i o n I n d e x ,   w a l l e t ] ) 
 
     @ @ i n d e x ( [ m i n t ] ) 
 
     @ @ i n d e x ( [ e v e n t T y p e ] ) 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   S i g n a l s   ( F a s e s   4 ? ? ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   S i g n a l   { 
 
     i d                             S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d       S t r i n g 
 
     s t r a t e g y I d             S t r i n g 
 
     s t r a t e g y V e r s i o n   S t r i n g 
 
     m i n t                         S t r i n g 
 
     d i r e c t i o n               S t r i n g   / /   " b u y "   |   " s e l l " 
 
     s c o r e                       F l o a t ? 
 
     s t a t u s                     S t r i n g       @ d e f a u l t ( " p e n d i n g " )   / /   p e n d i n g  
 |   a p p r o v e d   |   v e t o e d   |   e x p i r e d 
 
     c r e a t e d A t               D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     f e a t u r e s                 S i g n a l F e a t u r e [ ] 
 
     o r d e r s                     O r d e r [ ] 
 
 
 
     @ @ i n d e x ( [ s t r a t e g y I d ,   s t r a t e g y V e r s i o n ,   c r e a t e d A t ] ) 
 
 } 
 
 
 
 m o d e l   S i g n a l F e a t u r e   { 
 
     i d                 S t r i n g   @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     s i g n a l I d     S t r i n g 
 
     s i g n a l         S i g n a l   @ r e l a t i o n ( f i e l d s :   [ s i g n a l I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     n a m e             S t r i n g 
 
     v a l u e           F l o a t 
 
 
 
     @ @ u n i q u e ( [ s i g n a l I d ,   n a m e ] ) 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   E x e c u t i o n   ( F a s e s   9 ? ? 0 )   ? ? n u n c a   h a b i l i t a r   L I V E   s e m  
 a p r o v a %? %? o   h u m a n a 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   O r d e r   { 
 
     i d                         S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d   S t r i n g 
 
     s i g n a l I d             S t r i n g ? 
 
     s i g n a l                 S i g n a l ?     @ r e l a t i o n ( f i e l d s :   [ s i g n a l I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     m o d e                     S t r i n g   / /   " P A P E R "   |   " S H A D O W "   |   " L I V E " 
 
     m i n t                     S t r i n g 
 
     s i d e                     S t r i n g 
 
     a m o u n t L a m p o r t s   B i g I n t 
 
     s t a t u s                 S t r i n g       @ d e f a u l t ( " c r e a t e d " )   / /   c r e a t e d   |  
 s u b m i t t e d   |   c o n f i r m e d   |   f a i l e d   |   v e t o e d 
 
     c r e a t e d A t           D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
     u p d a t e d A t           D a t e T i m e   @ u p d a t e d A t 
 
 
 
     t r a n s a c t i o n s     T r a n s a c t i o n [ ] 
 
     p o s i t i o n s           P o s i t i o n [ ] 
 
 } 
 
 
 
 m o d e l   T r a n s a c t i o n   { 
 
     i d                         S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d   S t r i n g 
 
     o r d e r I d               S t r i n g ? 
 
     o r d e r                   O r d e r ?       @ r e l a t i o n ( f i e l d s :   [ o r d e r I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     s i g n a t u r e           S t r i n g ?     @ u n i q u e 
 
     s t a t u s                 S t r i n g   / /   " b u i l t "   |   " s e n t "   |   " c o n f i r m e d "   |  
 " f a i l e d " 
 
     f e e L a m p o r t s       B i g I n t ? 
 
     p r i o r i t y F e e L a m p o r t s   B i g I n t ? 
 
     t i p L a m p o r t s       B i g I n t ? 
 
     s e n t A t                 D a t e T i m e ? 
 
     c o n f i r m e d A t       D a t e T i m e ? 
 
     c r e a t e d A t           D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 m o d e l   P o s i t i o n   { 
 
     i d                         S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d   S t r i n g 
 
     o r d e r I d               S t r i n g ? 
 
     o r d e r                   O r d e r ?       @ r e l a t i o n ( f i e l d s :   [ o r d e r I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     m i n t                     S t r i n g 
 
     s t a t u s                 S t r i n g       @ d e f a u l t ( " o p e n " )   / /   o p e n   |   c l o s e d 
 
     o p e n e d A t             D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
     c l o s e d A t             D a t e T i m e ? 
 
     g r o s s P n l L a m p o r t s   B i g I n t ? 
 
     n e t P n l L a m p o r t s       B i g I n t ? 
 
 } 
 
 
 
 m o d e l   E x e c u t i o n M e t r i c   { 
 
     i d                         S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d   S t r i n g 
 
     n a m e                     S t r i n g 
 
     v a l u e                   F l o a t 
 
     r e c o r d e d A t         D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   B a c k t e s t   /   M L   ( F a s e s   5 ? ? ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   B a c k t e s t R u n   { 
 
     i d                             S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     s t r a t e g y I d             S t r i n g 
 
     s t r a t e g y V e r s i o n   S t r i n g 
 
     p a r a m s                     J s o n ? 
 
     s t a r t e d A t               D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
     f i n i s h e d A t             D a t e T i m e ? 
 
     s t a t u s                     S t r i n g       @ d e f a u l t ( " r u n n i n g " ) 
 
 
 
     t r a d e s                     B a c k t e s t T r a d e [ ] 
 
 } 
 
 
 
 m o d e l   B a c k t e s t T r a d e   { 
 
     i d                       S t r i n g             @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     r u n I d                 S t r i n g 
 
     r u n                     B a c k t e s t R u n   @ r e l a t i o n ( f i e l d s :   [ r u n I d ] ,  
 r e f e r e n c e s :   [ i d ] ) 
 
     m i n t                   S t r i n g 
 
     e n t r y A t             D a t e T i m e 
 
     e x i t A t               D a t e T i m e ? 
 
     g r o s s P n l L a m p o r t s   B i g I n t ? 
 
     n e t P n l L a m p o r t s       B i g I n t ? 
 
 } 
 
 
 
 m o d e l   M o d e l V e r s i o n   { 
 
     i d                                     S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     m o d e l I d                           S t r i n g 
 
     m o d e l V e r s i o n                 S t r i n g 
 
     f e a t u r e S c h e m a V e r s i o n   S t r i n g 
 
     a r t i f a c t U r i                   S t r i n g ? 
 
     t r a i n e d A t                       D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 
 
     p r e d i c t i o n s                   M o d e l P r e d i c t i o n [ ] 
 
 
 
     @ @ u n i q u e ( [ m o d e l I d ,   m o d e l V e r s i o n ] ) 
 
 } 
 
 
 
 m o d e l   M o d e l P r e d i c t i o n   { 
 
     i d                           S t r i n g               @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     m o d e l V e r s i o n I d   S t r i n g 
 
     m o d e l V e r s i o n       M o d e l V e r s i o n   @ r e l a t i o n ( f i e l d s :  
 [ m o d e l V e r s i o n I d ] ,   r e f e r e n c e s :   [ i d ] ) 
 
     c o r r e l a t i o n I d     S t r i n g ? 
 
     i n p u t H a s h             S t r i n g ? 
 
     o u t p u t                   J s o n 
 
     p r e d i c t e d A t         D a t e T i m e           @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 / /   S i s t e m a   /   R i s c o   /   A u d i t o r i a   ( t r a n s v e r s a l ) 
 
 / /   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
- - - - - - - - - - - - - - - - - - - 
 
 
 
 m o d e l   S y s t e m E v e n t   { 
 
     i d                 S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     k i n d             S t r i n g 
 
     s e v e r i t y     S t r i n g       @ d e f a u l t ( " i n f o " ) 
 
     m e s s a g e       S t r i n g 
 
     d e t a i l s       J s o n ? 
 
     c r e a t e d A t   D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 m o d e l   R i s k E v e n t   { 
 
     i d                         S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     c o r r e l a t i o n I d   S t r i n g ? 
 
     k i n d                     S t r i n g   / /   e x . :   " v e t o " ,   " c i r c u i t _ b r e a k e r " ,  
 " k i l l _ s w i t c h " 
 
     r e a s o n                 S t r i n g 
 
     d e t a i l s               J s o n ? 
 
     c r e a t e d A t           D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
 
 m o d e l   A u d i t L o g   { 
 
     i d                 S t r i n g       @ i d   @ d e f a u l t ( c u i d ( ) ) 
 
     a c t o r           S t r i n g 
 
     a c t i o n         S t r i n g 
 
     t a r g e t         S t r i n g ? 
 
     d e t a i l s       J s o n ? 
 
     c r e a t e d A t   D a t e T i m e   @ d e f a u l t ( n o w ( ) ) 
 
 } 
 
 
[0m
The PowerShell pipeline corrupted my byte analysis (PowerShell re-encodes native stdout). Let me do a clean byte-exact extraction via cmd, and set up a worktree to run the actual tests.
[0m$ [0m$blob = git rev-parse "fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e^:packages/database/prisma/schema.prisma"; 
cmd /c "git cat-file blob $blob > `"$env:TEMP\opencode\parent-schema-cmd.bin`""; $bytes = 
[System.IO.File]::ReadAllBytes("$env:TEMP\opencode\parent-schema-cmd.bin"); $nonAscii = 0; for ($i=0; $i -lt 
$bytes.Length; $i++) { if ($bytes[$i] -gt 127) { $nonAscii++ } }; "total: $($bytes.Length), non-ascii bytes: $nonAscii"
total: 9626, non-ascii bytes: 38
[0m
[0m$ [0mTest-Path "C:\Users\enzo\Desktop\copytrade 2\node_modules"; git worktree list
True
C:/Users/enzo/Desktop/copytrade 2                      f92985a [master]
C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment     fd6a5a6 [sprint/f1-5-enrichment]
C:/Users/enzo/Desktop/copytrade-wt-f1-postgres-live    cbd49d4 [sprint/f1-postgres-live]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes   19ffacc [sprint/f1-security-fixes]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes-2 df98063 [sprint/f1-security-fixes-2]
[0m
There's already a worktree at the exact commit. Let me decode the parent schema's non-ASCII bytes properly, and run the test suite in the worktree.
[0m$ [0m$bytes = [System.IO.File]::ReadAllBytes("$env:TEMP\opencode\parent-schema-cmd.bin"); $sb = New-Object 
System.Text.StringBuilder; $i = 0; $bad = 0; while ($i -lt $bytes.Length) { $b = $bytes[$i]; if ($b -le 127) { 
[void]$sb.Append([char]$b); $i++ } elseif ($b -ge 0xC2 -and $b -le 0xDF -and $i+1 -lt $bytes.Length -and ($bytes[$i+1] 
-band 0xC0) -eq 0x80) { $cp = (($b -band 0x1F) -shl 6) -bor ($bytes[$i+1] -band 0x3F); [void]$sb.Append([char]$cp); $i 
+= 2 } elseif ($b -ge 0xE0 -and $b -le 0xEF -and $i+2 -lt $bytes.Length -and ($bytes[$i+1] -band 0xC0) -eq 0x80 -and 
($bytes[$i+2] -band 0xC0) -eq 0x80) { $cp = (($b -band 0x0F) -shl 12) -bor (($bytes[$i+1] -band 0x3F) -shl 6) -bor 
($bytes[$i+2] -band 0x3F); [void]$sb.Append([char]$cp); $i += 3 } else { $bad++; [void]$sb.Append('?'); $i++ } }; 
$text = $sb.ToString(); "bad/undecodable bytes: $bad"; $lines = $text -split "`n"; foreach ($ln in $lines) { if ($ln 
-match '[^\x00-\x7F]') { $ln } }
bad/undecodable bytes: 0
// @ct/database - Prisma schema v1 (Fases 1-9)
// Fonte de verdade para persist´┐¢ncia. Nunca adicionar secrets aqui (somente env refs).
  // ObservedEvent usa `wallet` como address (String), n´┐¢o FK - sem relation aqui.
  // Enrichment F1.5 (decoder pump.fun/PumpSwap) - tudo nullable:
  counterparty   String? // bonding curve (? curve) ou pool PumpSwap
  // Chave de dedup (idempot?ncia - AGENTS.md regra 6)
// Signals (Fases 4-7)
// Execution (Fases 9-10) - nunca habilitar LIVE sem aprova´┐¢´┐¢o humana
// Backtest / ML (Fases 5-7)
[0m
All 38 non-ASCII bytes are valid UTF-8 (0 undecodable); the `?` in output is console rendering. Let me get exact code points to know which characters the commit destroyed vs. repaired.
[0m$ [0m$bytes = [System.IO.File]::ReadAllBytes("$env:TEMP\opencode\parent-schema-cmd.bin"); $cps = @(); $i = 0; 
while ($i -lt $bytes.Length) { $b = $bytes[$i]; if ($b -le 127) { $i++ } elseif ($b -ge 0xC2 -and $b -le 0xDF -and 
$i+1 -lt $bytes.Length) { $cps += (($b -band 0x1F) -shl 6) -bor ($bytes[$i+1] -band 0x3F); $i += 2 } elseif ($b -ge 
0xE0 -and $b -le 0xEF -and $i+2 -lt $bytes.Length) { $cps += (($b -band 0x0F) -shl 12) -bor (($bytes[$i+1] -band 0x3F) 
-shl 6) -bor ($bytes[$i+2] -band 0x3F); $i += 3 } else { $cps += -1; $i++ } }; $grouped = $cps | Group-Object | 
Sort-Object Name; foreach ($g in $grouped) { "U+{0:X4} x{1}" -f [int]$g.Name, $g.Count }
U+00E3 x2
U+00E7 x1
U+00EA x1
U+6CF5 x1
U+FFFD x1
U+2013 x4
U+2014 x4
[0m
Confirmed: the parent had 13 non-ASCII chars ÔÇö 12 perfectly valid (├ú├º├¬µ│ÁÔÇôÔÇö) + 1 corrupted (U+FFFD). The commit replaced ALL with literal `?`, destroying 12 valid characters to fix 1 corruption. Now let me run the actual tests in the worktree.
[0m$ [0mTest-Path "C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment\node_modules"; Get-ChildItem 
"C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment" -Name | Select-Object -First 20
True
.agents
.github
.opencode
apps
backtester
data
docs
infrastructure
ml
node_modules
packages
scripts
services
tests
.editorconfig
.env
.env.example
.eslintrc.cjs
.gitignore
.prettierrc.json
[0m
[93m[1m! [0mpermission requested: external_directory 
(C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment\packages\database\*); auto-rejecting
[0mÔ£ù [0mif ($?) { npm test -- --run 2>&1 | Select-Object -Last 40 } failed
[91m[1mError: [0mThe user rejected permission to use this specific tool call.

