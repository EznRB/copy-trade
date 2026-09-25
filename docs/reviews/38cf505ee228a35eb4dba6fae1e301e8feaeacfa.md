# Review 38cf505ee228a35eb4dba6fae1e301e8feaeacfa

- Branch: sprint/f1-5-enrichment
- Data: 2026-09-25 02:50:01
- Gates: lint=1 typecheck=1 test=1 (0 = ok)
- Veredito: **REJEITADO**

## Saida do code-reviewer

opencode.exe : [0m
No C:\Users\enzo\AppData\Roaming\npm\opencode.ps1:14 caractere:3
+   & "$basedir/node_modules/opencode-ai/bin/opencode.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ([0m:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
> code-reviewer ┬À big-pickle
[0m
[0m$ [0mgit log --oneline -5 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
38cf505 feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
20d93cf feat(f1.5): helius-provider per-wallet subscriptions + anti-leak de sockets + maxSupportedTransactionVersion=1 
+ testes
3d6c9db feat(f1.5): schema ObservedEvent com enrichment + migration + repositories com guarda TOCTOU + testes
7d7e3d1 feat(f1.5): decoder pump.fun/PumpSwap via codama da IDL oficial (pump-public-docs @81091419)
3e51d3e review(sprint/f1-5-enrichment): REJEITADO (gates falharam) cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa --stat
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

 .eslintrc.cjs                                      |    3 +-
 .gitignore                                         |    2 +
 cols.sql                                           |    1 +
 ...ADR-025-fatos-runtime-f15-decoder-enrichment.md |   11 +
 docs/handoff.md                                    |   45 +
 docs/research/f15/README.md                        |   28 +
 docs/research/f15/backfill-report.json             |   40 +
 docs/research/f15/fixtures-report.json             |  267 ++++
 docs/roadmap.md                                    |    8 +
 infrastructure/scripts/check-secrets.mjs           |    6 +
 package-lock.json                                  | 1635 +++++++++++++++++++-
 scripts/f15-backfill.mjs                           |   69 +
 scripts/f15-fixtures.mjs                           |  147 ++
 services/data-ingestion/package.json               |   45 +-
 services/data-ingestion/src/enrich-runner.ts       |   52 +
 services/data-ingestion/src/enricher.test.ts       |  154 ++
 services/data-ingestion/src/enricher.ts            |  165 ++
 services/data-ingestion/src/index.ts               |   84 +
 services/data-ingestion/src/instance-lock.test.ts  |   96 ++
 services/data-ingestion/src/instance-lock.ts       |   71 +
 services/data-ingestion/src/retention.test.ts      |   81 +
 services/data-ingestion/src/retention.ts           |   88 ++
 services/data-ingestion/tsconfig.json              |   45 +-
 23 files changed, 3069 insertions(+), 74 deletions(-)
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/src/enricher.ts
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/services/data-ingestion/src/enricher.ts b/services/data-ingestion/src/enricher.ts
new file mode 100644
index 0000000..491296a
--- /dev/null
+++ b/services/data-ingestion/src/enricher.ts
@@ -0,0 +1,165 @@
+/**
+ * enricher.ts ÔÇö F1.5: transforma ObservedEvent crus (UNKNOWN) em eventos com
+ * dire├º├úo/valores via decode da transa├º├úo completa (getTransaction), usando o
+ * decoder oficial pump.fun/PumpSwap de @ct/pumpfun (IDL oficial + codama).
+ *
+ * Regras inviol├íveis:
+ * - Sem eventType real decodificado ÔåÆ UNKNOWN expl├¡cito (markUndecodable).
+ * - Amounts vindos da INSTRU├ç├âO s├úo par├ómetros/limites, n├úo realizados ÔÇö
+ *   documentado em decode.ts. O pipeline F1.5 persiste o que decode fornece
+ *   e marca enrichSource='pump-decoder-v1' (rastre├ível; revog├ível).
+ */
+import { decodePumpInstruction, type DecodedSwap } from '@ct/pumpfun';
+
+/** Shape m├¡nimo do getTransaction(jsonParsed) que usamos. */
+export interface ParsedTx {
+  meta?: {
+    innerInstructions?: Array<{
+      index: number;
+      instructions: ParsedInstruction[];
+    }> | null;
+  } | null;
+  transaction?: {
+    message?: {
+      accountKeys?: Array<{ pubkey?: string } | string> | null;
+      instructions?: ParsedInstruction[] | null;
+    } | null;
+  } | null;
+}
+
+export interface ParsedInstruction {
+  programId?: string;
+  /** jsonParsed "partially decoded": accounts ├® indireto pela message. */
+  accounts?: string[]; // j├í resolvidas para endere├ºos (eta)
+  data?: string; // base58
+  /** jsonParsed fully parsed */
+  parsed?: unknown;
+}
+
+export interface TxFetcher {
+  getTransaction(signature: string): Promise<unknown>;
+}
+
+export interface EnrichStore {
+  markEnriched(id: string, d: DecodedSwap): Promise<void>;
+  markUndecodable(id: string, reason: string): Promise<void>;
+  bumpAttempt(id: string): Promise<void>;
+}
+
+/** Converte base58 ÔåÆ Uint8Array (alphabet Bitcoin/Solana, sem libs externas). */
+export function base58ToBytes(s: string): Uint8Array | null {
+  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
+  const map = new Map(
+    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
+      .split('')
+      .map((c, i) => [c, BigInt(i)] as const),
+  );
+  let num = 0n;
+  for (const ch of s) {
+    const v = map.get(ch);
+    if (v === undefined) return null;
+    num = num * 58n + v;
+  }
+  const bytes: number[] = [];
+  let n = num;
+  if (n === 0n) bytes.push(0);
+  while (n > 0n) {
+    bytes.unshift(Number(n % 256n));
+    n /= 256n;
+  }
+  // Preserva 0s ├á esquerda ('1')
+  for (const ch of s) {
+    if (ch === '1') bytes.unshift(0);
+    else break;
+  }
+  return Uint8Array.from(bytes.reverse().reverse());
+}
+
+/**
+ * Resolve o array de pubkeys da message para endere├ºos string, combinando
+ * instru├º├Áes externas e internas com ├¡ndices de conta. Retorna lista de
+ * { programId, accountKeys }, ou null se a tx estiver inutiliz├ível.
+ */
+export function collectInstructionCalls(
+  tx: ParsedTx,
+): Array<{ programId: string; data: Uint8Array; accounts: string[] }> {
+  const keys = tx?.transaction?.message?.accountKeys;
+  if (!Array.isArray(keys)) return [];
+  const keyAt = (i: number): string | null => {
+    const k = keys[i];
+    if (typeof k === 'string') return k;
+    return k?.pubkey ?? null;
+  };
+
+  const calls: Array<{ programId: string; data: Uint8Array; accounts: string[] }> = [];
+  const push = (ix: ParsedInstruction & { programIdIndex?: number; accountKeys?: number[] }) => {
+    // jsonParsed: programId j├í string; "partially decoded" traz programIdIndex + data base58 + accounts (indices)
+    const programId = ix.programId ?? (ix.programIdIndex != null ? keyAt(ix.programIdIndex) : null);
+    if (!programId) return;
+    const accounts = Array.isArray(ix.accounts)
+      ? (ix.accounts as unknown[]).map((a) =>
+          typeof a === 'string' ? a : typeof a === 'number' ? keyAt(a) : null,
+        )
+      : null;
+    if (!accounts || accounts.some((a) => a === null)) return;
+    const dataB58 = typeof ix.data === 'string' ? ix.data : null;
+    if (!dataB58) return;
+    const bytes = base58ToBytes(dataB58);
+    if (!bytes) return;
+    calls.push({ programId, data: bytes, accounts: accounts as string[] });
+  };
+
+  for (const ix of tx.transaction?.message?.instructions ?? []) push(ix);
+  for (const inner of tx.meta?.innerInstructions ?? []) {
+    for (const ix of inner?.instructions ?? []) push(ix);
+  }
+  return calls;
+}
+
+export class Enricher {
+  private running = 0;
+
+  constructor(
+    private readonly fetcher: TxFetcher,
+    private readonly store: EnrichStore,
+    private readonly logger: {
+      info(m: string, f?: Record<string, unknown>): void;
+      warn(m: string, f?: Record<string, unknown>): void;
+      error(m: string, f?: Record<string, unknown>): void;
+    },
+    private readonly maxAttempts = 5,
+  ) {}
+
+  /** Enriquece um evento por signature. Idempotente por coluna (update por id). */
+  async enrich(id: string, signature: string): Promise<'enriched' | 'undecodable' | 'retry'> {
+    this.running++;
+    try {
+      await this.store.bumpAttempt(id);
+      const rawTx = await this.fetcher.getTransaction(signature);
+      const calls = collectInstructionCalls(rawTx as ParsedTx);
+      let decoded: DecodedSwap | null = null;
+      for (const c of calls) {
+        decoded = decodePumpInstruction(c.programId, c.data, c.accounts);
+        if (decoded) break;
+      }
+      if (!decoded) {
+        await this.store.markUndecodable(id, 'no-decodable-instruction');
+        return 'undecodable';
+      }
+      await this.store.markEnriched(id, decoded);
+      return 'enriched';
+    } catch (err) {
+      // Erro transit├│rio de RPC: retry at├® maxAttempts (sem marca├º├úo definitiva).
+      this.logger.warn('enrich falhou (retry se attempts < max)', {
+        errorClass: 'RPC_ERROR',
+        id,
+        error: err instanceof Error ? err.message : String(err),
+      });
+      return 'retry';
+    } finally {
+      this.running--;
+    }
+  }
+}
+
+export { type DecodedSwap };
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/src/enrich-runner.ts 
services/data-ingestion/src/index.ts
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/services/data-ingestion/src/enrich-runner.ts b/services/data-ingestion/src/enrich-runner.ts
new file mode 100644
index 0000000..f758f17
--- /dev/null
+++ b/services/data-ingestion/src/enrich-runner.ts
@@ -0,0 +1,52 @@
+/**
+ * enrich-runner.ts ÔÇö loop/worker de enrichment F1.5 (usado pelo servi├ºo e
+ * pelo script one-shot de backfill). Batch de eventos n├úo enriquecidos,
+ * rate-limit configur├ível, sem Throw no loop.
+ */
+import type { Enricher } from './enricher.js';
+
+export interface UnenrichedStore {
+  findUnenriched(limit: number, maxAttempts: number): Promise<
+    Array<{ id: string; signature: string }>
+  >;
+}
+
+export interface RunnerStats {
+  seen: number;
+  enriched: number;
+  undecodable: number;
+  retried: number;
+}
+
+export class EnrichRunner {
+  readonly stats: RunnerStats = { seen: 0, enriched: 0, undecodable: 0, retried: 0 };
+  private stopFlag = false;
+
+  constructor(
+    private readonly store: UnenrichedStore,
+    private readonly enricher: Enricher,
+    private readonly opts: { batchSize: number; maxAttempts: number; sleepMs: number },
+  ) {}
+
+  stop(): void {
+    this.stopFlag = true;
+  }
+
+  /** Uma passada completa at├® esgotar a fila ou stopFlag. */
+  async runUntilEmpty(maxBatches: number = Number.MAX_SAFE_INTEGER): Promise<RunnerStats> {
+    for (let b = 0; b < maxBatches && !this.stopFlag; b++) {
+      const batch = await this.store.findUnenriched(this.opts.batchSize, this.opts.maxAttempts);
+      if (batch.length === 0) break;
+      for (const row of batch) {
+        if (this.stopFlag) break;
+        const r = await this.enricher.enrich(row.id, row.signature);
+        this.stats.seen++;
+        if (r === 'enriched') this.stats.enriched++;
+        else if (r === 'undecodable') this.stats.undecodable++;
+        else this.stats.retried++;
+        if (this.opts.sleepMs > 0) await new Promise((r2) => setTimeout(r2, this.opts.sleepMs));
+      }
+    }
+    return this.stats;
+  }
+}
diff --git a/services/data-ingestion/src/index.ts b/services/data-ingestion/src/index.ts
index 9c692c3..6a4c74b 100644
--- a/services/data-ingestion/src/index.ts
+++ b/services/data-ingestion/src/index.ts
@@ -10,6 +10,22 @@ import { normalizeRawNotification } from './normalizer.js';
 import { DedupStore } from './dedup-store.js';
 import { IngestionPipeline } from './pipeline.js';
 import { createDataProvider } from './factory.js';
+import { InstanceLock } from './instance-lock.js';
+import { RetentionJob } from './retention.js';
+import { Enricher, type DecodedSwap } from './enricher.js';
+import { EnrichRunner } from './enrich-runner.js';
+import { RpcProvider } from '@ct/solana';
+import {
+  markEnriched as repoMarkEnriched,
+  markUndecodable as repoMarkUndecodable,
+  findUnenriched as repoFindUnenriched,
+  incrementEnrichAttempt as repoIncrementAttempt,
+} from '@ct/database';
+// Nota: prisma.observedEvent (delegate tipado do Prisma) e a interface m├¡nima
+// ObservedEventEnrichDelegate divergem por exactOptionalPropertyTypes; o cast
+// no ponto de glue (abaixo) ├® consciente ÔÇö os repos validam os payloads.
+import type { ObservedEventEnrichDelegate } from '@ct/database';
+import type { DecodedSwap as DecodedSwapType } from '@ct/pumpfun';
 
 const SERVICE_NAME = 'data-ingestion';
 
@@ -18,10 +34,20 @@ export async function start(): Promise<void> {
   const logger = createLogger(SERVICE_NAME);
   logger.info('service booting', { tradingMode: config.tradingMode });
 
+  // Single-instance (ADR-024): aborta se j├í houver inst├óncia viva rodando.
+  const lock = new InstanceLock(
+    process.env['INGESTION_LOCK_PATH'] ?? './data/locks/data-ingestion.lock',
+  );
+  lock.acquire();
+
   const store = new DedupStore(prisma.observedEvent);
   const pipeline = new IngestionPipeline(store, logger);
   pipeline.start();
 
+  // Reten├º├úo RAW (ADR-024): al├¡vio de disco; agrega├º├úo vem em fases futuras.
+  const retention = new RetentionJob(prisma.observedEvent, logger);
+  retention.start();
+
   const provider = createDataProvider(config, { logger });
   /*
    * logsNotification n├úo carrega wallet/instruction_index ÔÇö o enriquecimento
@@ -59,6 +85,60 @@ export async function start(): Promise<void> {
   });
   await provider.connect();
 
+  // ---- F1.5: enricher (decode BUY/SELL real) -------------------------------
+  // Ligado por padr├úo em todos os modos (s├│ leitura on-chain + escrita local;
+  // nenhuma transa├º├úo ├® enviada). Retries limitados por enrichAttempts.
+  const rpc = new RpcProvider(
+    [{ name: 'primary', url: config.SOLANA_RPC_HTTP, tier: 'primary' }],
+    { logger },
+  );
+  const enricher = new Enricher(
+    { getTransaction: (sig) => rpc.getTransaction(sig) },
+    {
+      async bumpAttempt(id) {
+        await repoIncrementAttempt({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, 
id);
+      },
+      async markEnriched(id, d: DecodedSwap) {
+        const dec: DecodedSwapType = d;
+        await repoMarkEnriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, {
+          id,
+          direction: dec.direction,
+          amountSol: dec.solAmount,
+          tokenAmount: dec.tokenAmount,
+          mint: dec.mint,
+          counterparty: dec.counterparty,
+          enrichSource: `pump-decoder-v1:${dec.kind}`,
+        });
+      },
+      async markUndecodable(id, reason) {
+        await repoMarkUndecodable({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, 
id, reason);
+      },
+    },
+    logger,
+  );
+  let enrichTimer: NodeJS.Timeout | null = null;
+  const runner = new EnrichRunner(
+    {
+      findUnenriched: (limit, maxAttempts) =>
+        repoFindUnenriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, { 
limit, maxAttempts }),
+    },
+    enricher,
+    {
+      batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25),
+      maxAttempts: Number(process.env['ENRICH_MAX_ATTEMPTS'] ?? 5),
+      sleepMs: Number(process.env['ENRICH_SLEEP_MS'] ?? 120), // ~8 req/s no RPC
+    },
+  );
+  const enrichEnabled = (process.env['ENRICH_ENABLED'] ?? 'true') === 'true';
+  if (enrichEnabled) {
+    enrichTimer = setInterval(() => void runner.runUntilEmpty(1), 2_000);
+    enrichTimer.unref?.();
+    logger.info('enricher ativo', { batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25) });
+  } else {
+    logger.warn('enricher DESLIGADO (ENRICH_ENABLED=false)');
+  }
+  // ---------------------------------------------------------------------------
+
   // Subscri├º├úo expl├¡cita: sem endere├ºos configurados o pipeline sobe mas n├úo observa nada.
   const watch = (config.INGESTION_WATCH_ADDRESSES ?? '')
     .split(',')
@@ -75,9 +155,13 @@ export async function start(): Promise<void> {
 
   const shutdown = async (signal: string): Promise<void> => {
     logger.info('shutdown iniciado', { signal });
+    runner.stop();
+    if (enrichTimer !== null) clearInterval(enrichTimer);
+    retention.stop();
     await pipeline.stop(); // drain: para de aceitar novos, stats finais
     await provider.close();
     await prisma.$disconnect();
+    lock.release();
     logger.info('shutdown completo', { signal });
     process.exit(0);
   };
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/package.json 
services/data-ingestion/tsconfig.json .eslintrc.cjs .gitignore cols.sql
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/.eslintrc.cjs b/.eslintrc.cjs
index 9bdae1b..fc2a717 100644
--- a/.eslintrc.cjs
+++ b/.eslintrc.cjs
@@ -27,5 +27,6 @@ module.exports = {
       },
     ],
   },
-  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js', '!.*.cjs', 'ml/', '.next/'],
+  ignorePatterns: [
+    'packages/pumpfun/src/generated/**','dist/', 'node_modules/', 'coverage/', '*.js', '!.*.cjs', 'ml/', '.next/'],
 };
diff --git a/.gitignore b/.gitignore
index 5e704a8..299aff8 100644
--- a/.gitignore
+++ b/.gitignore
@@ -47,3 +47,5 @@ Thumbs.db
 *.tsbuildinfo
 
 .serena/
+
+data/locks/
diff --git a/cols.sql b/cols.sql
new file mode 100644
index 0000000..b172f73
--- /dev/null
+++ b/cols.sql
@@ -0,0 +1 @@
+SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ObservedEvent' ORDER BY 
ordinal_position;
diff --git a/services/data-ingestion/package.json b/services/data-ingestion/package.json
index d6862ae..9815d9a 100644
--- a/services/data-ingestion/package.json
+++ b/services/data-ingestion/package.json
@@ -1,23 +1,24 @@
-{
-  "name": "@ct/service-data-ingestion",
-  "version": "0.1.0",
-  "private": true,
-  "type": "module",
-  "main": "./dist/main.js",
-  "scripts": {
-    "build": "tsc -b"
-  },
-  "dependencies": {
-    "@ct/config": "*",
-    "@ct/database": "*",
-    "@ct/logging": "*",
-    "@ct/solana": "*",
-    "@ct/types": "*",
-    "zod": "^3.23.8"
-  },
-  "devDependencies": {
-    "fast-check": "^3.19.0",
-    "typescript": "^5.4.5",
-    "vitest": "^3.2.7"
-  }
+´╗┐{
+    "name":  "@ct/service-data-ingestion",
+    "version":  "0.1.0",
+    "private":  true,
+    "type":  "module",
+    "main":  "./dist/main.js",
+    "scripts":  {
+                    "build":  "tsc -b"
+                },
+    "dependencies":  {
+                         "@ct/config":  "*",
+                         "@ct/database":  "*",
+                         "@ct/logging":  "*",
+                         "@ct/solana":  "*",
+                         "@ct/types":  "*",
+                         "zod":  "^3.23.8",
+                         "@ct/pumpfun":  "*"
+                     },
+    "devDependencies":  {
+                            "fast-check":  "^3.19.0",
+                            "typescript":  "^5.4.5",
+                            "vitest":  "^3.2.7"
+                        }
 }
diff --git a/services/data-ingestion/tsconfig.json b/services/data-ingestion/tsconfig.json
index 284e48f..7d8e444 100644
--- a/services/data-ingestion/tsconfig.json
+++ b/services/data-ingestion/tsconfig.json
@@ -1,16 +1,31 @@
-{
-  "extends": "../../tsconfig.base.json",
-  "compilerOptions": {
-    "outDir": "dist",
-    "rootDir": "src",
-    "composite": true
-  },
-  "include": ["src"],
-  "references": [
-    { "path": "../../packages/types" },
-    { "path": "../../packages/config" },
-    { "path": "../../packages/logging" },
-    { "path": "../../packages/database" },
-    { "path": "../../packages/solana" }
-  ]
+´╗┐{
+    "extends":  "../../tsconfig.base.json",
+    "compilerOptions":  {
+                            "outDir":  "dist",
+                            "rootDir":  "src",
+                            "composite":  true
+                        },
+    "include":  [
+                    "src"
+                ],
+    "references":  [
+                       {
+                           "path":  "../../packages/types"
+                       },
+                       {
+                           "path":  "../../packages/config"
+                       },
+                       {
+                           "path":  "../../packages/logging"
+                       },
+                       {
+                           "path":  "../../packages/database"
+                       },
+                       {
+                           "path":  "../../packages/solana"
+                       },
+                       {
+                           "path":  "../../packages/pumpfun"
+                       }
+                   ]
 }
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/src/retention.ts 
services/data-ingestion/src/instance-lock.ts
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/services/data-ingestion/src/instance-lock.ts b/services/data-ingestion/src/instance-lock.ts
new file mode 100644
index 0000000..2d9c93a
--- /dev/null
+++ b/services/data-ingestion/src/instance-lock.ts
@@ -0,0 +1,71 @@
+/**
+ * InstanceLock ÔÇö garante inst├óncia ├║nica do servi├ºo (ADR-024, d├®bito F1).
+ *
+ * Dois processos de ingest├úo rodando simultaneamente (como ocorreu no smoke
+ * da F1) duplicam trabalho e press├úo no provider/DB. Implementa├º├úo: lock file
+ * com PID; na inicializa├º├úo, se o lock existir E o PID estiver vivo ÔåÆ abortar
+ * boot (falha fechada, CONFIG_ERROR). PID morto ÔåÆ lock stale, removido.
+ */
+import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
+import { dirname } from 'node:path';
+
+export function isProcessAlive(pid: number): boolean {
+  try {
+    process.kill(pid, 0);
+    return true;
+  } catch (err) {
+    // EPERM = processo existe mas sem permiss├úo de sinal ÔÇö considerar vivo.
+    return (err as NodeJS.ErrnoException).code === 'EPERM';
+  }
+}
+
+export class InstanceLock {
+  private acquired = false;
+
+  constructor(
+    private readonly lockPath: string,
+    private readonly now: () => number = Date.now,
+  ) {}
+
+  acquire(): void {
+    if (existsSync(this.lockPath)) {
+      const lines = readFileSync(this.lockPath, 'utf8').trim().split('\n');
+      const pid = Number(lines[0]);
+      const createdAt = Number(lines[1] ?? 0);
+      // Stale por idade (review: PID reuse no Windows): lock mais velho que
+      // LOCK_STALE_MS (default 24h) ├® considerado morto mesmo se o PID existir.
+      const staleMs = Number(process.env['INGESTION_LOCK_STALE_MS'] ?? 86_400_000);
+      const isStaleByAge = createdAt > 0 && this.now() - createdAt > staleMs;
+      if (
+        !isStaleByAge &&
+        Number.isInteger(pid) &&
+        pid > 0 &&
+        pid !== process.pid &&
+        isProcessAlive(pid)
+      ) {
+        throw new Error(
+          `CONFIG_ERROR: j├í existe inst├óncia ativa (PID ${pid}) ÔÇö lock em ${this.lockPath}. ` +
+            'Encerre a inst├óncia anterior ou remova o lock se for stale.',
+        );
+      }
+      // Lock stale (processo morreu sem cleanup OU idade superada) ÔÇö remover e seguir.
+      unlinkSync(this.lockPath);
+    }
+    mkdirSync(dirname(this.lockPath), { recursive: true });
+    // Conte├║do: PID + timestamp (auditoria).
+    writeFileSync(this.lockPath, `${process.pid}\n${this.now()}\n`, { flag: 'wx' });
+    this.acquired = true;
+  }
+
+  release(): void {
+    if (!this.acquired) return;
+    this.acquired = false;
+    try {
+      const raw = readFileSync(this.lockPath, 'utf8').trim().split('\n')[0];
+      // S├│ remove se o lock ainda ├® nosso (evita apagar lock de outra inst├óncia).
+      if (raw === String(process.pid) && existsSync(this.lockPath)) unlinkSync(this.lockPath);
+    } catch {
+      // Lock file perdido/corrompido n├úo deve impedir shutdown.
+    }
+  }
+}
diff --git a/services/data-ingestion/src/retention.ts b/services/data-ingestion/src/retention.ts
new file mode 100644
index 0000000..9e0fc16
--- /dev/null
+++ b/services/data-ingestion/src/retention.ts
@@ -0,0 +1,88 @@
+/**
+ * Retention ÔÇö pol├¡tica de reten├º├úo da camada RAW (ADR-024, documento fonte ┬º63).
+ *
+ * FACT medido no smoke F1: ~568 MB/40min no fixture Pump.fun. Sem reten├º├úo,
+ * o disco esgota em dias. Pol├¡tica inicial: apagar ObservedEvent mais velhos
+ * que RETENTION_RAW_DAYS (default 3 dias), em lotes, fora do caminho quente.
+ *
+ * Fases futuras compactam RAW ÔåÆ NORMALIZED ÔåÆ FEATURES ÔåÆ AGGREGATES; aqui ├®
+ * apenas o al├¡vio bruto. NUNCA apagar dados necess├írios ao replay/backtest
+ * sem uma camada agregada persistida antes (d├®bito documentado em F5).
+ */
+import { setInterval, clearInterval } from 'node:timers';
+
+export interface RetentionRepo {
+  deleteMany(args: { where: { receivedAt: { lt: Date } } }): Promise<{ count: number }>;
+}
+
+export interface LoggerLike {
+  info(msg: string, fields?: Record<string, unknown>): void;
+  warn(msg: string, fields?: Record<string, unknown>): void;
+  error(msg: string, fields?: Record<string, unknown>): void;
+}
+
+export class RetentionJob {
+  private timer: NodeJS.Timeout | null = null;
+  private running = false;
+
+  constructor(
+    private readonly repo: RetentionRepo,
+    private readonly logger: LoggerLike,
+    private readonly retentionDays = Number(process.env['RETENTION_RAW_DAYS'] ?? 3),
+    private readonly intervalMs = Number(process.env['RETENTION_INTERVAL_MS'] ?? 3_600_000),
+    // ADR-024 + gate F1.5: purge de RAW NUNCA ├® default-on. Ligar s├│ de forma
+    // expl├¡cita (RETENTION_RAW_ENABLED=true) ÔÇö F1.5 aumenta volume e apagar
+    // RAW sem agregados persistidos destr├│i o material de replay/fixtures.
+    private readonly enabled = (process.env['RETENTION_RAW_ENABLED'] ?? 'false') === 'true',
+  ) {}
+
+  start(): void {
+    if (this.timer !== null) return;
+    if (!this.enabled) {
+      this.logger.info(
+        'retention DESLIGADA por padr├úo (ADR-024 ÔÇö F1.5 aumenta volume; ligar via RETENTION_RAW_ENABLED=true)',
+      );
+      return;
+    }
+    if (this.retentionDays <= 0) {
+      this.logger.warn('reten├º├úo DESLIGADA (RETENTION_RAW_DAYS <= 0) ÔÇö risco de disco', {
+        errorClass: 'CONFIG_ERROR',
+      });
+      return;
+    }
+    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
+    this.timer.unref?.();
+    this.logger.info('retention job ativo', {
+      retentionDays: this.retentionDays,
+      intervalMs: this.intervalMs,
+    });
+  }
+
+  async runOnce(): Promise<number> {
+    if (this.running) return 0; // sobreposi├º├úo defensiva
+    this.running = true;
+    try {
+      const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
+      const { count } = await this.repo.deleteMany({ where: { receivedAt: { lt: cutoff } } });
+      if (count > 0) {
+        this.logger.info('retention: RAW antigos removidos', { deleted: count, cutoff });
+      }
+      return count;
+    } catch (err) {
+      this.logger.error('retention falhou ÔÇö DATABASE_ERROR', {
+        errorClass: 'DATABASE_ERROR',
+        error: err instanceof Error ? err.message : String(err),
+      });
+      return 0;
+    } finally {
+      this.running = false;
+    }
+  }
+
+  stop(): void {
+    if (this.timer !== null) {
+      clearInterval(this.timer);
+      this.timer = null;
+    }
+  }
+}
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- scripts/f15-backfill.mjs scripts/f15-fixtures.mjs 
infrastructure/scripts/check-secrets.mjs
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/infrastructure/scripts/check-secrets.mjs b/infrastructure/scripts/check-secrets.mjs
index 671a3e8..619095f 100644
--- a/infrastructure/scripts/check-secrets.mjs
+++ b/infrastructure/scripts/check-secrets.mjs
@@ -41,6 +41,12 @@ function walk(dir) {
 
     if (allowExtensions.some((e) => entry.endsWith(e))) continue;
     if (skipFiles.has(entry)) continue;
+    // Relatorios de evidencia (docs/research/**/*.json) contem dados on-chain
+    // publicos (signatures/base58) por definicao ÔÇö nao sao secrets.
+    const relForExempt = relative(repoRoot, full).replace(/\\/g, "/");
+    const isResearchData =
+      relForExempt.startsWith("docs/research/") && relForExempt.endsWith(".json");
+    if (isResearchData) continue;
     const ext = extname(entry).toLowerCase();
     const isEnv = entry.startsWith(".env") && entry !== ".env.example";
     if (!isEnv && !textExtensions.has(ext)) continue;
diff --git a/scripts/f15-backfill.mjs b/scripts/f15-backfill.mjs
new file mode 100644
index 0000000..332d479
--- /dev/null
+++ b/scripts/f15-backfill.mjs
@@ -0,0 +1,69 @@
+// scripts/f15-backfill.mjs - GATE F1.5 (backfill one-shot):
+// Processa um lote de eventos persistidos e reporta cobertura (decoded vs UNKNOWN).
+// Uso: node --env-file=.env scripts/f15-backfill.mjs [batchSize] [maxBatches]
+import { prisma } from '../packages/database/dist/index.js';
+import { RpcProvider } from '../packages/solana/dist/index.js';
+import { Enricher } from '../services/data-ingestion/dist/enricher.js';
+import { EnrichRunner } from '../services/data-ingestion/dist/enrich-runner.js';
+import {
+  markEnriched,
+  markUndecodable,
+  findUnenriched,
+  incrementEnrichAttempt,
+} from '../packages/database/dist/index.js';
+
+const log = { info: console.error, warn: console.error, error: console.error }; // stderr (stdout = relatorio)
+
+const rpc = new RpcProvider(
+  [{ name: 'primary', url: process.env.SOLANA_RPC_HTTP, tier: 'primary' }],
+  { logger: log },
+);
+
+const enricher = new Enricher(
+  { getTransaction: (sig) => rpc.getTransaction(sig) },
+  {
+    bumpAttempt: (id) => incrementEnrichAttempt({ observedEvent: prisma.observedEvent }, id),
+    markEnriched: (id, d) =>
+      markEnriched({ observedEvent: prisma.observedEvent }, {
+        id,
+        direction: d.direction,
+        amountSol: d.solAmount,
+        tokenAmount: d.tokenAmount,
+        mint: d.mint,
+        counterparty: d.counterparty,
+        enrichSource: `pump-decoder-v1:${d.kind}`,
+      }),
+    markUndecodable: (id, reason) =>
+      markUndecodable({ observedEvent: prisma.observedEvent }, id, reason),
+  },
+  log,
+);
+
+const batchSize = Number(process.argv[2] ?? 50);
+const maxBatches = Number(process.argv[3] ?? 200); // default: ate 10k eventos
+const runner = new EnrichRunner(
+  {
+    findUnenriched: (limit, maxAttempts) =>
+      findUnenriched({ observedEvent: prisma.observedEvent }, { limit, maxAttempts }),
+  },
+  enricher,
+  { batchSize, maxAttempts: 5, sleepMs: 120 },
+);
+
+const started = Date.now();
+const stats = await runner.runUntilEmpty(maxBatches);
+const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
+
+const bySource = await prisma.observedEvent.groupBy({
+  by: ['enrichSource'],
+  _count: { _all: true },
+});
+const coverage = {
+  ...stats,
+  elapsedSec,
+  coveragePct:
+    stats.seen > 0 ? ((stats.enriched / stats.seen) * 100).toFixed(1) + '%' : 'n/a',
+  enrichSourceBreakdown: bySource,
+};
+process.stdout.write(JSON.stringify(coverage, null, 2) + '\n');
+await prisma.$disconnect();
diff --git a/scripts/f15-fixtures.mjs b/scripts/f15-fixtures.mjs
new file mode 100644
index 0000000..9717469
--- /dev/null
+++ b/scripts/f15-fixtures.mjs
@@ -0,0 +1,147 @@
+// scripts/f15-fixtures.mjs - GATE F1.5 (fixtures, versao re-review 2ab477f):
+// Amostra txs reais do ObservedEvent, decodifica localmente e compara 1:1 com
+// a Enhanced API da Helius INCLUINDO direction + user(feePayer) + mint.
+// Divergencias sao LISTADAS, nunca engolidas. Erros sao logados (stderr JSON).
+// Uso: node --env-file=.env scripts/f15-fixtures.mjs [n]
+import { writeFileSync } from 'node:fs';
+import { prisma } from '../packages/database/dist/index.js';
+import { decodePumpInstruction } from '../packages/pumpfun/dist/index.js';
+import { collectInstructionCalls } from '../services/data-ingestion/dist/enricher.js';
+
+const N = Number(process.argv[2] ?? 10);
+const TARGET_AMM = 2;
+const MAX_TRIES = 300;
+const HELIUS_KEY = process.env.HELIUS_API_KEY;
+const RPC = process.env.SOLANA_RPC_HTTP;
+const REPORT_PATH = 'docs/research/f15/fixtures-report.json';
+if (!HELIUS_KEY || !RPC) throw new Error('env incompleto (HELIUS_API_KEY/SOLANA_RPC_HTTP)');
+
+function logErr(context, e) {
+  process.stderr.write(
+    JSON.stringify({ level: 'error', context, error: String(e?.message ?? e) }) + '\n',
+  );
+}
+
+async function heliusEnhanced(signature) {
+  const res = await fetch(`https://api-mainnet.helius-rpc.com/v0/transactions?api-key=${HELIUS_KEY}`, {
+    method: 'POST',
+    headers: { 'content-type': 'application/json' },
+    body: JSON.stringify({ transactions: [signature] }),
+  });
+  if (!res.ok) throw new Error(`Enhanced API HTTP ${res.status}`);
+  const arr = await res.json();
+  return arr[0] ?? null;
+}
+
+async function rpcGetTransaction(signature) {
+  const res = await fetch(RPC, {
+    method: 'POST',
+    headers: { 'content-type': 'application/json' },
+    body: JSON.stringify({
+      jsonrpc: '2.0',
+      id: 1,
+      method: 'getTransaction',
+      params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 }],
+    }),
+  });
+  const j = await res.json();
+  if (j.error) throw new Error(`RPC error: ${JSON.stringify(j.error).slice(0, 200)}`);
+  return j.result ?? null;
+}
+
+/** Extrai direction do token transfer do usuario no lado "mint". */
+function heliusDirection(enhanced, user, mint) {
+  if (!enhanced || !Array.isArray(enhanced.tokenTransfers)) return null;
+  const wsol = 'So11111111111111111111111111111111111111112';
+  let inTok = 0,
+    outTok = 0,
+    outSol = 0;
+  for (const t of enhanced.tokenTransfers) {
+    if (t?.toUserAccount === user && t?.mint === mint) inTok += Number(t.tokenAmount ?? 0);
+    if (t?.fromUserAccount === user && t?.mint === mint) outTok += Number(t.tokenAmount ?? 0);
+  }
+  for (const t of enhanced.nativeTransfers ?? []) {
+    if (t?.fromUserAccount === user) outSol += Number(t.amount ?? 0);
+  }
+  if (inTok > 0) return 'buy';
+  if (outTok > 0) return 'sell';
+  void outSol;
+  return null;
+}
+
+const bigRows = await prisma.$queryRawUnsafe(
+  `SELECT signature FROM "ObservedEvent" ORDER BY random() LIMIT ${MAX_TRIES}`,
+);
+
+const results = [];
+const divergences = [];
+const probes = { decoded: 0, undecodable: 0, errors: 0 };
+let ammOk = 0,
+  i = 0;
+
+while (i < bigRows.length && (results.length < N || ammOk < TARGET_AMM)) {
+  const { signature } = bigRows[i++];
+  try {
+    const [tx, enhanced] = await Promise.all([
+      rpcGetTransaction(signature),
+      heliusEnhanced(signature),
+    ]);
+    let local = null;
+    for (const c of collectInstructionCalls(tx)) {
+      const d = decodePumpInstruction(c.programId, c.data, c.accounts);
+      if (d) {
+        local = d;
+        break;
+      }
+    }
+    if (!local) {
+      probes.undecodable++;
+      continue;
+    }
+    probes.decoded++;
+    if (local.kind.startsWith('pumpswap')) ammOk++;
+
+    const heliusDir = enhanced ? heliusDirection(enhanced, local.user, local.mint) : null;
+    const checks = {
+      typeSwap: enhanced?.type === 'SWAP' || enhanced?.type === 'SWAP_PARTIAL',
+      userEq: enhanced ? enhanced.feePayer === local.user : null,
+      directionEq: heliusDir !== null ? heliusDir === local.direction : null,
+      // mint: verificacao sobre tokenTransfers quando disponivel
+      mintPresent: enhanced?.tokenTransfers?.some((t) => t?.mint === local.mint) ?? null,
+    };
+    const mismatches = Object.entries(checks)
+      .filter(([, v]) => v === false)
+      .map(([k]) => k);
+    if (mismatches.length > 0) {
+      divergences.push({ signature, kind: local.kind, mismatches, local, heliusDir, feePayer: enhanced?.feePayer });
+    }
+    results.push({ signature, local: { ...local }, heliusDir, feePayer: enhanced?.feePayer ?? null, mismatches });
+    await new Promise((r) => setTimeout(r, 300));
+  } catch (e) {
+    probes.errors++;
+    logErr('probe', e);
+  }
+}
+
+const report = {
+  at: new Date().toISOString(),
+  sample: results.length,
+  pumpswapFixtures: ammOk,
+  pumpFixtures: results.length - ammOk,
+  perfectMatches: results.filter((r) => r.mismatches.length === 0).length,
+  divergencesCount: divergences.length,
+  probes,
+  divergences,
+  results,
+};
+writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
+process.stdout.write(
+  JSON.stringify({
+    sample: report.sample,
+    pumpswap: ammOk,
+    perfectMatches: report.perfectMatches,
+    divergences: divergences.length,
+    reportPath: REPORT_PATH,
+  }) + '\n',
+);
+await prisma.$disconnect();
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/src/enricher.test.ts
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/services/data-ingestion/src/enricher.test.ts b/services/data-ingestion/src/enricher.test.ts
new file mode 100644
index 0000000..3da4694
--- /dev/null
+++ b/services/data-ingestion/src/enricher.test.ts
@@ -0,0 +1,154 @@
+/**
+ * Testes do enricher F1.5 (ASCII-only). Base58, extracao de instrucoes
+ * (outer+inner), caminhos de erro e idempotencia ÔÇö dados hostis nunca throw.
+ */
+import { describe, it, expect, vi } from 'vitest';
+import {
+  base58ToBytes,
+  collectInstructionCalls,
+  Enricher,
+  type ParsedTx,
+  type EnrichStore,
+  type TxFetcher,
+} from './enricher.js';
+import { PUMP_BUY_ENCODER_FOR_TESTS as pumpBuyEnc, PUMP_PROGRAM_ADDRESS } from '@ct/pumpfun';
+
+const A = (c: string, n: number) => c.repeat(n);
+const MINT = A('M', 44);
+const CURVE = A('C', 44);
+const USER = A('U', 44);
+const FILLER = A('F', 32);
+const SIG = '5'.repeat(88);
+
+function base58(bytes: number[]): string {
+  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
+  let num = 0n;
+  for (const b of bytes) num = num * 256n + BigInt(b);
+  let out = '';
+  while (num > 0n) {
+    out = alphabet[Number(num % 58n)] + out;
+    num /= 58n;
+  }
+  for (const b of bytes) {
+    if (b === 0) out = '1' + out;
+    else break;
+  }
+  return out || '1';
+}
+
+/** Monta uma tx jsonParsed parcial com uma instrucao pump.buy valida. */
+function makeTxWithPumpBuy(): ParsedTx {
+  const dataBytes = new Uint8Array(
+    pumpBuyEnc().encode({ amount: 1000n, maxSolCost: 5000n, trackVolume: [false] }),
+  );
+  const accounts = Array.from({ length: 16 }, () => FILLER);
+  accounts[2] = MINT;
+  accounts[3] = CURVE;
+  accounts[6] = USER;
+  const allKeys = [PUMP_PROGRAM_ADDRESS, ...new Set(accounts)];
+  const msgKeys = allKeys.map((pubkey) => ({ pubkey }));
+  const accountIndexes = accounts.map((a) => allKeys.indexOf(a));
+  return {
+    transaction: {
+      message: {
+        accountKeys: msgKeys,
+        instructions: [
+          {
+            programId: PUMP_PROGRAM_ADDRESS,
+            accounts: accountIndexes as unknown as string[],
+            data: base58(Array.from(dataBytes)),
+          },
+        ],
+      },
+    },
+    meta: { innerInstructions: [] },
+  };
+}
+
+function fakeStore(): EnrichStore & { calls: { m: string[]; u: string[] } } {
+  const calls = { m: [] as string[], u: [] as string[] };
+  return {
+    calls,
+    async markEnriched(id) {
+      calls.m.push(id);
+    },
+    async markUndecodable(id) {
+      calls.u.push(id);
+    },
+    async bumpAttempt() {},
+  };
+}
+
+describe('base58ToBytes', () => {
+  it('round-trip com o encoder de teste', () => {
+    const raw = [1, 2, 3, 4, 5, 6, 7, 8, 200, 0, 255];
+    const s = base58(raw);
+    const back = base58ToBytes(s);
+    expect(back).toEqual(Uint8Array.from(raw));
+  });
+  it('rejeita nao-base58', () => {
+    expect(base58ToBytes('0OIl')).toBeNull();
+    expect(base58ToBytes('')).toBeNull();
+  });
+});
+
+describe('collectInstructionCalls', () => {
+  it('extrai instrucao pump.buy com programId/contas/data', () => {
+    const tx = makeTxWithPumpBuy();
+    const calls = collectInstructionCalls(tx);
+    expect(calls).toHaveLength(1);
+    expect(calls[0]!.programId).toBe(PUMP_PROGRAM_ADDRESS);
+    expect(calls[0]!.accounts[2]).toBe(MINT);
+    expect(calls[0]!.data.length).toBeGreaterThan(8);
+  });
+
+  it('tx sem message e nula', () => {
+    expect(collectInstructionCalls({} as ParsedTx)).toEqual([]);
+    expect(collectInstructionCalls(null as unknown as ParsedTx)).toEqual([]);
+  });
+
+  it('instrucao com conta fantasma e descartada (sem throw)', () => {
+    const tx = makeTxWithPumpBuy();
+    const ix = tx.transaction!.message!.instructions![0]!;
+    (ix as unknown as { accounts: number[] }).accounts = [9999, 8888]; // indices invalidos
+    expect(collectInstructionCalls(tx)).toEqual([]);
+  });
+});
+
+describe('Enricher', () => {
+  it('enriquece quando encontra pump.buy', async () => {
+    const fetcher: TxFetcher = { getTransaction: async () => makeTxWithPumpBuy() };
+    const store = fakeStore();
+    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+    const en = new Enricher(fetcher, store, log);
+    const r = await en.enrich('row1', SIG);
+    expect(r).toBe('enriched');
+    expect(store.calls.m).toEqual(['row1']);
+  });
+
+  it('marca undecodable quando nada decodifica', async () => {
+    const fetcher: TxFetcher = {
+      getTransaction: async () =>
+        ({ transaction: { message: { accountKeys: [], instructions: [] } }, meta: {} }) as ParsedTx,
+    };
+    const store = fakeStore();
+    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+    const en = new Enricher(fetcher, store, log);
+    expect(await en.enrich('row2', SIG)).toBe('undecodable');
+    expect(store.calls.u).toEqual(['row2']);
+  });
+
+  it('erro de RPC => retry (nunca marca undecodable em falha transitoria)', async () => {
+    const fetcher: TxFetcher = {
+      getTransaction: async () => {
+        throw new Error('429');
+      },
+    };
+    const store = fakeStore();
+    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+    const en = new Enricher(fetcher, store, log);
+    expect(await en.enrich('row3', SIG)).toBe('retry');
+    expect(store.calls.u).toEqual([]);
+    expect(store.calls.m).toEqual([]);
+  });
+});
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa -- services/data-ingestion/src/instance-lock.test.ts 
services/data-ingestion/src/retention.test.ts
commit 38cf505ee228a35eb4dba6fae1e301e8feaeacfa
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:18:39 2026 -0300

    feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
    
    - services/data-ingestion: enricher.ts (outer+inner ix decode), enrich-runner.ts (batch+rate-limit), index.ts 
wiring
    - retention.ts: opt-in via RETENTION_RAW_ENABLED (ADR-024 ÔÇö purge nunca default-on)
    - instance-lock.ts: staleness por timestamp (PID reusado); alias ADR-014->ADR-024 nos comentarios
    - scripts/f15-fixtures.mjs: match rigoroso (direction/mint/user), divergencias listadas, relatorio sem BOM em 
docs/research/f15/
    - scripts/f15-backfill.mjs: one-shot 10k com cobertura
    - docs: roadmap F1.5 com evidencias, handoff, ADR-025 (fatos runtime), artifacts de gate
    
    Resolve: reviews 5299d25*, dddb30b1/c438ef1c (re-review com gates no ambiente certo), 2ab477f MEDIUM fixtures.

diff --git a/services/data-ingestion/src/instance-lock.test.ts b/services/data-ingestion/src/instance-lock.test.ts
new file mode 100644
index 0000000..f6ec527
--- /dev/null
+++ b/services/data-ingestion/src/instance-lock.test.ts
@@ -0,0 +1,96 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
+import { spawn } from 'node:child_process';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { InstanceLock, isProcessAlive } from './instance-lock.js';
+
+let dir: string;
+let lockPath: string;
+
+beforeEach(() => {
+  dir = mkdtempSync(join(tmpdir(), 'ct-lock-'));
+  lockPath = join(dir, 'test.lock');
+});
+afterEach(() => {
+  rmSync(dir, { recursive: true, force: true });
+});
+
+describe('InstanceLock', () => {
+  it('adquire e libera o lock', () => {
+    const lock = new InstanceLock(lockPath);
+    lock.acquire();
+    expect(existsSync(lockPath)).toBe(true);
+    lock.release();
+    expect(existsSync(lockPath)).toBe(false);
+  });
+
+  it('rejeita segunda aquisi├º├úo quando o PID do lock est├í vivo', () => {
+    // Spawna um processo real e vivo para garantir o caminho de rejei├º├úo.
+    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
+      detached: true,
+      stdio: 'ignore',
+    });
+    try {
+      child.unref();
+      expect(child.pid).toBeDefined();
+      writeFileSync(lockPath, `${child.pid}\n`);
+      const lock = new InstanceLock(lockPath);
+      expect(() => lock.acquire()).toThrowError(/CONFIG_ERROR/);
+    } finally {
+      if (child.pid) {
+        try {
+          process.kill(child.pid);
+        } catch {
+          /* processo j├í morto ÔÇö ok no teardown */
+        }
+      }
+    }
+  });
+
+  it('lock stale (PID morto) ├® substitu├¡do', () => {
+    // 4194303 ├® quase certamente inexistente
+    writeFileSync(lockPath, '4194303\n');
+    const lock = new InstanceLock(lockPath);
+    lock.acquire();
+    expect(existsSync(lockPath)).toBe(true);
+    lock.release();
+  });
+
+  it('lock velho (timestamp ultrapassado) ├® tratado como stale', () => {
+    const stale = Date.now() - 25 * 3_600_000; // 25h atras
+    writeFileSync(lockPath, `${process.ppid || process.pid}\n${stale}\n`);
+    // Mesmo que o PID do lock esteja "vivo" (ppid), a idade > 24h vence => substitui.
+    const lock = new InstanceLock(lockPath);
+    // ppid vivo + lock VELHO => stale, substitui (caminho da idade vence PID).
+    lock.acquire();
+    expect(existsSync(lockPath)).toBe(true);
+    lock.release();
+  });
+
+  it('lock recente com PID vivo rejeita (nao stale)');
+
+  it('lock corrompido (n├úo-n├║mero) ├® substitu├¡do', () => {
+    writeFileSync(lockPath, 'garbage\n');
+    const lock = new InstanceLock(lockPath);
+    lock.acquire();
+    lock.release();
+  });
+
+  it('release n├úo remove lock de outro PID (seguran├ºa contra corrida)', () => {
+    const lock = new InstanceLock(lockPath);
+    lock.acquire();
+    writeFileSync(lockPath, '99999\n'); // outro processo "roubou" o lock
+    lock.release();
+    expect(existsSync(lockPath)).toBe(true);
+  });
+});
+
+describe('isProcessAlive', () => {
+  it('nosso pr├│prio PID est├í vivo', () => {
+    expect(isProcessAlive(process.pid)).toBe(true);
+  });
+  it('PID inexistente est├í morto', () => {
+    expect(isProcessAlive(4_194_303)).toBe(false);
+  });
+});
diff --git a/services/data-ingestion/src/retention.test.ts b/services/data-ingestion/src/retention.test.ts
new file mode 100644
index 0000000..6126619
--- /dev/null
+++ b/services/data-ingestion/src/retention.test.ts
@@ -0,0 +1,81 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { RetentionJob, type RetentionRepo } from './retention.js';
+
+const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+
+function makeRepo(initial: Array<{ receivedAt: Date }>) {
+  const rows = [...initial];
+  const repo: RetentionRepo = {
+    async deleteMany({ where }) {
+      const before = rows.length;
+      for (let i = rows.length - 1; i >= 0; i--) {
+        if (rows[i]!.receivedAt < where.receivedAt.lt) rows.splice(i, 1);
+      }
+      return { count: before - rows.length };
+    },
+  };
+  return { repo, rows };
+}
+
+describe('RetentionJob', () => {
+  beforeEach(() => {
+    vi.useFakeTimers();
+    vi.setSystemTime(new Date('2026-09-22T20:00:00Z'));
+  });
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it('remove apenas registros mais antigos que o cutoff', async () => {
+    const { repo, rows } = makeRepo([
+      { receivedAt: new Date('2026-09-22T19:00:00Z') }, // recente: mant├®m
+      { receivedAt: new Date('2026-09-15T00:00:00Z') }, // antigo: remove
+      { receivedAt: new Date('2026-09-10T00:00:00Z') }, // antigo: remove
+    ]);
+    const job = new RetentionJob(repo, silentLogger, 3);
+    const deleted = await job.runOnce();
+    expect(deleted).toBe(2);
+    expect(rows).toHaveLength(1);
+  });
+
+  it('retentionDays <= 0 desliga com warn, sem timer', () => {
+    const { repo } = makeRepo([]);
+    const job = new RetentionJob(repo, silentLogger, 0, 3_600_000, true);
+    job.start();
+    expect(silentLogger.warn).toHaveBeenCalledOnce();
+    job.stop();
+  });
+
+  it('default ├® DESLIGADO (ADR-024: purge de RAW nunca default-on)', () => {
+    const { repo } = makeRepo([]);
+    // Sem o 5o argumento (enabled) ÔåÆ desligado.
+    const job = new RetentionJob(repo, silentLogger, 3, 1_000);
+    job.start();
+    expect(silentLogger.info).toHaveBeenCalledWith(expect.stringContaining('DESLIGADA'));
+    job.stop();
+  });
+
+  it('erros do repo viram DATABASE_ERROR sem crash', async () => {
+    const repo: RetentionRepo = {
+      async deleteMany() {
+        throw new Error('db down');
+      },
+    };
+    const job = new RetentionJob(repo, silentLogger, 3);
+    const deleted = await job.runOnce();
+    expect(deleted).toBe(0);
+    expect(silentLogger.error).toHaveBeenCalledOnce();
+  });
+
+  it('n├úo executa passadas sobrepostas', async () => {
+    let resolveBlock!: () => void;
+    const blocker = new Promise<{ count: number }>((res) => (resolveBlock = () => res({ count: 0 })));
+    const repo: RetentionRepo = { deleteMany: () => blocker };
+    const job = new RetentionJob(repo, silentLogger, 3);
+    const p1 = job.runOnce(); // fica pendente
+    const p2 = await job.runOnce(); // deve retornar 0 imediatamente
+    expect(p2).toBe(0);
+    resolveBlock();
+    await p1;
+  });
+});
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/index.ts
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
[0m$ [0mgit status; git branch --show-current; git log --oneline -3
On branch master
Your branch is ahead of 'origin/master' by 12 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
master
3838e2f review(sprint/f1-5-enrichment): REJEITADO 20d93cfec10044434fc0a1966d5093e1da427b05
b5bb013 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 3d6c9db383b0f064b92cc1321171854b0a36b2fe
b2a2048 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 7d7e3d129fb025dadbf3e48478297be86d18850d
[0m
[0m$ [0mgit ls-tree -r 38cf505ee228a35eb4dba6fae1e301e8feaeacfa --name-only | Select-String -Pattern 
"packages/(pumpfun|solana|database)" | Select-Object -First 60
packages/database/package.json
packages/database/prisma/migrations/000000000000_init/migration.sql
packages/database/prisma/migrations/20260924142844_f15_enrichment/migration.sql
packages/database/prisma/migrations/migration_lock.toml
packages/database/prisma/schema.prisma
packages/database/src/index.ts
packages/database/src/repositories/audit-log.test.ts
packages/database/src/repositories/audit-log.ts
packages/database/src/repositories/errors.ts
packages/database/src/repositories/observed-events.enrich.test.ts
packages/database/src/repositories/observed-events.test.ts
packages/database/src/repositories/observed-events.ts
packages/database/src/repositories/system-events.test.ts
packages/database/src/repositories/system-events.ts
packages/database/tsconfig.json
packages/pumpfun/codama.pump.mjs
packages/pumpfun/idl/pump.json
packages/pumpfun/idl/pump_amm.json
packages/pumpfun/package.json
packages/pumpfun/scripts/fix-esm-imports.mjs
packages/pumpfun/src/decode.test.ts
packages/pumpfun/src/decode.ts
packages/pumpfun/src/generated/pump/accounts/bondingCurve.ts
packages/pumpfun/src/generated/pump/accounts/feeConfig.ts
packages/pumpfun/src/generated/pump/accounts/global.ts
packages/pumpfun/src/generated/pump/accounts/globalVolumeAccumulator.ts
packages/pumpfun/src/generated/pump/accounts/index.ts
packages/pumpfun/src/generated/pump/accounts/quoteControl.ts
packages/pumpfun/src/generated/pump/accounts/sharingConfig.ts
packages/pumpfun/src/generated/pump/accounts/userVolumeAccumulator.ts
packages/pumpfun/src/generated/pump/errors/index.ts
packages/pumpfun/src/generated/pump/errors/pump.ts
packages/pumpfun/src/generated/pump/events/addQuoteControlMintEvent.ts
packages/pumpfun/src/generated/pump/events/adminCtoEvent.ts
packages/pumpfun/src/generated/pump/events/adminSetIdlAuthorityEvent.ts
packages/pumpfun/src/generated/pump/events/adminUpdateTokenIncentivesEvent.ts
packages/pumpfun/src/generated/pump/events/claimCashbackEvent.ts
packages/pumpfun/src/generated/pump/events/claimTokenIncentivesEvent.ts
packages/pumpfun/src/generated/pump/events/closeUserVolumeAccumulatorEvent.ts
packages/pumpfun/src/generated/pump/events/collectCreatorFeeEvent.ts
packages/pumpfun/src/generated/pump/events/completeEvent.ts
packages/pumpfun/src/generated/pump/events/completePumpAmmMigrationEvent.ts
packages/pumpfun/src/generated/pump/events/createEvent.ts
packages/pumpfun/src/generated/pump/events/distributeCreatorFeesEvent.ts
packages/pumpfun/src/generated/pump/events/distributeFeeToHoldersEvent.ts
packages/pumpfun/src/generated/pump/events/extendAccountEvent.ts
packages/pumpfun/src/generated/pump/events/index.ts
packages/pumpfun/src/generated/pump/events/initUserVolumeAccumulatorEvent.ts
packages/pumpfun/src/generated/pump/events/migrateBondingCurveCreatorEvent.ts
packages/pumpfun/src/generated/pump/events/minimumDistributableFeeEvent.ts
packages/pumpfun/src/generated/pump/events/removeQuoteControlMintEvent.ts
packages/pumpfun/src/generated/pump/events/reservedFeeRecipientsEvent.ts
packages/pumpfun/src/generated/pump/events/setCreatorEvent.ts
packages/pumpfun/src/generated/pump/events/setMetaplexCreatorEvent.ts
packages/pumpfun/src/generated/pump/events/setParamsEvent.ts
packages/pumpfun/src/generated/pump/events/setQuoteControlAdminEvent.ts
packages/pumpfun/src/generated/pump/events/syncUserVolumeAccumulatorEvent.ts
packages/pumpfun/src/generated/pump/events/tradeEvent.ts
packages/pumpfun/src/generated/pump/events/updateCreatorFeeConfigEvent.ts
packages/pumpfun/src/generated/pump/events/updateGlobalAuthorityEvent.ts
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/database/src/repositories/observed-events.ts
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
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/src/decode.ts
/**
 * decode.ts ÔÇö decoder F1.5 sobre os clientes gerados por codama a partir da
 * IDL oficial pump-fun/pump-public-docs (ADR-016: fonte oficial; ADR-020:
 * codama em vez de discriminadores ├á m├úo).
 *
 * Regras (dados on-chain hostis):
 * - NUNCA lan├ºa exce├º├úo em input adversarial ÔÇö retorna null.
 * - Endere├ºos validados com allowlist base58 (RT-004/006 mantidos fechados).
 * - Valores num├®ricos da instru├º├úo s├úo PAR├éMETROS/LIMITES da instru├º├úo
 *   (amount = tokens; em buy, sol = maxSolCost/maxQuoteAmountIn; em sell,
 *   sol = minSolOutput/minQuoteAmountOut) ÔÇö N├âO s├úo valores realizados.
 *   Valores realizados v├¬m de balance changes (fora do escopo deste decoder).
 */
import { z } from 'zod';
import {
  BUY_DISCRIMINATOR as PUMP_BUY,
  SELL_DISCRIMINATOR as PUMP_SELL,
  getBuyInstructionDataDecoder as pumpBuyDecoder,
  getSellInstructionDataDecoder as pumpSellDecoder,
} from './generated/pump/instructions/index.js';
import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
import {
  BUY_DISCRIMINATOR as AMM_BUY,
  SELL_DISCRIMINATOR as AMM_SELL,
  getBuyInstructionDataDecoder as ammBuyDecoder,
  getSellInstructionDataDecoder as ammSellDecoder,
} from './generated/pump_amm/instructions/index.js';
import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const addressSchema = z.string().regex(BASE58);

export interface DecodedSwap {
  kind: 'pump_buy' | 'pump_sell' | 'pumpswap_buy' | 'pumpswap_sell';
  direction: 'buy' | 'sell';
  mint: string;
  user: string;
  /** Bonding curve (pump.*) ou pool AMM (pumpswap.*). */
  counterparty: string;
  /** Tokens em unidades base (instru├º├úo `amount`/`baseAmount*`). */
  tokenAmount: string | null;
  /** SOL em lamports ÔÇö LIMITE da instru├º├úo (maxSolCost / minSolOutput etc.), n├úo realizado. */
  solAmount: string | null;
}

function discEq(data: ArrayLike<number>, disc: ArrayLike<number>): boolean {
  if (data.length < 8 || disc.length < 8) return false;
  for (let i = 0; i < 8; i++) if (data[i] !== disc[i]) return false;
  return true;
}

function validAddr(a: unknown): a is string {
  return typeof a === 'string' && addressSchema.safeParse(a).success;
}

/** Contas m├¡nimas esperadas: pump.buy/sell = 16; pump_amm.buy/sell = 22. */
const PUMP_MIN_ACCOUNTS = 16;
const AMM_MIN_ACCOUNTS = 22;

export function decodePumpInstruction(
  programId: string,
  data: ArrayLike<number>,
  accounts: string[],
): DecodedSwap | null {
  try {
    // Normaliza para Uint8Array: os decoders do codama exigem Uint8Array.
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(Array.from(data));
    if (programId === PUMP_PROGRAM_ADDRESS) {
      if (accounts.length < PUMP_MIN_ACCOUNTS) return null;
      // IDL: mint=2, bondingCurve=3, user=6
      const mint = accounts[2];
      const counterparty = accounts[3];
      const user = accounts[6];
      if (!validAddr(mint) || !validAddr(counterparty) || !validAddr(user)) return null;

      if (discEq(bytes, PUMP_BUY)) {
        const d = pumpBuyDecoder().decode(bytes);
        return {
          kind: 'pump_buy',
          direction: 'buy',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.maxSolCost.toString(),
        };
      }
      if (discEq(bytes, PUMP_SELL)) {
        const d = pumpSellDecoder().decode(bytes);
        return {
          kind: 'pump_sell',
          direction: 'sell',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.minSolOutput.toString(),
        };
      }
      return null;
    }

    if (programId === PUMP_AMM_PROGRAM_ADDRESS) {
      if (accounts.length < AMM_MIN_ACCOUNTS) return null;
      // IDL: pool=0, user=1, baseMint=3, quoteMint=4
      const counterparty = accounts[0];
      const user = accounts[1];
      const baseMint = accounts[3];
      const quoteMint = accounts[4];
      if (!validAddr(baseMint) || !validAddr(quoteMint) || !validAddr(counterparty) || !validAddr(user)) return null;

      const WSOL = 'So11111111111111111111111111111111111111112';
      // Normaliza├º├úo pelo lado do TOKEN (review 2ab477f/fixtures): se a base
      // do pool for wSOL, a sem├óntica buy/sell da instru├º├úo se inverte do ponto
      // de vista do token (usu├írio d├í wSOL e recebe token => buy do token).
      const quoteIsWsol = quoteMint === WSOL;
      const baseIsWsol = baseMint === WSOL;
      const tokenMint = quoteIsWsol ? baseMint! : baseIsWsol ? quoteMint! : baseMint!;

      const mapDirection = (ix: 'buy' | 'sell'): 'buy' | 'sell' => {
        if (baseIsWsol) return ix === 'buy' ? 'sell' : 'buy'; // invertido
        return ix;
      };
      const mapKind = (ix: 'buy' | 'sell'): DecodedSwap['kind'] =>
        mapDirection(ix) === 'buy' ? 'pumpswap_buy' : 'pumpswap_sell';

      if (discEq(bytes, AMM_BUY)) {
        const d = ammBuyDecoder().decode(bytes);
        // quoteIn = wSOL gasto (se quote=wSOL); token = baseAmountOut.
        return {
          kind: mapKind('buy'),
          direction: mapDirection('buy'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountOut.toString() : null,
          solAmount: quoteIsWsol ? d.maxQuoteAmountIn.toString() : d.baseAmountOut.toString(),
        };
      }
      if (discEq(bytes, AMM_SELL)) {
        const d = ammSellDecoder().decode(bytes);
        // baseIn = token vendido (se quote=wSOL); quoteOut = wSOL recebido.
        return {
          kind: mapKind('sell'),
          direction: mapDirection('sell'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountIn.toString() : null,
          solAmount: quoteIsWsol ? d.minQuoteAmountOut.toString() : d.baseAmountIn.toString(),
        };
      }
      return null;
    }

    return null; // programa desconhecido ÔÇö UNKNOWN, nunca inferido
  } catch {
    // Dados hostis/truncados: decode falhou ÔÇö null, nunca throw.
    return null;
  }
}
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/solana/src/rpc-provider.ts 2>$null; git ls-tree 
-r 38cf505ee228a35eb4dba6fae1e301e8feaeacfa --name-only packages/solana/src
/**
 * RpcProvider ÔÇö client concreto de JSON-RPC da Solana (API p├║blica padr├úo,
 * documentada em https://solana.com/docs/rpc/http) via fetch nativo (Node 20).
 *
 * FACT: endpoints suportados s├úo JSON-RPC HTTP(S) gen├®ricos ÔÇö nenhum endpoint
 * propriet├írio ├® assumido. Funciona com RPC p├║blico, Helius
 * (https://mainnet.helius-rpc.com) ou qualquer RPC compat├¡vel.
 *
 * - Failover autom├ítico primary ÔåÆ secondary ÔåÆ tertiary ap├│s N falhas
 *   consecutivas (configur├ível, default 3); cada transi├º├úo dispara onFailover.
 * - Retry por requisi├º├úo com backoff exponencial + jitter (cap 30s).
 * - Timeout por requisi├º├úo (default 10s) via AbortController.
 * - Nenhuma l├│gica de trading; erros classificados com ErrorClass.
 */

import type { ErrorClass } from '@ct/types';
import { ExponentialBackoff, sleep } from './backoff.js';

/** Interface m├¡nima de logger (compat├¡vel estruturalmente com @ct/logging). */
export interface LoggerLike {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export class ClassifiedError extends Error {
  constructor(
    readonly errorClass: ErrorClass,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ClassifiedError';
  }
}

export type RpcHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface RpcEndpoint {
  name: string;
  url: string;
  tier: 'primary' | 'secondary' | 'tertiary';
}

export interface RpcFailoverEvent {
  fromTier: RpcEndpoint['tier'];
  toTier: RpcEndpoint['tier'];
  reason: string;
  at: Date;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  err: unknown;
  memo: string | null;
  blockTime: number | null;
}

export interface SignaturePage {
  signatures: SignatureInfo[];
  /** Assinatura mais antiga da p├ígina ÔÇö usar como `before` na pr├│xima chamada. */
  oldestSignature: string | null;
  /** true se provavelmente h├í mais p├íginas (p├ígina retornou cheia). */
  hasMore: boolean;
}

export interface GetSignaturesOptions {
  limit?: number;
  before?: string;
  until?: string;
}

export interface RpcProviderOptions {
  logger: LoggerLike;
  /** Falhas consecutivas antes de failover. Default 3. */
  failoverThreshold?: number;
  /** Timeout por requisi├º├úo HTTP em ms. Default 10_000. */
  requestTimeoutMs?: number;
  /** Tentativas totais m├íximas por chamada (incluindo failovers). Default 6. */
  maxAttempts?: number;
  /** Overrides de backoff (testes). */
  backoff?: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: () => number };
  /** fetch injet├ível (testes). Default: globalThis.fetch. */
  fetchFn?: typeof fetch;
}

interface JsonRpcErrorPayload {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: JsonRpcErrorPayload;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_FAILOVER_THRESHOLD = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

export class RpcProvider {
  private readonly endpoints: RpcEndpoint[];
  private readonly logger: LoggerLike;
  private readonly failoverThreshold: number;
  private readonly requestTimeoutMs: number;
  private readonly maxAttempts: number;
  private readonly backoffOpts: RpcProviderOptions['backoff'];
  private readonly fetchFn: typeof fetch;
  private readonly failoverListeners: Array<(e: RpcFailoverEvent) => void> = [];
  private activeIndex = 0;
  private consecutiveFailures = 0;
  private requestId = 0;

  constructor(endpoints: RpcEndpoint[], options: RpcProviderOptions) {
    if (endpoints.length === 0) {
      throw new ClassifiedError('CONFIG_ERROR', 'ao menos um RpcEndpoint ├® obrigat├│rio');
    }
    // Ordem determin├¡stica por tier, preservando ordem relativa dentro do tier.
    const tierOrder: Record<RpcEndpoint['tier'], number> = {
      primary: 0,
      secondary: 1,
      tertiary: 2,
    };
    this.endpoints = [...endpoints].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
    this.logger = options.logger;
    this.failoverThreshold = options.failoverThreshold ?? DEFAULT_FAILOVER_THRESHOLD;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.backoffOpts = options.backoff;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    if (typeof this.fetchFn !== 'function') {
      throw new ClassifiedError('CONFIG_ERROR', 'fetch n├úo dispon├¡vel (Node >= 20 requerido)');
    }
  }

  onFailover(cb: (event: RpcFailoverEvent) => void): void {
    this.failoverListeners.push(cb);
  }

  getActiveEndpoint(): Promise<RpcEndpoint> {
    const endpoint = this.endpoints[this.activeIndex];
    if (!endpoint) {
      throw new ClassifiedError('CONFIG_ERROR', 'nenhum endpoint ativo dispon├¡vel');
    }
    return Promise.resolve(endpoint);
  }

  async getHealth(endpoint: RpcEndpoint): Promise<RpcHealth> {
    try {
      await this.rawCall<unknown>(endpoint, 'getHealth', []);
      return 'healthy';
    } catch (err) {
      this.logger.warn('rpc getHealth falhou', {
        endpoint: endpoint.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'down';
    }
  }

  /** getSlot ÔÇö FACT: m├®todo padr├úo do JSON-RPC Solana. */
  async getSlot(commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'): Promise<number> {
    return this.call<number>('getSlot', [{ commitment }]);
  }

  /**
   * getSignaturesForAddress com pagina├º├úo autom├ítica (`before`).
   * Retorna at├® `limit` assinaturas (default 1000, m├íximo da API por p├ígina).
   */
  async getSignaturesForAddress(
    address: string,
    options: GetSignaturesOptions = {},
  ): Promise<SignatureInfo[]> {
    const pageLimit = Math.min(options.limit ?? 1000, 1000);
    const out: SignatureInfo[] = [];
    let before = options.before;
    for (;;) {
      const page = await this.getSignaturesPage(address, {
        limit: pageLimit,
        ...(before !== undefined ? { before } : {}),
        ...(options.until !== undefined ? { until: options.until } : {}),
      });
      out.push(...page.signatures);
      if (!page.hasMore || page.oldestSignature === null) break;
      if (options.limit !== undefined && out.length >= options.limit) break;
      before = page.oldestSignature;
    }
    return options.limit !== undefined ? out.slice(0, options.limit) : out;
  }

  /** Uma p├ígina de getSignaturesForAddress (sem auto-pagina├º├úo). */
  async getSignaturesPage(address: string, options: GetSignaturesOptions = {}): Promise<SignaturePage> {
    const params: Record<string, unknown> = { limit: options.limit ?? 1000 };
    if (options.before !== undefined) params['before'] = options.before;
    if (options.until !== undefined) params['until'] = options.until;
    const raw = await this.call<RawSignatureInfo[]>('getSignaturesForAddress', [address, params]);
    const signatures = raw.map((s) => ({
      signature: String(s.signature),
      slot: Number(s.slot),
      err: s.err ?? null,
      memo: s.memo ?? null,
      blockTime: typeof s.blockTime === 'number' ? s.blockTime : null,
    }));
    const oldest = signatures.length > 0 ? signatures[signatures.length - 1]!.signature : null;
    return {
      signatures,
      oldestSignature: oldest,
      hasMore: signatures.length >= (options.limit ?? 1000),
    };
  }

  /**
   * getTransaction com encoding jsonParsed e maxSupportedTransactionVersion: 1
   * (FACT 2026-09-24: versao 1 introduzida pelo runtime; 0 insuficiente). Requerido para transa├º├Áes versionadas/v0 
com address lookup tables).
   */
  async getTransaction(signature: string): Promise<unknown | null> {
    return this.call<unknown | null>('getTransaction', [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 },
    ]);
  }

  /**
   * N├║cleo: tenta a chamada no endpoint ativo; ap├│s `failoverThreshold`
   * falhas consecutivas, faz failover para o pr├│ximo endpoint e continua.
   * Espera total m├íxima: `maxAttempts` tentativas com backoff entre elas.
   */
  async call<T>(method: string, params: unknown[]): Promise<T> {
    const backoff = new ExponentialBackoff(this.backoffOpts);
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const endpoint = this.endpoints[this.activeIndex];
      if (!endpoint) throw new ClassifiedError('CONFIG_ERROR', 'nenhum endpoint configurado');
      try {
        const result = await this.rawCall<T>(endpoint, method, params);
        this.recordSuccess();
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure(endpoint, method, err);
        const delay = backoff.nextDelay();
        await sleep(delay).catch(() => undefined);
      }
    }
    throw new ClassifiedError(
      'RPC_ERROR',
      `rpc ${method} esgotou ${this.maxAttempts} tentativas`,
      lastError,
    );
  }

  private async rawCall<T>(endpoint: RpcEndpoint, method: string, params: unknown[]): Promise<T> {
    const id = ++this.requestId;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(endpoint.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ClassifiedError('RPC_ERROR', `rpc ${method} falha de rede/timeout`, err);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new ClassifiedError('RPC_ERROR', `rpc ${method} HTTP ${response.status}`);
    }
    let payload: JsonRpcResponse<T>;
    try {
      payload = (await response.json()) as JsonRpcResponse<T>;
    } catch (err) {
      throw new ClassifiedError('DATA_ERROR', `rpc ${method} resposta n├úo-JSON`, err);
    }
    if (payload.error) {
      throw new ClassifiedError(
        'RPC_ERROR',
        `rpc ${method} erro ${payload.error.code}: ${payload.error.message}`,
      );
    }
    return payload.result as T;
  }

  private recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.logger.debug('rpc endpoint recuperado', {
        endpoint: this.endpoints[this.activeIndex]?.name,
      });
    }
    this.consecutiveFailures = 0;
  }

  private recordFailure(endpoint: RpcEndpoint, method: string, err: unknown): void {
    this.consecutiveFailures += 1;
    this.logger.warn('rpc chamada falhou', {
      endpoint: endpoint.name,
      method,
      consecutiveFailures: this.consecutiveFailures,
      error: err instanceof Error ? err.message : String(err),
    });
    if (this.consecutiveFailures >= this.failoverThreshold) {
      this.failover(`falhas consecutivas >= ${this.failoverThreshold} em ${endpoint.name}`);
    }
  }

  private failover(reason: string): void {
    const from = this.endpoints[this.activeIndex];
    if (!from) return;
    const nextIndex = (this.activeIndex + 1) % this.endpoints.length;
    const to = this.endpoints[nextIndex];
    if (!to || nextIndex === this.activeIndex) {
      // ├Ünico endpoint: n├úo h├í para onde falhar; reseta contador para retry puro.
      this.consecutiveFailures = 0;
      return;
    }
    this.activeIndex = nextIndex;
    this.consecutiveFailures = 0;
    const event: RpcFailoverEvent = {
      fromTier: from.tier,
      toTier: to.tier,
      reason,
      at: new Date(),
    };
    this.logger.warn('rpc failover', {
      from: from.name,
      to: to.name,
      reason,
    });
    for (const cb of this.failoverListeners) {
      try {
        cb(event);
      } catch (err) {
        this.logger.error('listener onFailover lan├ºou exce├º├úo', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

interface RawSignatureInfo {
  signature: string;
  slot: number;
  err?: unknown;
  memo?: string | null;
  blockTime?: number | null;
}
packages/solana/src/backoff.test.ts
packages/solana/src/backoff.ts
packages/solana/src/chain-event.ts
packages/solana/src/helius-provider.test.ts
packages/solana/src/helius-provider.ts
packages/solana/src/index.ts
packages/solana/src/rpc-provider.test.ts
packages/solana/src/rpc-provider.ts
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/backfill-report.json; git show 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/README.md; git show 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/fixtures-report.json | Select-Object -First 80
{
  "seen": 10000,
  "enriched": 1914,
  "undecodable": 8086,
  "retried": 0,
  "elapsedSec": "4139.2",
  "coveragePct": "19.1%",
  "enrichSourceBreakdown": [
    {
      "_count": {
        "_all": 675
      },
      "enrichSource": "pump-decoder-v1:pump_buy"
    },
    {
      "_count": {
        "_all": 1580
      },
      "enrichSource": "pump-decoder-v1:pump_sell"
    },
    {
      "_count": {
        "_all": 10
      },
      "enrichSource": "pump-decoder-v1:pumpswap_sell"
    },
    {
      "_count": {
        "_all": 8250
      },
      "enrichSource": "undecodable:no-decodable-instruction"
    },
    {
      "_count": {
        "_all": 1923605
      },
      "enrichSource": null
    }
  ]
}
# F1.5 ÔÇö Evid├¬ncias do gate (enrichment)

## Fixtures (validacao 1:1 vs Helius Enhanced) ÔÇö RE-REVIEW 2026-09-25

- Rodada inicial (prematura): 16/16 por criterio raso (apenas `helius.type === SWAP`) ÔÇö **rejeitado** em 
`docs/reviews/2ab477f7*` (MEDIUM-2: ignora user/mint/direction/amounts).
- Rodada rigorosa: comparacao 1:1 com direction(=token-side), user==feePayer, mint em tokenTransfers. **Resultado:** 
sample=10, pumpswap=9, perfectMatches=5, divergences=5 (listadas no JSON).
  - Bug REAL encontrado e corrigido: pool PumpSwap com **base=wSOL** inverte a semantica buy/sell (direction muta pelo 
lado do token) ÔÇö fix em `decode.ts` + fixture real `62uhRP3sÔÇª` era pump_buy-de-wSOL exibido como sell pelo Helius.
  - Divergencias restantes = **classes semanticas**, nao erro de decode: `mintPresent` (Enhanced nem sempre lista mint 
do lado wSOL em tokenTransfers; heliusDir=null quando indeterminavel) e `directionEq` ocasional em multi-hop. 
Documentado, nunca engolido ÔÇö o JSON lista cada divergencia com campos.
- `fixtures-report.json` reescrito sem BOM em `docs/research/f15/`.

> ASSUMPTION documentada: eventos da subscricao da curva Pump.fun incluem muitos
> transfers/SYSTEM_PROGRAM que NAO sao swaps ÔÇö decodificar = UNKNOWN explicito
> e correto. A taxa de cobertura do backfill (abaixo) e consistente com isso.

## Backfill (one-shot, 10k eventos)

- `backfill-report.json`: seen=10000, enriched=1914 (**cobertura 19.1%** do lote),
  undecodable=8086 (transfers/creates/migrations sem instrucao de swap), retried=0, elapsedSec=4139.
- Breakdown: pump_buy=675, pump_sell=1580, pumpswap_sell=10 (ultimas medidas do lote).

## Bugs descobertos/validados no caminho (todos FIXED)

1. Endpoint Enhanced: `api.helius.dev` nao resolve no DNS local; use
   `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem barra antes de `?`).
2. getTransaction: transacoes podem ser `version: 1` ÔÇö `maxSupportedTransactionVersion: 1`.
3. Helius free: `logsSubscribe` aceita 1 endereco por subscription ÔÇö provider faz 1 sub/endereco.
4. Codama: `accept(renderVisitor)` e async ÔÇö script aguarda ambos antes de achatar; clientes gerados
   ficam com `@ts-nocheck` (postprocess documentado em `packages/pumpfun/codama.pump.mjs`).
{
  "at": "2026-09-25T04:01:22.876Z",
  "sample": 10,
  "pumpswapFixtures": 9,
  "pumpFixtures": 1,
  "perfectMatches": 5,
  "divergencesCount": 5,
  "probes": {
    "decoded": 10,
    "undecodable": 45,
    "errors": 58
  },
  "divergences": [
    {
      "signature": "18gsjP9rGMfZfEtspzW3wo217qfCMLMurP1RKwoiawzozugUnA3E1Mv2LCmKwfyjcy2C5CXCfwjXCLNJrNUY36s",
      "kind": "pumpswap_sell",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "44xtWfqJHffGtQCDPVsrNSUQsZHqEuMc4ktNowgVpump",
        "user": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw",
        "counterparty": "GsTVhFUwk6hwH9PaQipLna9KsXfu4h8ENUsCpB8wdtHG",
        "tokenAmount": "414750041004",
        "solAmount": "727895025"
      },
      "heliusDir": null,
      "feePayer": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw"
    },
    {
      "signature": "tg3pusCqXV29Pop4pCybRKVoUWJoYXqCYoiUAdstCtazFLSVBTNh4fytii9MLBwmGgjLCTpY7org9QDSPAimzJY",
      "kind": "pumpswap_sell",
      "mismatches": [
        "directionEq"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        "user": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS",
        "counterparty": "2uF4Xh61rDwxnG9woyxsVQP7zuA6kLFpb3NvnRQeoiSd",
        "tokenAmount": null,
        "solAmount": "21529728095"
      },
      "heliusDir": "buy",
      "feePayer": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS"
    },
    {
      "signature": "3ipBKg9Hf5oemkQc2Ftm7zBiCxkjhxZ9YW61Bgu491KYQCeFmotzzkThnK23EmGWFCw5NB2Gb7shyE2u6fqpuhs6",
      "kind": "pumpswap_sell",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "379246310276",
        "solAmount": "1040652818"
      },
      "heliusDir": null,
      "feePayer": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT"
    },
    {
      "signature": "5sCEF7pq4YpiVJBNDXe1G9zQv5PfszLRvg1V95t5UiRsBLLKgc2JK68ojnRToz9VD4F1Dx1xwPqfkc7PK5ViLcPT",
      "kind": "pumpswap_buy",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "41n8gyoVAuDjZdUeHRGrPscG2DzJawDHpa1Y6VLV4VqJ",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "536446568993",
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/src/index.ts; git show 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/architecture/adr/ADR-025-fatos-runtime-f15-decoder-enrichment.md 
2>$null; git ls-tree -r 38cf505ee228a35eb4dba6fae1e301e8feaeacfa --name-only docs/architecture
/**
 * @ct/pumpfun ÔÇö decoder oficial pump.fun / PumpSwap (F1.5).
 *
 * Fontes (ADR-016): IDL oficial pump-fun/pump-public-docs @ 81091419
 * (idl/pump.json, idl/pump_amm.json ÔÇö vendored em ./idl).
 * Gera├º├úo (ADR-020): codama ÔåÆ src/generated/ (versionado, verificado por fixtures).
 */
export { PUMPFUN_DOC_SOURCE, PUMPFUN_IDL_SOURCE, PUMPFUN_IDL_SHA } from './sources.js';
export { decodePumpInstruction, type DecodedSwap } from './decode.js';

// Re-exports m├¡nimos para testes de integra├º├úo (n├úo fazem parte da API p├║blica).
export { getBuyInstructionDataEncoder as PUMP_BUY_ENCODER_FOR_TESTS } from './generated/pump/instructions/index.js';
export { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
export { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';
## ADR-025 ÔÇö Fatos de runtime descobertos na F1.5 (decoder/enrichment)

- **Contexto:** implementa├º├úo do enrichment (decoder codama + IDL oficial `pump-public-docs @81091419`).
- **Fatos (FACT, verificados em 2026-09-24 com a API real):**
  1. Enhanced API Helius ├® acess├¡vel em `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem barra 
antes de `?`); nessa m├íquina `api.helius.dev` n├úo resolve DNS.
  2. `getTransaction` pode retornar `version: 1` ÔÇö usar `maxSupportedTransactionVersion: 1` (antes era 0; quebra 
nova).
  3. Helius free: `logsSubscribe` aceita **1 endere├ºo por subscription** ("Only 1 address supported") ÔÇö o provider 
faz 1 sub/endere├ºo; barato para at├® dezenas de programas.
- **Decis├Áes:**
  - Clientes codama ficam com `// @ts-nocheck` (postprocess do script `codama.pump.mjs`) porque a IDL oficial cont├®m 
PDA collisions que o codama renomeia parcialmente; o wrapper `decode.ts` permanece 100% tipado. Revisitar se o 
upstream corrigir.
  - `trackVolume` usa codec `OptionBool = readonly [boolean]` (arg ├® tupla `[false]`) ÔÇö diverge do booleano plano; 
documentado porque quebra silenciosamente se passado `false`.
- **Status:** FACT.
docs/architecture/adr/ADR-001-npm-workspaces-como-gerenciador-de-monorepo.md
docs/architecture/adr/ADR-002-postgresql-local-via-prisma-sem-acoplamento-ao-sup.md
docs/architecture/adr/ADR-003-dev-local-nativo-docker-apenas-para-o-servidor-fut.md
docs/architecture/adr/ADR-004-vitest-fast-check-pytest-hypothesis.md
docs/architecture/adr/ADR-005-zod-para-validacao-de-config-e-payloads.md
docs/architecture/adr/ADR-006-guard-live-em-falha-fechada-no-carregamento-de-con.md
docs/architecture/adr/ADR-007-sem-redis-na-fase-inicial.md
docs/architecture/adr/ADR-008-llm-fora-do-caminho-critico.md
docs/architecture/adr/ADR-009-perfis-de-agentes-versionados-no-repo.md
docs/architecture/adr/ADR-010-observedevent-wallet-como-address-string-sem-fk.md
docs/architecture/adr/ADR-011-stack-de-dados-solana-solana-kit-helius-sdk-yellow.md
docs/architecture/adr/ADR-012-pump-fun-idl-vendored-nenhum-sdk-npm-de-terceiros.md
docs/architecture/adr/ADR-013-jupiter-dexscreener-birdeye-rugcheck-via-clientes-.md
docs/architecture/adr/ADR-014-mcp-servers-no-ambiente-de-dev-opencode-json.md
docs/architecture/adr/ADR-015-stack-quantitativa-e-repos-de-referencia-avaliacao.md
docs/architecture/adr/ADR-016-pump-fun-tem-sdk-docs-oficiais-revisao-parcial-do-.md
docs/architecture/adr/ADR-017-aprendizados-arquiteturais-do-cutupdev-solana-copy.md
docs/architecture/adr/ADR-018-chainstacklabs-pumpfun-bonkfun-bot-como-referencia.md
docs/architecture/adr/ADR-019-camada-de-streaming-vixen-shredstream-laserstream-.md
docs/architecture/adr/ADR-020-baseline-consolidado-de-repositorios-2026-09-24-ve.md
docs/architecture/adr/ADR-021-endpoint-wss-helius-mainnet-helius-rpc-com-laserst.md
docs/architecture/adr/ADR-022-schema-de-env-sem-zod-strict.md
docs/architecture/adr/ADR-023-fixture-de-smoke-f1-programa-pump-fun-como-alvo-de.md
docs/architecture/adr/ADR-024-risco-emergente-retencao-de-dados-e-single-instanc.md
docs/architecture/adr/ADR-025-fatos-runtime-f15-decoder-enrichment.md
docs/architecture/architecture.md
docs/architecture/decision-log.md
[0m
[0m$ [0mgit worktree list; git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/main.ts; 
git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:package.json | Select-String -Pattern "lint|typecheck|test" -Context 
1,1
C:/Users/enzo/Desktop/copytrade 2                      3838e2f [master]
C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment     73eac5e [sprint/f1-5-enrichment]
C:/Users/enzo/Desktop/copytrade-wt-f1-postgres-live    cbd49d4 [sprint/f1-postgres-live]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes   19ffacc [sprint/f1-security-fixes]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes-2 df98063 [sprint/f1-security-fixes-2]
/**
 * Entrypoint execut├ível do servi├ºo data-ingestion.
 * Uso: node dist/main.js (ap├│s `npm run build`), com vari├íveis de ambiente carregadas.
 */
import { start } from './index.js';

start().catch((err: unknown) => {
  // eslint n├úo permite console; stderr direto ├® aceit├ível APENAS aqui (boot fatal).
  process.stderr.write(
    `FATAL boot data-ingestion: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});

      "packages/*",
>     "backtester"
    ],
      "build": "npm run build --workspaces --if-present",
>     "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
      "format": "prettier --write .",
      "format:check": "prettier --check .",
>     "typecheck": "tsc -b --pretty",
>     "test": "vitest run --passWithNoTests",
>     "test:watch": "vitest",
      "prisma:generate": "prisma generate --schema packages/database/prisma/schema.prisma",
      "@types/node": "^20.14.0",
>     "@typescript-eslint/eslint-plugin": "^7.13.0",
>     "@typescript-eslint/parser": "^7.13.0",
>     "eslint": "^8.57.0",
>     "eslint-config-prettier": "^9.1.0",
      "fast-check": "^3.19.0",
      "typescript": "^5.4.5",
>     "vitest": "^3.2.7"
    },
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:.env.example 2>$null | Select-String -Pattern 
"ENRICH|RETENTION|LOCK"; git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:package.json | Select-Object -First 40
{
  "name": "solana-copytrade-engine",
  "version": "0.1.0",
  "private": true,
  "description": "Solana Smart-Money Intelligence + Pump.fun Copy Trading Engine (PAPER-first)",
  "workspaces": [
    "apps/*",
    "services/*",
    "packages/*",
    "backtester"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -b --pretty",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate --schema packages/database/prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema packages/database/prisma/schema.prisma",
    "check:secrets": "node infrastructure/scripts/check-secrets.mjs",
    "check:security": "npm run check:secrets && npm audit --audit-level=high"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "fast-check": "^3.19.0",
    "prettier": "^3.3.0",
    "typescript": "^5.4.5",
    "vitest": "^3.2.7"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
[0m
[0m$ [0mgit log --oneline -4 sprint/f1-5-enrichment; git merge-base --is-ancestor 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa sprint/f1-5-enrichment; echo "is-ancestor exit: $LASTEXITCODE"
73eac5e chore(ops): check-secrets isenta docs/ (relatorios com dados on-chain publicos)
38cf505 feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
20d93cf feat(f1.5): helius-provider per-wallet subscriptions + anti-leak de sockets + maxSupportedTransactionVersion=1 
+ testes
3d6c9db feat(f1.5): schema ObservedEvent com enrichment + migration + repositories com guarda TOCTOU + testes
is-ancestor exit: 0
[0m
[0m$ [0mTest-Path "C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment\node_modules"; git -C 
"C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment" status --short | Select-Object -First 5
True
 M packages/pumpfun/src/decode.test.ts
 M packages/pumpfun/src/decode.ts
[0m
[0m$ [0mgit -C "C:\Users\enzo\Desktop\copytrade-wt-f1-5-enrichment" diff packages/pumpfun/src/decode.ts 
packages/pumpfun/src/decode.test.ts
diff --git a/packages/pumpfun/src/decode.test.ts b/packages/pumpfun/src/decode.test.ts
index 154966c..cc28099 100644
--- a/packages/pumpfun/src/decode.test.ts
+++ b/packages/pumpfun/src/decode.test.ts
@@ -14,7 +14,9 @@ import {
 import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
 import {
   BUY_DISCRIMINATOR as AMM_BUY,
+  SELL_DISCRIMINATOR as AMM_SELL,
   getBuyInstructionDataEncoder as ammBuyEnc,
+  getSellInstructionDataEncoder as ammSellEnc,
 } from './generated/pump_amm/instructions/index.js';
 import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';
 
@@ -56,6 +58,9 @@ function sellData(): Uint8Array<ArrayBuffer> {
 function ammBuyData(): Uint8Array<ArrayBuffer> {
   return toBytes(ammBuyEnc().encode({ baseAmountOut: 9n, maxQuoteAmountIn: 99n, trackVolume: [false] }));
 }
+function ammSellData(): Uint8Array<ArrayBuffer> {
+  return toBytes(ammSellEnc().encode({ baseAmountIn: 11n, minQuoteAmountOut: 22n }));
+}
 
 describe('decoder F1.5 - caminho positivo (sintetico)', () => {
   it('pump buy decodifica kind/mint/user/amounts', () => {
@@ -174,6 +179,29 @@ describe('decoder F1.5 - payloads adversariais (null, nunca throw)', () => {
   });
 });
 
+describe('decoder F1.5 - gates por contagem canonica da IDL (review A-1)', () => {
+  it('pump SELL com exatas 14 contas (IDL) decodifica', () => {
+    const acc14 = pumpAccounts().slice(0, 14);
+    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), acc14);
+    expect(d).not.toBeNull();
+    expect(d!.kind).toBe('pump_sell');
+    expect(d!.mint).toBe(MINT);
+  });
+
+  it('pump sell com 13 contas (abaixo da IDL) retorna null', () => {
+    expect(
+      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), pumpAccounts().slice(0, 13)),
+    ).toBeNull();
+  });
+
+  it('pump_amm SELL com exatas 21 contas (IDL) decodifica', () => {
+    const acc21 = ammAccounts().slice(0, 21);
+    const d = decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammSellData(), acc21);
+    expect(d).not.toBeNull();
+    expect(d!.kind).toBe('pumpswap_sell');
+  });
+});
+
 describe('decoder F1.5 - discriminadores da IDL oficial', () => {
   it('pump/pumpswap discriminators existem com 8 bytes', () => {
     expect(PUMP_BUY).toHaveLength(8);
diff --git a/packages/pumpfun/src/decode.ts b/packages/pumpfun/src/decode.ts
index 244fc70..67ad1bb 100644
--- a/packages/pumpfun/src/decode.ts
+++ b/packages/pumpfun/src/decode.ts
@@ -53,9 +53,19 @@ function validAddr(a: unknown): a is string {
   return typeof a === 'string' && addressSchema.safeParse(a).success;
 }
 
-/** Contas m├¡nimas esperadas: pump.buy/sell = 16; pump_amm.buy/sell = 22. */
-const PUMP_MIN_ACCOUNTS = 16;
-const AMM_MIN_ACCOUNTS = 22;
+/**
+ * Contas m├¡nimas POR INSTRU├ç├âO (can├┤nico da IDL oficial pump-public-docs @81091419):
+ * pump.buy=16, pump.sell=14, pumpAmm.buy=23, pumpAmm.sell=21.
+ * O gate vem DEPOIS do match de discriminador (review d016b8b CRITICAL A-1:
+ * com gate unico 16/22 antes do match, sell com 14/21 contas era descartado
+ * silenciosamente ÔÇö vi├®s de selecao no feed).
+ */
+const MIN_ACCOUNTS = {
+  pump_buy: 16,
+  pump_sell: 14,
+  pumpswap_buy: 23,
+  pumpswap_sell: 21,
+} as const;
 
 export function decodePumpInstruction(
   programId: string,
@@ -66,14 +76,19 @@ export function decodePumpInstruction(
     // Normaliza para Uint8Array: os decoders do codama exigem Uint8Array.
     const bytes = data instanceof Uint8Array ? data : Uint8Array.from(Array.from(data));
     if (programId === PUMP_PROGRAM_ADDRESS) {
-      if (accounts.length < PUMP_MIN_ACCOUNTS) return null;
+      // Discriminador primeiro (gate de contas ├® por instrucao ÔÇö review A-1).
+      const isBuy = discEq(bytes, PUMP_BUY);
+      const isSell = !isBuy && discEq(bytes, PUMP_SELL);
+      if (!isBuy && !isSell) return null;
+      const minAcc = isBuy ? MIN_ACCOUNTS.pump_buy : MIN_ACCOUNTS.pump_sell;
+      if (accounts.length < minAcc) return null;
       // IDL: mint=2, bondingCurve=3, user=6
       const mint = accounts[2];
       const counterparty = accounts[3];
       const user = accounts[6];
       if (!validAddr(mint) || !validAddr(counterparty) || !validAddr(user)) return null;
 
-      if (discEq(bytes, PUMP_BUY)) {
+      if (isBuy) {
         const d = pumpBuyDecoder().decode(bytes);
         return {
           kind: 'pump_buy',
@@ -85,23 +100,26 @@ export function decodePumpInstruction(
           solAmount: d.maxSolCost.toString(),
         };
       }
-      if (discEq(bytes, PUMP_SELL)) {
-        const d = pumpSellDecoder().decode(bytes);
-        return {
-          kind: 'pump_sell',
-          direction: 'sell',
-          mint: mint!,
-          user: user!,
-          counterparty: counterparty!,
-          tokenAmount: d.amount.toString(),
-          solAmount: d.minSolOutput.toString(),
-        };
-      }
-      return null;
+      // isSell (verificado acima)
+      const d = pumpSellDecoder().decode(bytes);
+      return {
+        kind: 'pump_sell',
+        direction: 'sell',
+        mint: mint!,
+        user: user!,
+        counterparty: counterparty!,
+        tokenAmount: d.amount.toString(),
+        solAmount: d.minSolOutput.toString(),
+      };
     }
 
     if (programId === PUMP_AMM_PROGRAM_ADDRESS) {
-      if (accounts.length < AMM_MIN_ACCOUNTS) return null;
+      // AMM: discriminador primeiro; gate de contas por instrucao.
+      const ammIsBuy = discEq(bytes, AMM_BUY);
+      const ammIsSell = !ammIsBuy && discEq(bytes, AMM_SELL);
+      if (!ammIsBuy && !ammIsSell) return null;
+      const ammMin = ammIsBuy ? MIN_ACCOUNTS.pumpswap_buy : MIN_ACCOUNTS.pumpswap_sell;
+      if (accounts.length < ammMin) return null;
       // IDL: pool=0, user=1, baseMint=3, quoteMint=4
       const counterparty = accounts[0];
       const user = accounts[1];
@@ -124,7 +142,7 @@ export function decodePumpInstruction(
       const mapKind = (ix: 'buy' | 'sell'): DecodedSwap['kind'] =>
         mapDirection(ix) === 'buy' ? 'pumpswap_buy' : 'pumpswap_sell';
 
-      if (discEq(bytes, AMM_BUY)) {
+      if (ammIsBuy) {
         const d = ammBuyDecoder().decode(bytes);
         // quoteIn = wSOL gasto (se quote=wSOL); token = baseAmountOut.
         return {
@@ -137,7 +155,7 @@ export function decodePumpInstruction(
           solAmount: quoteIsWsol ? d.maxQuoteAmountIn.toString() : d.baseAmountOut.toString(),
         };
       }
-      if (discEq(bytes, AMM_SELL)) {
+      if (ammIsSell) {
         const d = ammSellDecoder().decode(bytes);
         // baseIn = token vendido (se quote=wSOL); quoteOut = wSOL recebido.
         return {
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/idl/pump.json | node -e "let 
s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const ix of 
j.instructions){console.log(ix.name, 'accounts:', ix.accounts.length, '->', ix.accounts.map(a=>a.name).join(','))}})"
add_quote_control_mint accounts: 6 -> authority,global,quote_control,system_program,event_authority,program
add_quote_mint accounts: 4 -> global,authority,event_authority,program
admin_cto accounts: 26 -> admin_set_creator_authority,global,mint,quote_mint,quote_token_program,associated_token_progr
am,system_program,bonding_curve,current_creator,current_creator_quote_token_account,creator_vault,creator_vault_quote_t
oken_account,holder_creator_vault,holder_creator_vault_quote_token_account,pump_amm,amm_global_config,pool_authority,po
ol,pump_amm_event_authority,coin_creator_vault_authority,coin_creator_vault_ata,sharing_config,pump_fees,pump_fees_even
t_authority,event_authority,program
admin_set_idl_authority accounts: 7 -> 
authority,global,idl_account,system_program,program_signer,event_authority,program
admin_update_token_incentives accounts: 10 -> authority,global,global_volume_accumulator,mint,global_incentive_token_ac
count,associated_token_program,system_program,token_program,event_authority,program
buy accounts: 16 -> global,fee_recipient,mint,bonding_curve,associated_bonding_curve,associated_user,user,system_progra
m,token_program,creator_vault,event_authority,program,global_volume_accumulator,user_volume_accumulator,fee_config,fee_
program
buy_exact_quote_in_v2 accounts: 27 -> global,base_mint,quote_mint,base_token_program,quote_token_program,associated_tok
en_program,fee_recipient,associated_quote_fee_recipient,buyback_fee_recipient,associated_quote_buyback_fee_recipient,bo
nding_curve,associated_base_bonding_curve,associated_quote_bonding_curve,user,associated_base_user,associated_quote_use
r,creator_vault,associated_creator_vault,sharing_config,global_volume_accumulator,user_volume_accumulator,associated_us
er_volume_accumulator,fee_config,fee_program,system_program,event_authority,program
buy_exact_sol_in accounts: 16 -> global,fee_recipient,mint,bonding_curve,associated_bonding_curve,associated_user,user,
system_program,token_program,creator_vault,event_authority,program,global_volume_accumulator,user_volume_accumulator,fe
e_config,fee_program
buy_v2 accounts: 27 -> global,base_mint,quote_mint,base_token_program,quote_token_program,associated_token_program,fee_
recipient,associated_quote_fee_recipient,buyback_fee_recipient,associated_quote_buyback_fee_recipient,bonding_curve,ass
ociated_base_bonding_curve,associated_quote_bonding_curve,user,associated_base_user,associated_quote_user,creator_vault
,associated_creator_vault,sharing_config,global_volume_accumulator,user_volume_accumulator,associated_user_volume_accum
ulator,fee_config,fee_program,system_program,event_authority,program
claim_cashback accounts: 5 -> user,user_volume_accumulator,system_program,event_authority,program
claim_cashback_v2 accounts: 10 -> user,user_volume_accumulator,quote_mint,quote_token_program,associated_token_program,
associated_user_volume_accumulator,associated_quote_user,system_program,event_authority,program
claim_token_incentives accounts: 12 -> user,user_ata,global_volume_accumulator,global_incentive_token_account,user_volu
me_accumulator,mint,token_program,system_program,associated_token_program,event_authority,program,payer
close_user_volume_accumulator accounts: 4 -> user,user_volume_accumulator,event_authority,program
collect_creator_fee accounts: 5 -> creator,creator_vault,system_program,event_authority,program
collect_creator_fee_v2 accounts: 10 -> creator,creator_token_account,creator_vault,creator_vault_token_account,quote_mi
nt,quote_token_program,associated_token_program,system_program,event_authority,program
create accounts: 14 -> mint,mint_authority,bonding_curve,associated_bonding_curve,global,mpl_token_metadata,metadata,us
er,system_program,token_program,associated_token_program,rent,event_authority,program
create_v2 accounts: 16 -> mint,mint_authority,bonding_curve,associated_bonding_curve,global,user,system_program,token_p
rogram,associated_token_program,mayhem_program_id,global_params,sol_vault,mayhem_state,mayhem_token_vault,event_authori
ty,program
distribute_creator_fees accounts: 7 -> 
mint,bonding_curve,sharing_config,creator_vault,system_program,event_authority,program
distribute_creator_fees_v2 accounts: 12 -> payer,mint,bonding_curve,sharing_config,creator_vault,system_program,event_a
uthority,program,creator_vault_quote_token_account,quote_mint,quote_token_program,associated_token_program
distribute_fee_to_holders accounts: 11 -> global,holder_reward_claim_authority,mint,holder_rewards,holder_rewards_token
_account,quote_mint,quote_token_program,associated_token_program,system_program,event_authority,program
extend_account accounts: 5 -> account,user,system_program,event_authority,program
get_minimum_distributable_fee accounts: 4 -> mint,bonding_curve,sharing_config,creator_vault
init_user_volume_accumulator accounts: 6 -> payer,user,user_volume_accumulator,system_program,event_authority,program
initialize accounts: 3 -> global,user,system_program
initialize_quote_control accounts: 3 -> quote_control,user,system_program
migrate accounts: 25 -> global,withdraw_authority,mint,bonding_curve,associated_bonding_curve,user,system_program,token
_program,pump_amm,pool,pool_authority,pool_authority_mint_account,pool_authority_wsol_account,amm_global_config,wsol_mi
nt,lp_mint,user_pool_token_account,pool_base_token_account,pool_quote_token_account,token_2022_program,associated_token
_program,pump_amm_event_authority,event_authority,program,rent
migrate_bonding_curve_creator accounts: 5 -> mint,bonding_curve,sharing_config,event_authority,program
migrate_v2 accounts: 27 -> global,withdraw_authority,base_mint,quote_mint,bonding_curve,associated_base_bonding_curve,a
ssociated_quote_bonding_curve,user,system_program,pump_amm,pool,pool_authority,pool_authority_mint_account,pool_authori
ty_quote_account,amm_global_config,lp_mint,user_pool_token_account,pool_base_token_account,pool_quote_token_account,bas
e_token_program,quote_token_program,token_2022_program,associated_token_program,pump_amm_event_authority,rent,event_aut
hority,program
remove_quote_control_mint accounts: 6 -> authority,global,quote_control,system_program,event_authority,program
remove_quote_mint accounts: 4 -> global,authority,event_authority,program
sell accounts: 14 -> global,fee_recipient,mint,bonding_curve,associated_bonding_curve,associated_user,user,system_progr
am,creator_vault,token_program,event_authority,program,fee_config,fee_program
sell_v2 accounts: 26 -> global,base_mint,quote_mint,base_token_program,quote_token_program,associated_token_program,fee
_recipient,associated_quote_fee_recipient,buyback_fee_recipient,associated_quote_buyback_fee_recipient,bonding_curve,as
sociated_base_bonding_curve,associated_quote_bonding_curve,user,associated_base_user,associated_quote_user,creator_vaul
t,associated_creator_vault,sharing_config,user_volume_accumulator,associated_user_volume_accumulator,fee_config,fee_pro
gram,system_program,event_authority,program
set_creator accounts: 7 -> set_creator_authority,global,mint,metadata,bonding_curve,event_authority,program
set_mayhem_virtual_params accounts: 8 -> 
sol_vault_authority,mayhem_token_vault,mint,global,bonding_curve,token_program,event_authority,program
set_metaplex_creator accounts: 5 -> mint,metadata,bonding_curve,event_authority,program
set_params accounts: 4 -> global,authority,event_authority,program
set_quote_control_admin accounts: 5 -> global,authority,quote_control,event_authority,program
set_reserved_fee_recipients accounts: 4 -> global,authority,event_authority,program
set_virtual_quote_reserves accounts: 4 -> global,authority,event_authority,program
sync_user_volume_accumulator accounts: 5 -> 
user,global_volume_accumulator,user_volume_accumulator,event_authority,program
toggle_cashback_enabled accounts: 4 -> global,authority,event_authority,program
toggle_create_v2 accounts: 4 -> global,authority,event_authority,program
toggle_mayhem_mode accounts: 4 -> global,authority,event_authority,program
update_buyback_config accounts: 4 -> global,authority,event_authority,program
update_creator_fee_config accounts: 4 -> global,authority,event_authority,program
update_global_authority accounts: 5 -> global,authority,new_authority,event_authority,program
update_holder_reward_config accounts: 4 -> global,authority,event_authority,program
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/idl/pump_amm.json | node -e "let 
s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const ix of 
j.instructions){console.log(ix.name, 'accounts:', ix.accounts.length, '->', ix.accounts.map(a=>a.name).join(','))}})"
admin_cto_pool accounts: 7 -> payer,global_config,pool,pool_authority,system_program,event_authority,program
admin_update_token_incentives accounts: 10 -> admin,global_config,global_volume_accumulator,mint,global_incentive_token
_account,associated_token_program,system_program,token_program,event_authority,program
boost_buy_and_burn accounts: 13 -> pool,authority,global_config,base_mint,quote_mint,pool_base_token_account,pool_quote
_token_account,boost_vault_authority,boost_vault,base_token_program,quote_token_program,event_authority,program
buy accounts: 23 -> pool,user,global_config,base_mint,quote_mint,user_base_token_account,user_quote_token_account,pool_
base_token_account,pool_quote_token_account,protocol_fee_recipient,protocol_fee_recipient_token_account,base_token_prog
ram,quote_token_program,system_program,associated_token_program,event_authority,program,coin_creator_vault_ata,coin_cre
ator_vault_authority,global_volume_accumulator,user_volume_accumulator,fee_config,fee_program
buy_exact_quote_in accounts: 23 -> pool,user,global_config,base_mint,quote_mint,user_base_token_account,user_quote_toke
n_account,pool_base_token_account,pool_quote_token_account,protocol_fee_recipient,protocol_fee_recipient_token_account,
base_token_program,quote_token_program,system_program,associated_token_program,event_authority,program,coin_creator_vau
lt_ata,coin_creator_vault_authority,global_volume_accumulator,user_volume_accumulator,fee_config,fee_program
claim_cashback accounts: 9 -> user,user_volume_accumulator,quote_mint,quote_token_program,user_volume_accumulator_wsol_
token_account,user_wsol_token_account,system_program,event_authority,program
claim_token_incentives accounts: 12 -> user,user_ata,global_volume_accumulator,global_incentive_token_account,user_volu
me_accumulator,mint,token_program,system_program,associated_token_program,event_authority,program,payer
close_user_volume_accumulator accounts: 4 -> user,user_volume_accumulator,event_authority,program
collect_coin_creator_fee accounts: 8 -> quote_mint,quote_token_program,coin_creator,coin_creator_vault_authority,coin_c
reator_vault_ata,coin_creator_token_account,event_authority,program
create_config accounts: 5 -> admin,global_config,system_program,event_authority,program
create_pool accounts: 18 -> pool,global_config,creator,base_mint,quote_mint,lp_mint,user_base_token_account,user_quote_
token_account,user_pool_token_account,pool_base_token_account,pool_quote_token_account,system_program,token_2022_progra
m,base_token_program,quote_token_program,associated_token_program,event_authority,program
deposit accounts: 15 -> pool,global_config,user,base_mint,quote_mint,lp_mint,user_base_token_account,user_quote_token_a
ccount,user_pool_token_account,pool_base_token_account,pool_quote_token_account,token_program,token_2022_program,event_
authority,program
disable accounts: 4 -> admin,global_config,event_authority,program
extend_account accounts: 5 -> account,user,system_program,event_authority,program
init_boost accounts: 14 -> pool,global_config,creator,base_mint,quote_mint,pool_base_token_account,pool_quote_token_acc
ount,boost_vault_authority,boost_vault,quote_token_program,system_program,associated_token_program,event_authority,prog
ram
init_user_volume_accumulator accounts: 6 -> payer,user,user_volume_accumulator,system_program,event_authority,program
migrate_pool_coin_creator accounts: 4 -> pool,sharing_config,event_authority,program
sell accounts: 21 -> pool,user,global_config,base_mint,quote_mint,user_base_token_account,user_quote_token_account,pool
_base_token_account,pool_quote_token_account,protocol_fee_recipient,protocol_fee_recipient_token_account,base_token_pro
gram,quote_token_program,system_program,associated_token_program,event_authority,program,coin_creator_vault_ata,coin_cr
eator_vault_authority,fee_config,fee_program
set_boost_authority accounts: 6 -> admin,global_config,boost_authority,system_program,event_authority,program
set_coin_creator accounts: 5 -> pool,metadata,bonding_curve,event_authority,program
set_reserved_fee_recipients accounts: 4 -> global_config,admin,event_authority,program
sync_user_volume_accumulator accounts: 5 -> 
user,global_volume_accumulator,user_volume_accumulator,event_authority,program
toggle_boost accounts: 2 -> admin,global_config
toggle_cashback_enabled accounts: 4 -> admin,global_config,event_authority,program
toggle_mayhem_mode accounts: 4 -> admin,global_config,event_authority,program
transfer_creator_fees_to_pump accounts: 10 -> wsol_mint,token_program,system_program,associated_token_program,coin_crea
tor,coin_creator_vault_authority,coin_creator_vault_ata,pump_creator_vault,event_authority,program
transfer_creator_fees_to_pump_v2 accounts: 12 -> payer,quote_mint,token_program,system_program,associated_token_program
,coin_creator,coin_creator_vault_authority,coin_creator_vault_ata,pump_creator_vault,pump_creator_vault_ata,event_autho
rity,program
update_admin accounts: 5 -> admin,global_config,new_admin,event_authority,program
update_buyback_config accounts: 4 -> admin,global_config,event_authority,program
update_creator_fee_config accounts: 5 -> admin,global_config,system_program,event_authority,program
update_fee_config accounts: 4 -> admin,global_config,event_authority,program
withdraw accounts: 15 -> pool,global_config,user,base_mint,quote_mint,lp_mint,user_base_token_account,user_quote_token_
account,user_pool_token_account,pool_base_token_account,pool_quote_token_account,token_program,token_2022_program,event
_authority,program
[0m
[0m$ [0mgit log --oneline -15 master; git log --oneline --all | Select-String -Pattern "d016b8b" | Select-Object 
-First 5
3838e2f review(sprint/f1-5-enrichment): REJEITADO 20d93cfec10044434fc0a1966d5093e1da427b05
b5bb013 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 3d6c9db383b0f064b92cc1321171854b0a36b2fe
b2a2048 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 7d7e3d129fb025dadbf3e48478297be86d18850d
cc09b02 review(sprint/f1-5-enrichment): REJEITADO d46525dda3e8b2edaa46d09a3947c56230b38d4b
5646293 review(sprint/f1-5-enrichment): REJEITADO d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c
3e51d3e review(sprint/f1-5-enrichment): REJEITADO (gates falharam) cfca4f89323cbfb68e0dcfa8aafe23a39e69301f
b7364bc review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 0167a0d89fe0f21d6aa83d51e4738a1f4c5e96ae
10f6011 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 812ef1a7f376b01de7f7dbc21ffae9f645e1edc3
1e1d208 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 799d04834d147cbdcc4ad8e46c4b8499d8ad1b00
d119914 review(sprint/f1-5-enrichment): REJEITADO (gates falharam) 6cd436b9bc7582a41c42b1ae40805b3cec015936
829323d review(sprint/f1-5-enrichment): REJEITADO cc64b8d9db54422332e4016b2f86a8d332ee389a
768175e review(sprint/f1-5-enrichment): REJEITADO (gates falharam) fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e
f92985a fix(review): afe614cf tambem tinha veredito final APROVADO (state sincronizado)
b09c20f fix(review): state.json reflete veredito final APROVADO do 38cdaac (arquivo = autoridade)
161a486 docs(sec): SEC fecha RT-004/005/006 (FIXED-VERIFIED, re-teste 17/17 PoCs)

5646293 review(sprint/f1-5-enrichment): REJEITADO d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/src/decode.test.ts | Select-String 
-Pattern "pumpAccounts|ammAccounts|sell|camada|14|16|21|22|23" | Select-Object -First 40
SELL_DISCRIMINATOR as PUMP_SELL,
  getSellInstructionDataEncoder as pumpSellEnc,
/** 16 contas validas na ordem da IDL pump.* (mint=2, curve=3, user=6). */
function pumpAccounts(): string[] {
  const acc = Array.from({ length: 16 }, () => FILLER);
/** 22 contas na ordem da IDL pump_amm.* (pool=0, user=1, baseMint=3). */
function ammAccounts(): string[] {
  const acc = Array.from({ length: 22 }, () => FILLER);
function sellData(): Uint8Array<ArrayBuffer> {
  return toBytes(pumpSellEnc().encode({ amount: 777n, minSolOutput: 42n }));
    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), pumpAccounts());
  it('pump sell decodifica', () => {
    const d = decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellData(), pumpAccounts());
    expect(d!.kind).toBe('pump_sell');
    expect(d!.direction).toBe('sell');
    const d = decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), ammAccounts());
  it('pool base=wSOL inverte o lado do token (fixtures reais): sell de ix = buy do token', () => {
    const acc = ammAccounts();
    // buy da instrucao (baseOut=wSOL) => usuario RECEBE wSOL e da token = sell semantico
    expect(d!.direction).toBe('sell');
    expect(d!.kind).toBe('pumpswap_sell');
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, new Uint8Array(0), pumpAccounts()),
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData().slice(0, 4), pumpAccounts()),
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, new Uint8Array(PUMP_BUY), pumpAccounts()),
        pumpAccounts(),
  it('contas ausentes (5 em vez de 16)', () => {
      decodePumpInstruction(PUMP_PROGRAM_ADDRESS, buyData(), pumpAccounts().slice(0, 5)),
    const acc = pumpAccounts();
    const acc = pumpAccounts();
        pumpAccounts(),
      decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), ammAccounts().slice(0, 10)),
      decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, bad, ammAccounts()),
    expect(PUMP_SELL).toHaveLength(8);
[0m
[0m$ [0mGet-ChildItem "docs/reviews" -Filter "*.md" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 
Name; Get-ChildItem "docs/reviews" | Measure-Object
Name                                       
----                                       
20d93cfec10044434fc0a1966d5093e1da427b05.md
3d6c9db383b0f064b92cc1321171854b0a36b2fe.md
7d7e3d129fb025dadbf3e48478297be86d18850d.md
d46525dda3e8b2edaa46d09a3947c56230b38d4b.md
d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md
[0m
[0m$ [0mgit show 5646293 --stat; git show 5646293 | Select-Object -First 120
commit 5646293fad9e75adb40660b3b983838fa204219b
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:23:20 2026 -0300

    review(sprint/f1-5-enrichment): REJEITADO d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c

 .../d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md    | 2880 ++++++++++++++++++++
 docs/reviews/state.json                            |    3 +-
 2 files changed, 2882 insertions(+), 1 deletion(-)
commit 5646293fad9e75adb40660b3b983838fa204219b
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Fri Sep 25 02:23:20 2026 -0300

    review(sprint/f1-5-enrichment): REJEITADO d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c

diff --git a/docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md 
b/docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md
new file mode 100644
index 0000000..f4141b6
--- /dev/null
+++ b/docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md
@@ -0,0 +1,2880 @@
+´╗┐# Review d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c
+
+- Branch: sprint/f1-5-enrichment
+- Data: 2026-09-25 02:23:19
+- Gates: lint=1 typecheck=1 test=1 (0 = ok)
+- Veredito: **REJEITADO**
+
+## Saida do code-reviewer
+
+opencode.exe : [0m
+No C:\Users\enzo\AppData\Roaming\npm\opencode.ps1:14 caractere:3
++   & "$basedir/node_modules/opencode-ai/bin/opencode.exe"   $args
++   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
+    + CategoryInfo          : NotSpecified: ([0m:String) [], RemoteException
+    + FullyQualifiedErrorId : NativeCommandError
+ 
+> code-reviewer Ôö¼├Ç big-pickle
+[0m
+[0m$ [0mgit log --oneline -5 d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c
+d016b8b feat(f1.5): decoder pump.fun/PumpSwap via codama da IDL oficial (pump-public-docs @81091419)
+ae69bef feat(ops): higiene mensal (report-only) + bootstrap obrigatorio de sessao para sincronizar chats
+93c975b refactor(docs): ADRs em arquivos individuais + indice + protocolo anti-alucinacao (8.3)
+551243b feat(ops): monitoramento do ecossistema em 3 camadas (dependabot + monitor semanal + regra 8.2)
+15f52e8 docs(adr): ADR-020 baseline consolidado de repositorios (31 repos avaliados)
+[0m
+[0m$ [0mgit show d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c --stat
+commit d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c
+Author: EznRB <EznRB@users.noreply.github.com>
+Date:   Fri Sep 25 02:16:10 2026 -0300
+
+    feat(f1.5): decoder pump.fun/PumpSwap via codama da IDL oficial (pump-public-docs @81091419)
+    
+    - packages/pumpfun/idl/: IDLs oficiais vendored (pump.json, pump_amm.json), pin de SHA em sources.ts
+    - codama.pump.mjs: geracao reproduzivel + postprocess documentado (@ts-nocheck apenas nos gerados)
+    - scripts/fix-esm-imports.mjs: corrige imports sem extensao do codama para Node ESM
+    - decode.ts: wrapper 100% tipado, nunca throw em dados hostis, validacao base58; normaliza lado do token quando 
+baseMint=wSOL (inverte buy/sell)
+    - decode.test.ts: 15 testes adversariais (truncado, contas ausentes/fora de ordem, mint invalido, discriminador 
+desconhecido, inversao wSOL)
+    
+    Resolve findings antigos do round-1: falta de decoder oficial (RT decoder). Review antigo: 2ab477f*.
+
+ packages/pumpfun/codama.pump.mjs                   |    59 +
+ packages/pumpfun/idl/pump.json                     | 12387 +++++++++++++++++++
+ packages/pumpfun/idl/pump_amm.json                 |  7681 ++++++++++++
+ packages/pumpfun/package.json                      |    46 +-
+ packages/pumpfun/scripts/fix-esm-imports.mjs       |    36 +
+ packages/pumpfun/src/decode.test.ts                |   183 +
+ packages/pumpfun/src/decode.ts                     |   161 +
+ .../src/generated/pump/accounts/bondingCurve.ts    |   184 +
+ .../src/generated/pump/accounts/feeConfig.ts       |   162 +
+ .../pumpfun/src/generated/pump/accounts/global.ts  |   254 +
+ .../pump/accounts/globalVolumeAccumulator.ts       |   164 +
+ .../pumpfun/src/generated/pump/accounts/index.ts   |    16 +
+ .../src/generated/pump/accounts/quoteControl.ts    |   144 +
+ .../src/generated/pump/accounts/sharingConfig.ts   |   168 +
+ .../pump/accounts/userVolumeAccumulator.ts         |   184 +
+ .../pumpfun/src/generated/pump/errors/index.ts     |    10 +
+ packages/pumpfun/src/generated/pump/errors/pump.ts |   418 +
+ .../pump/events/addQuoteControlMintEvent.ts        |   109 +
+ .../src/generated/pump/events/adminCtoEvent.ts     |   136 +
+ .../pump/events/adminSetIdlAuthorityEvent.ts       |    79 +
+ .../pump/events/adminUpdateTokenIncentivesEvent.ts |   116 +
+ .../generated/pump/events/claimCashbackEvent.ts    |   104 +
+ .../pump/events/claimTokenIncentivesEvent.ts       |   113 +
+ .../pump/events/closeUserVolumeAccumulatorEvent.ts |   112 +
+ .../pump/events/collectCreatorFeeEvent.ts          |   103 +
+ .../src/generated/pump/events/completeEvent.ts     |   100 +
+ .../pump/events/completePumpAmmMigrationEvent.ts   |   134 +
+ .../src/generated/pump/events/createEvent.ts       |   161 +
+ .../pump/events/distributeCreatorFeesEvent.ts      |   129 +
+ .../pump/events/distributeFeeToHoldersEvent.ts     |   108 +
+ .../generated/pump/events/extendAccountEvent.ts    |   104 +
+ .../pumpfun/src/generated/pump/events/index.ts     |    37 +
+ .../pump/events/initUserVolumeAccumulatorEvent.ts  |    98 +
+ .../pump/events/migrateBondingCurveCreatorEvent.ts |   110 +
+ .../pump/events/minimumDistributableFeeEvent.ts    |    97 +
+ .../pump/events/removeQuoteControlMintEvent.ts     |   102 +
+ .../pump/events/reservedFeeRecipientsEvent.ts      |   101 +
+ .../src/generated/pump/events/setCreatorEvent.ts   |    98 +
+ .../pump/events/setMetaplexCreatorEvent.ts         |   107 +
+ .../src/generated/pump/events/setParamsEvent.ts    |   144 +
+ .../pump/events/setQuoteControlAdminEvent.ts       |   107 +
+ .../pump/events/syncUserVolumeAccumulatorEvent.ts  |   104 +
+ .../src/generated/pump/events/tradeEvent.ts        |   229 +
+ .../pump/events/updateCreatorFeeConfigEvent.ts     |   106 +
+ .../pump/events/updateGlobalAuthorityEvent.ts      |   103 +
+ .../pump/events/updateMayhemVirtualParamsEvent.ts  |   120 +
+ packages/pumpfun/src/generated/pump/index.ts       |    16 +
+ .../pump/instructions/addQuoteControlMint.ts       |   432 +
+ .../generated/pump/instructions/addQuoteMint.ts    |   334 +
+ .../src/generated/pump/instructions/adminCto.ts    |  1423 +++
+ .../pump/instructions/adminSetIdlAuthority.ts      |   454 +
+ .../instructions/adminUpdateTokenIncentives.ts     |   639 +
+ .../pumpfun/src/generated/pump/instructions/buy.ts |   854 ++
+ .../pump/instructions/buyExactQuoteInV2.ts         |  1462 +++
+ .../generated/pump/instructions/buyExactSolIn.ts   |   857 ++
+ .../src/generated/pump/instructions/buyV2.ts       |  1452 +++
+ .../generated/pump/instructions/claimCashback.ts   |   380 +
+ .../generated/pump/instructions/claimCashbackV2.ts |   614 +
+ .../pump/instructions/claimTokenIncentives.ts      |   689 ++
+ .../instructions/closeUserVolumeAccumulator.ts     |   332 +
+ .../pump/instructions/collectCreatorFee.ts         |   372 +
+ .../pump/instructions/collectCreatorFeeV2.ts       |   625 +
+ .../src/generated/pump/instructions/create.ts      |   769 ++
+ .../src/generated/pump/instructions/createV2.ts    |   898 ++
+ .../pump/instructions/distributeCreatorFees.ts     |   456 +
+ .../pump/instructions/distributeCreatorFeesV2.ts   |   708 ++
[0m
[0m$ [0mSelect-String -Path "docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md" -Pattern "A-1|CRITICAL|14 
contas|21 contas|sell" | Select-Object -First 30 LineNumber, Line
LineNumber Line                                                                                                 
---------- ----                                                                                                 
        37 baseMint=wSOL (inverte buy/sell)                                                                     
       121  .../src/generated/pump/instructions/sell.ts        |   742 ++                                       
       122  .../src/generated/pump/instructions/sellV2.ts      |  1404 +++                                      
       215  .../src/generated/pump_amm/events/sellEvent.ts     |   209 +                                        
       243  .../src/generated/pump_amm/instructions/sell.ts    |  1082 ++                                       
       294 baseMint=wSOL (inverte buy/sell)                                                                     
       367 + *   (amount = tokens; em buy, sol = maxSolCost/maxQuoteAmountIn; em sell,                          
       374 +  SELL_DISCRIMINATOR as PUMP_SELL,                                                                  
       376 +  getSellInstructionDataDecoder as pumpSellDecoder,                                                 
       381 +  SELL_DISCRIMINATOR as AMM_SELL,                                                                   
       383 +  getSellInstructionDataDecoder as ammSellDecoder,                                                  
       391 +  kind: 'pump_buy' | 'pump_sell' | 'pumpswap_buy' | 'pumpswap_sell';                                
       392 +  direction: 'buy' | 'sell';                                                                        
       413 +/** Contas m├¡nimas esperadas: pump.buy/sell = 16; pump_amm.buy/sell = 22. */                       
       445 +      if (discEq(bytes, PUMP_SELL)) {                                                               
       446 +        const d = pumpSellDecoder().decode(bytes);                                                  
       448 +          kind: 'pump_sell',                                                                        
       449 +          direction: 'sell',                                                                        
       471 +      // do pool for wSOL, a sem├óntica buy/sell da instru├º├úo se inverte do ponto                 
       477 +      const mapDirection = (ix: 'buy' | 'sell'): 'buy' | 'sell' => {                                
       478 +        if (baseIsWsol) return ix === 'buy' ? 'sell' : 'buy'; // invertido                          
       481 +      const mapKind = (ix: 'buy' | 'sell'): DecodedSwap['kind'] =>                                  
       482 +        mapDirection(ix) === 'buy' ? 'pumpswap_buy' : 'pumpswap_sell';                              
       497 +      if (discEq(bytes, AMM_SELL)) {                                                                
       498 +        const d = ammSellDecoder().decode(bytes);                                                   
       501 +          kind: mapKind('sell'),                                                                    
       502 +          direction: mapDirection('sell'),                                                          
       588 baseMint=wSOL (inverte buy/sell)                                                                     
       754 d016b8b2:packages/pumpfun/src/generated/pump/instructions/sell.ts > "$tmp\pump_sell.ts"; git show    
       756 d016b8b2:packages/pumpfun/src/generated/pump_amm/instructions/sell.ts > "$tmp\amm_sell.ts"; git show
[0m
[0m$ [0mGet-ChildItem "docs/reviews" -Filter "*5299d25*" | Select-Object Name; Get-ChildItem "docs/reviews" | 
Select-Object Name
Name                                       
----                                       
5299d250602fd81b9ac1849c026ec11955411feb.md
0167a0d89fe0f21d6aa83d51e4738a1f4c5e96ae.md
06d452b47eeb2a57f9a7503c92db95e9850cc944.md
071140969c2b27580f35e7ebf23714b406c200c0.md
0b7f55e5d8810bf2638c221a55592621bdf36c3c.md
19ffacc3726223dab70613484bba5432cd289d9c.md
20d93cfec10044434fc0a1966d5093e1da427b05.md
2ab477f7dc60361db18e2106cd4b9ef48aea977e.md
38cdaac0b30e0ddf53dab697b7131e4a3499d55c.md
3d6c9db383b0f064b92cc1321171854b0a36b2fe.md
5299d250602fd81b9ac1849c026ec11955411feb.md
538ed8f1f82de7dce8c9e842a416d702bfa720fa.md
5c84a7419243edc6a3eeb9bfe7725bd320689c8e.md
609a1a65fb7495e8351d676d5d49a4ef76a054d2.md
6cd436b9bc7582a41c42b1ae40805b3cec015936.md
6d984e2fba17bc9e75cd9a89b9e6bd9dd104229f.md
799d04834d147cbdcc4ad8e46c4b8499d8ad1b00.md
7d7e3d129fb025dadbf3e48478297be86d18850d.md
7edc05c736368be87306896333ea6ed3bf65af5a.md
812ef1a7f376b01de7f7dbc21ffae9f645e1edc3.md
88152bbfafe2705932d909bd7c67571241f4b248.md
887e5160abe34afa8f947d9d3d028f8f978f1a08.md
afe614cf46169461a019b3a9599f58177ae83e0d.md
c438ef1c0c9483258896afaaf976f7e67a3404e9.md
cbd49d4fa82a2f97e8e9b134239f9ab282539ac0.md
cc64b8d9db54422332e4016b2f86a8d332ee389a.md
ccd5313e042c9e6ed45480dd91f955fb43ce6624.md
cd4468ae7f1ff2d39cdc249c4188a690144bba44.md
cfca4f89323cbfb68e0dcfa8aafe23a39e69301f.md
d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md
d46525dda3e8b2edaa46d09a3947c56230b38d4b.md
dddb30b148daf08293bdf90097f010bb40322218.md
df980637e823da5b804d18efab1a9a92b8e02562.md
ea88b4649a2b109ebf0b963b92f289dcc957feb5.md
ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1.md
fd6a5a6feae30ada70e1a0dec0d1ab0b99cc8e5e.md
ffc094cb0de340613451df935feeebd62c1e2cfc.md
README.md                                  
state.json                                 
watcher.log
[0m
[0m$ [0mSelect-String -Path "docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md" -Pattern 
"VEREDITO|A-1|A-2|A-3|B-1|CRITICAL" | Select-Object -Last 25 LineNumber, Line
LineNumber Line                                                                                                        
---------- ----                                                                                                        
         6 - Veredito: **REJEITADO**                                                                                   
      2769 ## VEREDITO: REJEITADO                                                                                      
      2775 ### CRITICAL ÔÇö A-1: gate de contas m├¡nimas mata SILENCIOSAMENTE os dois caminhos de SELL                 
      2799 ### HIGH ÔÇö B-1: `package-lock.json` n├úo atualizado ÔåÆ `npm ci` (CI) quebra na instala├º├úo              
      2854 - "nunca throw em dados hostis" ÔÇö verdadeiro no `catch`, mas o problema real (A-1) ├® retorno `null` si...
      2866 5. **├ìndices de contas (passou parcialmente):** mint=2, curve=3, user=6 (pump); pool=0, user=1, baseMint...
      2868 7. **Lockfile (FALHOU):** `npm ci` quebraria (B-1). N├úo executei `npm install`/`npm ci`/`vitest` porque ...
      2869 8. **Contagem de contas vs gates (FALHOU):** demonstrado em A-1 por aritm├®tica da pr├│pria IDL vendored.   
      2873 - Execu├º├úo real de `npm run lint/typecheck/test` neste commit (lockfile dessincronizado impede `npm ci`...
[0m
[0m$ [0m$f="docs/reviews/d016b8b22f89cd2350ee5dacdbc9ed0a06525f9c.md"; (Get-Content $f | Measure-Object 
-Line).Lines; Get-Content $f | Select-Object -Last 90
2808
1. `git show d016b8b2:packages/pumpfun/idl/pump.json` ÔåÆ instru├º├úo `sell` ÔåÆ `accounts.length == 14`.
2. Seguir o caminho `decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellDataValido, 14ContasCanonicas)` ÔåÆ 
`accounts.length(14) < PUMP_MIN_ACCOUNTS(16)` ÔåÆ `return null`.
3. O teste existente (`decode.test.ts:73-79`) mascara o bug: usa `pumpAccounts()` com **16** contas para o sell ÔÇö 
n├║mero que a pr├│pria IDL oficial n├úo produza para sell.

**Sugest├úo:** mover o gate de contas para **depois** do match de discriminador, com m├¡nimo por instru├º├úo extra├¡do 
da mesma IDL (sell: pump=14, amm=21; buy: pump=16, amm=23), ou derivar o m├¡nimo programaticamente da IDL. Adicionar 
teste de sell com a contagem can├┤nica da IDL e um teste de AMM sell (hoje n├úo existe nenhum).

---

### HIGH ÔÇö B-1: `package-lock.json` n├úo atualizado ÔåÆ `npm ci` (CI) quebra na instala├º├úo

**Arquivo:** `packages/pumpfun/package.json` (novas deps) **vs** `package-lock.json` (intocado no commit)

**Evid├¬ncia:** o commit adiciona 6 depend├¬ncias ao pumpfun (`@solana/kit ^8.3.0`, `@solana/program-client-core 
^8.3.0`, `zod ^3.25.76`, `codama ^1.11.0`, `@codama/nodes-from-anchor ^1.5.6`, `@codama/renderers-js ^2.5.0`) e 
**nenhuma linha de `package-lock.json` mudou** (n├úo aparece no `--stat`). O lockfile existente:
- n├úo tem `node_modules/codama` nem `node_modules/@codama/*`;
- s├│ tem `packages/solana/node_modules/@solana/kit@6.10.0` (aninhado, v6) ÔÇö sem `@solana/kit@8.x` para o pumpfun.

`.github/workflows/ci.yml` roda `npm ci` nos dois jobs. Com o lock dessincronizado, `npm ci` falha com "Missing: 
codama@1.11.0 from lock file" ÔåÆ **gates de CI vermelhos**, viola├º├úo de reprodutibilidade (AGENTS.md ┬º4.6/┬º7.1 
ÔÇö "gates verdes antes de qualquer commit"). N├úo sou capaz de confirmar que os gates passaram localmente com `npm 
install` (que reescreveria o lock) ÔÇö mas o lock commitado n├úo reflete as deps novas.

**Como reproduzir:** `git checkout d016b8b2` ÔåÆ `npm ci` ÔåÆ erro de lockfile.

**Sugest├úo:** rodar `npm install` no pacote (ou `npm i -w @ct/pumpfun codama @codama/nodes-from-anchor 
@codama/renderers-js @solana/kit@^8.3.0 @solana/program-client-core@^8.3.0 zod@^3.25.76`) e commitar o lockfile 
atualizado. Aten├º├úo: `@solana/kit@8` conviver├í com `@solana/kit@6` (packages/solana) ÔÇö confirmar que n├úo h├í 
conflito de peer/typenames na resolu├º├úo TypeScript do monorepo.

---

### MEDIUM ÔÇö C-1: ramo "nem base nem quote ├® wSOL" rotula valor do token como `solAmount`

**Arquivo:** `packages/pumpfun/src/decode.ts:136-146` (buy) e `:152-159` (sell)

**Evid├¬ncia:** no ramo em que `quoteIsWsol=false` e `baseIsWsol=false` (pool token/USDC, por exemplo), para buy o 
c├│digo retorna `tokenAmount: null` e `solAmount: d.baseAmountOut` ÔÇö mas `baseAmountOut` ├® quantidade do **token 
base** (o pr├│prio `tokenMint` retornado), n├úo SOL. O campo `solAmount` recebe uma quantidade de tokens. Para sell: 
`solAmount: d.baseAmountIn` ÔÇö idem, ├® quantidade de token base vendida. Um consumidor downstream que compute fluxos 
de SOL por `solAmount` usaria quantidade de token como lamports ÔåÆ decomposi├º├úo de volume/PnL incorreta.

**Como reproduzir:** chamar `decodePumpInstruction(PUMP_AMM_PROGRAM_ADDRESS, ammBuyData(), acc)` com `acc[3]=MINT`, 
`acc[4]=MINT2` (nenhum wSOL) ÔåÆ retorna `{ tokenAmount: null, solAmount: '9', mint: MINT }` ÔÇö `solAmount` cont├®m 
`baseAmountOut` do token.

**Sugest├úo:** nesse ramo, `tokenAmount = d.baseAmountOut` (buy) / `d.baseAmountIn` (sell) e `solAmount = null` (n├úo 
h├í perna SOL); ou retornar `null` para pools sem perna wSOL, declarando escopo. Hoje o c├│digo alega suportar o caso 
e o suporta de forma internamente inconsistente. (Na mainnet atual isso ├® latente ÔÇö AMM ├® token/wSOL ÔÇö mas o 
c├│digo explicitamente trata 3 configura├º├Áes de par; a terceira est├í errada.)

---

### MEDIUM ÔÇö C-2: `npm run typecheck` na raiz emite `dist` sem o `fix-esm-imports` ÔåÆ artefato quebrado entre gates

**Arquivo:** `packages/pumpfun/tsconfig.json` + `package.json` (script build) + raiz `tsconfig.json` (references 
inclui pumpfun)

**Evid├¬ncia:** `tsc -b` (root, usado por `npm run typecheck`) **emite** dist de projetos composite. O pacote compila 
com `moduleResolution: Bundler` e os clientes codama usam imports relativos **sem extens├úo**; o reparo para ESM Node 
s├│ acontece no script `fix-esm-imports.mjs`, que roda **exclusivamente** no `build` do workspace. A ordem CI t├¡pica 
(typecheck ÔåÆ build) deixa `dist/` gerado pelo typecheck com imports sem extens├úo ÔåÆ qualquer import runtime de 
`@ct/pumpfun` a partir do `dist/` quebra com `ERR_MODULE_NOT_FOUND` at├® o build rodar. (Hoje o impacto ├® latente: 
`git grep` mostra que nenhum pacote consome `@ct/pumpfun` ainda ÔÇö mas o artefato emitido pelo gate ├® incorretamente 
formado.)

**Como reproduzir:** `npm run typecheck` na raiz ÔåÆ inspecionar 
`packages/pumpfun/dist/generated/pump/instructions/buy.js` ÔåÆ imports `./accounts` sem extens├úo.

**Sugest├úo:** ou tornar `fix-esm-imports` parte do pipeline de emit (ex.: `tsc -b` com `noEmit` no typecheck e emit 
s├│ no build), ou gerar os clientes codama j├í com `imports: "extension"` (renderers-js suporta), eliminando a 
necessidade do p├│s-processo.

---

### LOW ÔÇö D-1: `package.json` reescrito com BOM + formata├º├úo an├┤mala (higiene de encoding)

**Arquivo:** `packages/pumpfun/package.json:1`

**Evid├¬ncia:** o diff mostra `+´╗┐{` ÔÇö BOM U+FEFF no in├¡cio ÔÇö e indenta├º├úo dupla (`"name":  "@ct/pumpfun"`) em 
todo o arquivo, padr├úo de ferramenta de encoding corrompida (mesma classe do incidente registrado em AGENTS.md 
┬º8.3.6, 2026-09-23). npm tolera BOM, mas o arquivo deve ser regravado limpo (UTF-8 sem BOM, formata├º├úo padr├úo do 
repo) para evitar recorr├¬ncia e diffs ruidosos.

**Sugest├úo:** reescrever via ferramenta de arquivo UTF-8 e conferir `format:check`.

---

### LOW ÔÇö D-2: claims do commit message n├úo batem com o conte├║do

**Evid├¬ncia:**
- "15 testes adversariais" ÔÇö o arquivo tem **14** `it()` (4 positivos + 9 adversariais + 1 discriminadores).
- "fixtures reais" (teste linha 90) ÔÇö os endere├ºos s├úo sint├®ticos gerados (`A('M', 44)`), exceto o wSOL 
hardcoded; n├úo h├í fixture real de mainnet.
- "nunca throw em dados hostis" ÔÇö verdadeiro no `catch`, mas o problema real (A-1) ├® retorno `null` silencioso para 
dados **v├ílidos**; a docstring do `decode.ts` enfatiza "null nunca throw" mas n├úo adverte que null tamb├®m significa 
"classe de instru├º├úo n├úo suportada/ignorada" (buyV2/sellV2/buyExactSolIn tamb├®m caem em null mudo). Considerar 
gravar m├®trica de nulls com motivo, dado o pipeline de sinais ├á jusante.

**Sugest├úo:** alinhar mensagem de commit/claims com o conte├║do; planejar teste com fixture real de mainnet 
(assinatura de sell de boneca gravitacional) quando o pipeline de ingestion existir.

---

## TESTES EXECUTADOS (tentativas de quebra)

1. **Verifica├º├úo de proveni├¬ncia (passou):** blobs SHA das IDLs vendored (`pump.json` = `2f1c65d4ÔÇª`, 
`pump_amm.json` = `5aaae770ÔÇª`) conferem **byte-a-byte** com o commit `81091419e4457566469d4e2a27f64ed84d42419c` do 
`pump-fun/pump-public-docs` via GitHub API ÔåÆ pin em `sources.ts` ├® aut├¬ntico, nada inventado.
2. **Endere├ºos de programa (passou):** pump `6EF8rrecthÔÇªF6P` e PumpSwap 
`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` confirmados por m├║ltiplas fontes independentes (pump-public-docs, 
solanatracker guide, docs.rs pump-swap-sdk).
3. **Discriminadores (passou):** pump/AMM buy = `[102,6,61,18,1,218,235,234]`, sell = `[51,230,133,164,1,127,131,173]` 
ÔÇö conferem com sighashes on-chain conhecidos; desambigua├º├úo por programId correta (buy e sell t├¬m o mesmo sighash 
nos dois programas).
4. **Campos de instru├º├úo (passou):** `amount/maxSolCost/minSolOutput` (pump) e 
`baseAmountOut/maxQuoteAmountIn/baseAmountIn/minQuoteAmountOut` (AMM) conferem com a IDL ap├│s cameliza├º├úo codama.
5. **├ìndices de contas (passou parcialmente):** mint=2, curve=3, user=6 (pump); pool=0, user=1, baseMint=3, 
quoteMint=4 (AMM) conferem com a IDL ÔÇö mas o **m├¡nimo** de contas est├í errado (A-1).
6. **Depend├¬ncias (passou):** todas as 5 novas deps existem no registry npm (nada inventado); `zod@3.25.76` j├í est├í 
no lockfile.
7. **Lockfile (FALHOU):** `npm ci` quebraria (B-1). N├úo executei `npm install`/`npm ci`/`vitest` porque isso 
modificaria `package-lock.json` (proibido nesta etapa) e o ambiente master n├úo tem as deps novas.
8. **Contagem de contas vs gates (FALHOU):** demonstrado em A-1 por aritm├®tica da pr├│pria IDL vendored.

## O QUE N├âO FOI POSS├ìVEL VERIFICAR

- Execu├º├úo real de `npm run lint/typecheck/test` neste commit (lockfile dessincronizado impede `npm ci`; ambiente 
atual n├úo possui codama/@solana/kit@8). O veredito de testes "verdes" do produtor n├úo ├® reproduz├¡vel a partir do 
estado commitado ÔÇö por si s├│ um problema de reprodutibilidade (gate de fase).
- Correspond├¬ncia exata entre a IDL (que diz sell=14/21 contas) e as transa├º├Áes reais de mainnet (o AMM, per 
solanatracker, ├ás vezes anexa contas extras ÔÇö o que salvaria o AMM sell por acaso, mas n├úo o pump sell). Requer 
fixture de assinatura real de mainnet para fechar.
- Comportamento do decoder frente a `buyV2`/`sellV2`/`buyExactSolIn` em uso corrente na UI do pump.fun ÔÇö retorna 
null mudo (design aceit├ível para F1.5, mas n├úo medido).

---

VERDICT: REJEITADO
[0m
The previous review (d016b8b) flagged a CRITICAL A-1 about the account-count gate killing SELL paths ÔÇö I need to verify whether commit 38cf505 actually contains that fix. First, let me confirm the instructionIndex correlation and lockfile state:
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/normalizer.ts; git show 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa:package-lock.json | Select-String -Pattern 
'"@ct/pumpfun"|node_modules/codama|"codama"|node_modules/@solana/kit' | Select-Object -First 10
/**
 * Normalizer ÔÇö converte notifica├º├Áes cruas (wire) em NormalizedEvent parcial.
 *
 * IMPORTANTE: o ENRIQUECIMENTO (parse de instru├º├Áes para classificar
 * BUY/SELL/TRANSFER, extrair token_mint real, amounts, price etc.) ├®
 * responsabilidade de F1.5 / fases posteriores. Nesta fase, todo campo que
 * n├úo est├í diretamente dispon├¡vel na notifica├º├úo crua fica `null` e
 * `action` fica 'UNKNOWN' ÔÇö nunca estimar silenciosamente (AGENTS.md ┬º2).
 */
import { randomUUID } from 'node:crypto';
import type { NormalizedEvent } from '@ct/types';
import { parseRawNotification } from './schemas.js';

export type NormalizeResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: Error };

export function normalizeRawNotification(
  input: unknown,
  source: string,
  detectedAt: number = Date.now(),
): NormalizeResult {
  const parsed = parseRawNotification(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: new Error(
        `VALIDATION_ERROR: notifica├º├úo crua inv├ílida ÔÇö ${parsed.error.message}`,
      ),
    };
  }
  const raw = parsed.data;

  // Enriquecimento (BUY/SELL, token_mint real, amounts) ├® F1.5+.
  // Campos indispon├¡veis permanecem null; action permanece UNKNOWN.
  const event: NormalizedEvent = {
    event_id: randomUUID(),
    correlation_id: randomUUID(), // propaga├º├úo cross-stack refinada em F1.5
    source,
    wallet: raw.wallet,
    signature: raw.signature,
    instruction_index: raw.instruction_index,
    slot: raw.slot,
    block_time: raw.block_time ?? null,
    detected_at: detectedAt,
    processed_at: null,
    token_mint: 'UNKNOWN',
    action: 'UNKNOWN',
    sol_amount: null,
    token_amount: null,
    price: null,
    market_cap: null,
    liquidity: null,
    latency_ms: null,
  };
  return { ok: true, event };
}

        "codama": "bin/cli.cjs"
    "node_modules/@solana/kit": {
    "node_modules/codama": {
        "codama": "bin/cli.cjs"
      "name": "@ct/pumpfun",
        "codama": "^1.11.0",
    "packages/solana/node_modules/@solana/kit": {
    "packages/solana/node_modules/@solana/kit/node_modules/@solana/accounts": {
    "packages/solana/node_modules/@solana/kit/node_modules/@solana/accounts/node_modules/@solana/codecs-core": {
    "packages/solana/node_modules/@solana/kit/node_modules/@solana/accounts/node_modules/@solana/codecs-strings": {
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/database/prisma/migrations/20260924142844_f15_enri
chment/migration.sql
-- F1.5 enrichment: colunas nullable em "ObservedEvent".
-- Eventos antigos e nao decodificaveis permanecem NULL/UNKNOWN (nunca inferidos).
ALTER TABLE "ObservedEvent"
  ADD COLUMN "direction" TEXT,
  ADD COLUMN "amountSol" DECIMAL(65,30),
  ADD COLUMN "tokenAmount" DECIMAL(65,30),
  ADD COLUMN "mint" TEXT,
  ADD COLUMN "counterparty" TEXT,
  ADD COLUMN "enrichSource" TEXT,
  ADD COLUMN "enrichedAt" TIMESTAMP(3),
  ADD COLUMN "enrichAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ObservedEvent_mint_idx" ON "ObservedEvent"("mint");
CREATE INDEX "ObservedEvent_eventType_idx" ON "ObservedEvent"("eventType");
[0m
## Objective
- Perform an adversarial code review of commit `38cf505ee228a35eb4dba6fae1e301e8feaeacfa` (branch `sprint/f1-5-enrichment`) of the `solana-copytrade-engine` repo, per `.agents/code-reviewer.md` and `AGENTS.md`.
- Deliver a verdict line (`VERDICT: APROVADO` / `VERDICT: REJEITADO`) followed by findings with severity CRITICAL/HIGH/MEDIUM/LOW. Do not modify code or commit.

## Important Details
- Review criteria: bugs, errors, incompatibilities, AGENTS.md violations, missing tests. Review is in Portuguese (user prompt: "Revise ADVERSARIALMENTE... Termine com VERDICT..."), but analysis work has been conducted in English.
- Commit `38cf505` adds: `enricher.ts`, `enrich-runner.ts`, `index.ts` wiring, `retention.ts` (opt-in purge), `instance-lock.ts`, `enricher.test.ts`/`instance-lock.test.ts`/`retention.test.ts`, `scripts/f15-backfill.mjs`, `scripts/f15-fixtures.mjs`, docs (ADR-025, handoff, roadmap, research/f15 artifacts), BOM+reformat of `package.json`/`tsconfig.json`, eslint/gitignore/check-secrets changes. Removal of previous commits depended on by this commit: `@ct/pumpfun` (7d7e3d1), helius-provider + `maxSupportedTransactionVersion=1` (20d93cf), ObservedEvent enrichment schema + TOCTOU repos (3d6c9db).
- Previous reviews (on master): `3838e2f` REJEITADO `20d93cf`, `b5bb013` REJEITADO `3d6c9db`, `b2a2048` REJEITADO `7d7e3d1`. Commit message claims "Resolve: reviews 5299d25*, dddb30b1/c438ef1c, 2ab477f MEDIUM fixtures" ÔÇö 2ab477f re-review (direction/user/mint) done; amounts never compared to Helius Enhanced (claim of "1:1" not fully met).
- Gate scripts: root `lint = eslint . --ext .ts,.tsx --max-warnings 0` (scripts/*.mjs NOT linted ÔåÆ console usage there is fine); `typecheck = tsc -b`; `test = vitest run --passWithNoTests`.
- Worktree `C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment` at `73eac5e` (38cf505 is ancestor); has node_modules; has UNCOMMITTED changes in `packages/pumpfun/src/decode.ts` + `decode.test.ts` (review-fix adding 14-account sell and 21-account amm sell tests ÔÇö "gates por contagem canonica da IDL (review A-1)"). Running gates in that worktree tests the uncommitted state, not the committed state.
- Vendored IDL canonical account counts verified: `pump.buy`=16, `pump.sell`=14, `pump_amm.buy`=23, `pump_amm.sell`=21.
- Committed `decode.ts`: `PUMP_MIN_ACCOUNTS = 16`, `AMM_MIN_ACCOUNTS = 22`, gate `accounts.length < MIN` returns null BEFORE discriminator check ÔåÆ pump.sell (14) and pump_amm.sell (21) are always rejected under committed code ÔÇö yet `docs/research/f15/backfill-report.json` lists `pump-decoder-v1:pump_sell` = 1580 rows ÔåÆ evidence generated with the uncommitted fixed code, not the committed code.
- `RpcProvider.getTransaction` (packages/solana): passes `maxSupportedTransactionVersion: 1`, per-request timeout 10s, retry/backoff up to ~6 attempts; returns `payload.result` directly ÔåÆ can resolve `null` (not-yet-indexed / pruned / failed tx).
- Repos (`packages/database/src/repositories/observed-events.ts` at commit): `findUnenriched` = enrichedAt null + attempts < max, order receivedAt asc, take limit; `markEnriched` and `markUndecodable` use `updateMany` guarded on `enrichedAt: null`, `markEnriched` throws `RepositoryError` when count 0 (TOCTOU); `incrementEnrichAttempt` has no enrichedAt guard.
- `index.ts`: `lock.acquire()` first; `main.ts` catches `start()` rejection ÔåÆ stderr + `process.exit(1)`.
- Backfill report: seen=10000, enriched=1914, undecodable=8086, retried=0, coverage 19.1%, elapsed 4139s (Ôëê10k/69min vs ~1,923,605 rows with `enrichSource: null` ÔåÆ backlog can't converge).

## Work State
### Completed
- `git show 38cf505... --stat` and selected file diffs reviewed: `enricher.ts` (partial ÔÇö output was truncated), root `package.json`, `.eslintrc.cjs`, `instance-lock.ts`, `retention.ts` (partial), `enricher.test.ts`, `instance-lock.test.ts`, `index.ts`, `f15-backfill.mjs`/`f15-fixtures.mjs` (partial), check-secrets diff, backfill-report.json, f15 README, ADR-025, pumpfun `decode.ts`/`index.ts`, RpcProvider head, database repos, IDL instruction account counts.
- Verified findings to date:
  - HIGH: committed decode.ts account-count gate (16/22) rejects all canonical pump.sell (14) and pump_amm.sell (21); backfill evidence (pump_sell=1580) inconsistent with committed code ÔåÆ evidence reproducibility violation (AGENTS.md priority).
  - HIGH: `getTransaction` resolving `null` (transient RPC lag / pruned) ÔåÆ `markUndecodable('no-decodable-instruction')` permanently; no distinction tx-not-found vs genuinely no swap; test only covers throwing fetcher.
  - HIGH: enricher ignores row's `instructionIndex`; decodes first decodable swap of the whole tx ÔåÆ multi-swap txs mislabel direction/amounts on subsequent rows (dedup key is signature+instructionIndex+wallet).
  - MEDIUM: `EnrichRunner` `setInterval(2000ms)` may overlap batch execution (25 ├ù sleepMs 120 + RPC Ôëê >2s) ÔåÆ concurrent `findUnenriched` returns same rows ÔåÆ double RPC + double attempts, silent drop at maxAttempts; no in-flight guard (unlike RetentionJob).
  - MEDIUM: `Enricher.enrich` catch-all ÔåÆ 'retry'; swallows DATABASE_ERROR (markEnriched TOCTOU count=0 throws) and programmer errors, misclassified as RPC_ERROR.
  - MEDIUM: `retention.ts` `deleteMany` single unbounded DELETE (no batch limits, no enrichStatus guard, no replay/backtest safeguard) contradicting its own header ("em lotes", "nunca apagar..."); opt-in via `RETENTION_RAW_ENABLED` default off, RETENTION_RAW_DAYS default 3.
  - MEDIUM: `base58ToBytes` off-by-one on all-zero input: "1" ÔåÆ `[0,0]` (double 0 from `n===0n` branch plus leading-'1' unshift); `bytes.reverse().reverse()` is a no-op; zero case untested in `enricher.test.ts` (round-trip tests start with nonzero bytes).
  - MEDIUM: fixtures gate artifact: 5/10 divergences, incl. unresolved `directionEq` mismatch on real pumpswap_sell (2uF4Xh61rDwxnG9woyxsVQP7zuA6kLFpb3NvnRQeoiSd) with tokenAmount=null; README attributes to semantic classes/multi-hop ÔÇö assertion not proven by artifact; amounts not compared to Helius Enhanced.
  - MEDIUM: non-wSOL-quote PumpSwap pools: `tokenAmount=null` and `solAmount` carries base token amount (mislabel); with base=wSOL pools direction inversion mapping only covers base-side; unvalidated semantics for the general case.
  - LOW: package.json/tsconfig.json rewritten with BOM (U+FEFF) + 12-space indent ÔÇö exactly the prohibited encoding-corruption pattern in AGENTS.md (Set-Content/Out-File incident 2026-09-23); npm tolerates BOM so low functional impact.
  - LOW: `instance-lock.test.ts` contains empty/stub test `it('lock recente com PID vivo rejeita (nao stale)')` ÔÇö pending, silently skipped.
  - LOW: `InstanceLock.acquire()` EEXIST race between stale-unlink and `writeFileSync('wx')` ÔåÆ raw throw (not CONFIG_ERROR), fail-closed.
  - LOW: new env vars (RETENTION_RAW_ENABLED/DAYS, INGESTION_LOCK_PATH, enricher/runner config) not documented in `.env.example` (unchanged by commit).
  - INFO/LOW: `check-secrets` now exempts all `docs/research/**/*.json` (broad carve-out, documented as on-chain public data).
  - Scaling observation: ingestion outpaces enrichment (Ôëê8 req/s vs growing 1.9M-row backlog; retention on would destroy un-enriched RAW rows).
- `AGENTS.md` and `.agents/code-reviewer.md` were provided in system prompt context (regras: dados on-chain hostis, encoding UTF-8/BOM prohibition, n├úo remover testes, evid├¬ncias/reprodutibilidade, classifica├º├úo de erros RPC_ERROR/DATABASE_ERROR).

### Active
- Investigation incomplete in: full body of `enricher.ts`, `enrich-runner.ts`, `retention.ts`, `scripts/f15-backfill.mjs`, `scripts/f15-fixtures.mjs` (tails were truncated), docs (handoff.md, roadmap.md diff), and whether the committed `decode.ts` exact gate lines sit before discriminator match.
- Not yet run: `npm run typecheck`, `npm test`, `npm run lint` in the f1-5 worktree (would reflect uncommitted decode.ts state ÔÇö must be interpreted accordingly or run against a clean checkout of 38cf505).
- Review loop appears not yet performed for this commit on master (master HEAD 3838e2f is review of 20d93cf).

### Blocked
- (none) ÔÇö worktree is available with node_modules if gate runs are attempted; no external blockers identified.

## Next Move
1. Read remaining full sources: `enricher.ts`, `enrich-runner.ts`, `retention.ts`, `scripts/f15-backfill.mjs`, `scripts/f15-fixtures.mjs`, and docs diffs (handoff/roadmap) to complete the findings list.
2. Confirm committed `decode.ts` gate ordering and that 14-/21-account sells are rejected pre-discriminator (read `decode.ts` around `PUMP_MIN_ACCOUNTS`).
3. (Optional) Run `npm run typecheck` / `npm test` in `C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment`, explicitly noting the uncommitted decode.ts state.
4. Write final answer: findings list (severities) then exactly `VERDICT: REJEITADO` (expected, strictly per evidence so far: gate-evidence/code inconsistency, permanent-undecodable on null tx, instructionIndex correlation loss, missing tests for those paths).

## Relevant Files
- `packages/pumpfun/src/decode.ts`: account-count gate (16/22) rejects canonical pump.sell/amm.sell; wSOL/non-wSOL quote mapping; `mapDirection` inversion.
- `packages/pumpfun/idl/pump.json`, `idl/pump_amm.json`: canonical account counts (sell=14/21) verifying the selection-bias finding.
- `services/data-ingestion/src/enricher.ts` + `enricher.test.ts`: base58ToBytes zero-case bug; null-tx undecodable path; instructionIndex ignored; catch-all retry.
- `services/data-ingestion/src/enrich-runner.ts`: 2s interval vs 25├ù120ms batches ÔåÆ runner overlap.
- `services/data-ingestion/src/retention.ts`: unbounded deleteMany, no enrichStatus guard.
- `services/data-ingestion/src/instance-lock.ts` (+ test): EEXIST race; empty stub test.
- `services/data-ingestion/src/index.ts` + `main.ts`: wiring, boot failure handling.
- `packages/database/src/repositories/observed-events.ts`: findUnenriched/markEnriched/markUndecodable/incrementEnrichAttempt semantics and TOCTOU guards.
- `packages/solana/src/rpc-provider.ts`: getTransaction returns `payload.result` (may be null), 10s timeout, maxSupportedTransactionVersion=1.
- `scripts/f15-backfill.mjs`, `scripts/f15-fixtures.mjs`: gate scripts (console not linted).
- `docs/research/f15/backfill-report.json`, `fixtures-report.json`, `README.md`: 19.1% coverage; 5/10 divergences; README claims vs artifact inconsistencies.
- `docs/architecture/adr/ADR-025-fatos-runtime-f15-decoder-enrichment.md`: FACT on getTransaction version=1, Helius 1-address-per-subscription, codama ts-nocheck, OptionBool tuple.
- `package.json`, `tsconfig.json` (per-service), `.eslintrc.cjs`, `infrastructure/scripts/check-secrets.mjs`: BOM/reformat regression; lint scope; docs/research json exemption.
- Worktree: `C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment` (uncommitted decode.ts fix vs commit 38cf505 state).
Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/enricher.ts
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
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/enrich-runner.ts; 
"=====RETENTION====="; git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/retention.ts
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
=====RETENTION=====
/**
 * Retention ÔÇö pol├¡tica de reten├º├úo da camada RAW (ADR-024, documento fonte ┬º63).
 *
 * FACT medido no smoke F1: ~568 MB/40min no fixture Pump.fun. Sem reten├º├úo,
 * o disco esgota em dias. Pol├¡tica inicial: apagar ObservedEvent mais velhos
 * que RETENTION_RAW_DAYS (default 3 dias), em lotes, fora do caminho quente.
 *
 * Fases futuras compactam RAW ÔåÆ NORMALIZED ÔåÆ FEATURES ÔåÆ AGGREGATES; aqui ├®
 * apenas o al├¡vio bruto. NUNCA apagar dados necess├írios ao replay/backtest
 * sem uma camada agregada persistida antes (d├®bito documentado em F5).
 */
import { setInterval, clearInterval } from 'node:timers';

export interface RetentionRepo {
  deleteMany(args: { where: { receivedAt: { lt: Date } } }): Promise<{ count: number }>;
}

export interface LoggerLike {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export class RetentionJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repo: RetentionRepo,
    private readonly logger: LoggerLike,
    private readonly retentionDays = Number(process.env['RETENTION_RAW_DAYS'] ?? 3),
    private readonly intervalMs = Number(process.env['RETENTION_INTERVAL_MS'] ?? 3_600_000),
    // ADR-024 + gate F1.5: purge de RAW NUNCA ├® default-on. Ligar s├│ de forma
    // expl├¡cita (RETENTION_RAW_ENABLED=true) ÔÇö F1.5 aumenta volume e apagar
    // RAW sem agregados persistidos destr├│i o material de replay/fixtures.
    private readonly enabled = (process.env['RETENTION_RAW_ENABLED'] ?? 'false') === 'true',
  ) {}

  start(): void {
    if (this.timer !== null) return;
    if (!this.enabled) {
      this.logger.info(
        'retention DESLIGADA por padr├úo (ADR-024 ÔÇö F1.5 aumenta volume; ligar via RETENTION_RAW_ENABLED=true)',
      );
      return;
    }
    if (this.retentionDays <= 0) {
      this.logger.warn('reten├º├úo DESLIGADA (RETENTION_RAW_DAYS <= 0) ÔÇö risco de disco', {
        errorClass: 'CONFIG_ERROR',
      });
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    this.logger.info('retention job ativo', {
      retentionDays: this.retentionDays,
      intervalMs: this.intervalMs,
    });
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0; // sobreposi├º├úo defensiva
    this.running = true;
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
      const { count } = await this.repo.deleteMany({ where: { receivedAt: { lt: cutoff } } });
      if (count > 0) {
        this.logger.info('retention: RAW antigos removidos', { deleted: count, cutoff });
      }
      return count;
    } catch (err) {
      this.logger.error('retention falhou ÔÇö DATABASE_ERROR', {
        errorClass: 'DATABASE_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/index.ts; "=====CONFIG====="; 
git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:services/data-ingestion/src/config.ts 2>$null | Select-Object -First 
60
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
=====CONFIG=====
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:packages/pumpfun/src/decode.ts
/**
 * decode.ts ÔÇö decoder F1.5 sobre os clientes gerados por codama a partir da
 * IDL oficial pump-fun/pump-public-docs (ADR-016: fonte oficial; ADR-020:
 * codama em vez de discriminadores ├á m├úo).
 *
 * Regras (dados on-chain hostis):
 * - NUNCA lan├ºa exce├º├úo em input adversarial ÔÇö retorna null.
 * - Endere├ºos validados com allowlist base58 (RT-004/006 mantidos fechados).
 * - Valores num├®ricos da instru├º├úo s├úo PAR├éMETROS/LIMITES da instru├º├úo
 *   (amount = tokens; em buy, sol = maxSolCost/maxQuoteAmountIn; em sell,
 *   sol = minSolOutput/minQuoteAmountOut) ÔÇö N├âO s├úo valores realizados.
 *   Valores realizados v├¬m de balance changes (fora do escopo deste decoder).
 */
import { z } from 'zod';
import {
  BUY_DISCRIMINATOR as PUMP_BUY,
  SELL_DISCRIMINATOR as PUMP_SELL,
  getBuyInstructionDataDecoder as pumpBuyDecoder,
  getSellInstructionDataDecoder as pumpSellDecoder,
} from './generated/pump/instructions/index.js';
import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
import {
  BUY_DISCRIMINATOR as AMM_BUY,
  SELL_DISCRIMINATOR as AMM_SELL,
  getBuyInstructionDataDecoder as ammBuyDecoder,
  getSellInstructionDataDecoder as ammSellDecoder,
} from './generated/pump_amm/instructions/index.js';
import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const addressSchema = z.string().regex(BASE58);

export interface DecodedSwap {
  kind: 'pump_buy' | 'pump_sell' | 'pumpswap_buy' | 'pumpswap_sell';
  direction: 'buy' | 'sell';
  mint: string;
  user: string;
  /** Bonding curve (pump.*) ou pool AMM (pumpswap.*). */
  counterparty: string;
  /** Tokens em unidades base (instru├º├úo `amount`/`baseAmount*`). */
  tokenAmount: string | null;
  /** SOL em lamports ÔÇö LIMITE da instru├º├úo (maxSolCost / minSolOutput etc.), n├úo realizado. */
  solAmount: string | null;
}

function discEq(data: ArrayLike<number>, disc: ArrayLike<number>): boolean {
  if (data.length < 8 || disc.length < 8) return false;
  for (let i = 0; i < 8; i++) if (data[i] !== disc[i]) return false;
  return true;
}

function validAddr(a: unknown): a is string {
  return typeof a === 'string' && addressSchema.safeParse(a).success;
}

/** Contas m├¡nimas esperadas: pump.buy/sell = 16; pump_amm.buy/sell = 22. */
const PUMP_MIN_ACCOUNTS = 16;
const AMM_MIN_ACCOUNTS = 22;

export function decodePumpInstruction(
  programId: string,
  data: ArrayLike<number>,
  accounts: string[],
): DecodedSwap | null {
  try {
    // Normaliza para Uint8Array: os decoders do codama exigem Uint8Array.
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(Array.from(data));
    if (programId === PUMP_PROGRAM_ADDRESS) {
      if (accounts.length < PUMP_MIN_ACCOUNTS) return null;
      // IDL: mint=2, bondingCurve=3, user=6
      const mint = accounts[2];
      const counterparty = accounts[3];
      const user = accounts[6];
      if (!validAddr(mint) || !validAddr(counterparty) || !validAddr(user)) return null;

      if (discEq(bytes, PUMP_BUY)) {
        const d = pumpBuyDecoder().decode(bytes);
        return {
          kind: 'pump_buy',
          direction: 'buy',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.maxSolCost.toString(),
        };
      }
      if (discEq(bytes, PUMP_SELL)) {
        const d = pumpSellDecoder().decode(bytes);
        return {
          kind: 'pump_sell',
          direction: 'sell',
          mint: mint!,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: d.amount.toString(),
          solAmount: d.minSolOutput.toString(),
        };
      }
      return null;
    }

    if (programId === PUMP_AMM_PROGRAM_ADDRESS) {
      if (accounts.length < AMM_MIN_ACCOUNTS) return null;
      // IDL: pool=0, user=1, baseMint=3, quoteMint=4
      const counterparty = accounts[0];
      const user = accounts[1];
      const baseMint = accounts[3];
      const quoteMint = accounts[4];
      if (!validAddr(baseMint) || !validAddr(quoteMint) || !validAddr(counterparty) || !validAddr(user)) return null;

      const WSOL = 'So11111111111111111111111111111111111111112';
      // Normaliza├º├úo pelo lado do TOKEN (review 2ab477f/fixtures): se a base
      // do pool for wSOL, a sem├óntica buy/sell da instru├º├úo se inverte do ponto
      // de vista do token (usu├írio d├í wSOL e recebe token => buy do token).
      const quoteIsWsol = quoteMint === WSOL;
      const baseIsWsol = baseMint === WSOL;
      const tokenMint = quoteIsWsol ? baseMint! : baseIsWsol ? quoteMint! : baseMint!;

      const mapDirection = (ix: 'buy' | 'sell'): 'buy' | 'sell' => {
        if (baseIsWsol) return ix === 'buy' ? 'sell' : 'buy'; // invertido
        return ix;
      };
      const mapKind = (ix: 'buy' | 'sell'): DecodedSwap['kind'] =>
        mapDirection(ix) === 'buy' ? 'pumpswap_buy' : 'pumpswap_sell';

      if (discEq(bytes, AMM_BUY)) {
        const d = ammBuyDecoder().decode(bytes);
        // quoteIn = wSOL gasto (se quote=wSOL); token = baseAmountOut.
        return {
          kind: mapKind('buy'),
          direction: mapDirection('buy'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountOut.toString() : null,
          solAmount: quoteIsWsol ? d.maxQuoteAmountIn.toString() : d.baseAmountOut.toString(),
        };
      }
      if (discEq(bytes, AMM_SELL)) {
        const d = ammSellDecoder().decode(bytes);
        // baseIn = token vendido (se quote=wSOL); quoteOut = wSOL recebido.
        return {
          kind: mapKind('sell'),
          direction: mapDirection('sell'),
          mint: tokenMint,
          user: user!,
          counterparty: counterparty!,
          tokenAmount: quoteIsWsol ? d.baseAmountIn.toString() : null,
          solAmount: quoteIsWsol ? d.minQuoteAmountOut.toString() : d.baseAmountIn.toString(),
        };
      }
      return null;
    }

    return null; // programa desconhecido ÔÇö UNKNOWN, nunca inferido
  } catch {
    // Dados hostis/truncados: decode falhou ÔÇö null, nunca throw.
    return null;
  }
}
[0m
The committed decoder still has the A-1 CRITICAL (gate 16/22 before discriminator; sell=14/21 always rejected) while the committed backfill report claims `pump_sell=1580` ÔÇö evidenceÔåöcode mismatch confirmed. Now let me run the gates on a **clean checkout** of the commit (the worktree has the uncommitted fix, which would mask the bug):
[0m$ [0mnode --version; npm --version; git worktree add "C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505" 
38cf505ee228a35eb4dba6fae1e301e8feaeacfa 2>&1 | Select-Object -Last 3
v25.7.0
11.10.1
git : Preparing worktree (detached HEAD 38cf505)
No linha:1 caractere:32
+ ...  --version; git worktree add "C:\Users\enzo\AppData\Local\Temp\openco ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Preparing workt...d HEAD 38cf505):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
HEAD is now at 38cf505 feat(f1.5): enricher+runner+wiring, retention opt-in, lock por idade, scripts de gate, docs
[0m
[0m$ [0mnpm ci 2>&1 | Select-Object -Last 15
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security 

added 438 packages, and audited 459 packages in 12s

67 packages are looking for funding
  run `npm fund` for details

2 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be 
purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support 
for other options.
[0m
`npm ci` passed in 12s ÔÇö lockfile in sync (B-1 from previous review resolved). Now the gates:
[0m$ [0mnpm audit --omit=dev 2>&1 | Select-Object -Last 25
found 0 vulnerabilities
[0m
[0m$ [0mnpm run typecheck 2>&1 | Select-Object -Last 8
> solana-copytrade-engine@0.1.0 typecheck
> tsc -b --pretty
[0m
[0m$ [0mnpm test 2>&1 | Select-Object -Last 30
541 |          mint: getAddressFromResolvedInstructionAccount('mint', accounts.mint.value),
 [32mÔ£ô[39m services/data-ingestion/src/enricher.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 
13[2mms[22m[39m
 [32mÔ£ô[39m packages/pumpfun/src/decode.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32mÔ£ô[39m services/data-ingestion/src/dedup.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32mÔ£ô[39m tests/property/dedup.property.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 67[2mms[22m[39m
 [32mÔ£ô[39m packages/solana/src/backoff.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 123[2mms[22m[39m
 [32mÔ£ô[39m services/data-ingestion/src/security-fixes.test.ts [2m([22m[2m16 tests[22m[2m)[22m[33m 
1623[2mms[22m[39m
   [33m[2mÔ£ô[22m[39m RT-005 - dedup sob concorrencia (contadores fieis)[2m > [22mproperty: bursts arbitrarios 
concorrentes nunca inflam contadores [33m 1543[2mms[22m[39m

[2m Test Files [22m [1m[32m16 passed[39m[22m[90m (16)[39m
[2m      Tests [22m [1m[32m106 passed[39m[22m[90m (106)[39m
[2m   Start at [22m 02:47:30
[2m   Duration [22m 6.57s[2m (transform 3.55s, setup 0ms, collect 23.71s, tests 2.15s, environment 4ms, prepare 
7.63s)[22m

    |          ^
542 |        },
543 |        {
[39m
  Plugin: [35mvite:esbuild[39m
  File: 
[36mC:/Users/enzo/AppData/Local/Temp/opencode/wt-38cf505/packages/pumpfun/src/generated/pump/instructions/migrate.ts[
39m
[2m02:47:33[22m [33m[1m[vite][22m[39m [33m[2m(ssr)[22m[39m [33mwarning: [33mDuplicate key "mint" in object 
literal[33m
613 |          pool: getAddressFromResolvedInstructionAccount('pool', accounts.pool.value),
614 |          mint: getAddressFromResolvedInstructionAccount('mint', accounts.mint.value),
615 |          mint: getAddressFromResolvedInstructionAccount('mint', accounts.mint.value),
    |          ^
616 |        },
617 |        {
[39m
  Plugin: [35mvite:esbuild[39m
  File: 
[36mC:/Users/enzo/AppData/Local/Temp/opencode/wt-38cf505/packages/pumpfun/src/generated/pump/instructions/migrate.ts[
39m
[0m
[0m$ [0m$f="packages/pumpfun/dist/generated/pump/instructions/buy.js"; Test-Path $f; if (Test-Path $f) { 
Select-String -Path $f -Pattern "^import" | Select-Object -First 6 Line }
True

Line                                                                                                                   
----                                                                                                                   
import { combineCodec, fixDecoderSize, fixEncoderSize, getAddressEncoder, getBytesDecoder, getBytesEncoder, getProgr...
import { getAccountMetaFactory, getAddressFromResolvedInstructionAccount, } from '@solana/program-client-core';        
import { findBondingCurvePda, findEventAuthorityPda, findFeeConfigPda, findGlobalPda, findGlobalVolumeAccumulatorPda...
import { PUMP_PROGRAM_ADDRESS } from '../programs';                                                                    
import { getOptionBoolDecoder, getOptionBoolEncoder, } from '../types';
[0m
[0m$ [0mnpm run lint 2>&1 | Select-Object -Last 8
> solana-copytrade-engine@0.1.0 lint
> eslint . --ext .ts,.tsx --max-warnings 0
[0m
[0m$ [0mSelect-String -Path "packages/pumpfun/dist/index.js","packages/pumpfun/dist/decode.js" -Pattern 
"^import|^export" | Select-Object -First 12 Line, Filename; "---build scripts---"; Get-Content 
"packages/pumpfun/package.json" | Select-String -Pattern '"build"|"start"|fix-esm' ; Get-Content 
"services/data-ingestion/package.json" | Select-String -Pattern '"build"|"start"'
Line                                                                                                                   
----                                                                                                                   
export { PUMPFUN_DOC_SOURCE, PUMPFUN_IDL_SOURCE, PUMPFUN_IDL_SHA } from './sources.js';                                
export { decodePumpInstruction } from './decode.js';                                                                   
export { getBuyInstructionDataEncoder as PUMP_BUY_ENCODER_FOR_TESTS } from './generated/pump/instructions/index.js';   
export { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';                                             
export { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';                                     
import { z } from 'zod';                                                                                               
import { BUY_DISCRIMINATOR as PUMP_BUY, SELL_DISCRIMINATOR as PUMP_SELL, getBuyInstructionDataDecoder as pumpBuyDeco...
import { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';                                             
import { BUY_DISCRIMINATOR as AMM_BUY, SELL_DISCRIMINATOR as AMM_SELL, getBuyInstructionDataDecoder as ammBuyDecoder...
import { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';                                     
export function decodePumpInstruction(programId, data, accounts) {                                                     
---build scripts---
                    "build":  "tsc -b \u0026\u0026 node scripts/fix-esm-imports.mjs"                                   
                    "build":  "tsc -b"
[0m
[0m$ [0mnode -e "import('./packages/pumpfun/dist/decode.js').then(m=>console.log('OK', typeof 
m.decodePumpInstruction)).catch(e=>console.log('CRASH:', e.code, e.message.split('\n')[0]))"
CRASH: ERR_MODULE_NOT_FOUND Cannot find module 'C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505\packages\pumpfun\d
ist\generated\pump\instructions\addQuoteControlMint' imported from 
C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505\packages\pumpfun\dist\generated\pump\instructions\index.js
[0m
C-2 proven: the gate-emitted dist of `@ct/pumpfun` crashes under Node ESM (`ERR_MODULE_NOT_FOUND`). Now let me pin down the fixtures evidence claims before writing the verdict:
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/README.md | Select-Object -First 60; 
"=====FIXTURES-REPORT====="; git show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/fixtures-report.json 
2>$null | Select-Object -First 1
# F1.5 ÔÇö Evid├¬ncias do gate (enrichment)

## Fixtures (validacao 1:1 vs Helius Enhanced) ÔÇö RE-REVIEW 2026-09-25

- Rodada inicial (prematura): 16/16 por criterio raso (apenas `helius.type === SWAP`) ÔÇö **rejeitado** em 
`docs/reviews/2ab477f7*` (MEDIUM-2: ignora user/mint/direction/amounts).
- Rodada rigorosa: comparacao 1:1 com direction(=token-side), user==feePayer, mint em tokenTransfers. **Resultado:** 
sample=10, pumpswap=9, perfectMatches=5, divergences=5 (listadas no JSON).
  - Bug REAL encontrado e corrigido: pool PumpSwap com **base=wSOL** inverte a semantica buy/sell (direction muta pelo 
lado do token) ÔÇö fix em `decode.ts` + fixture real `62uhRP3sÔÇª` era pump_buy-de-wSOL exibido como sell pelo Helius.
  - Divergencias restantes = **classes semanticas**, nao erro de decode: `mintPresent` (Enhanced nem sempre lista mint 
do lado wSOL em tokenTransfers; heliusDir=null quando indeterminavel) e `directionEq` ocasional em multi-hop. 
Documentado, nunca engolido ÔÇö o JSON lista cada divergencia com campos.
- `fixtures-report.json` reescrito sem BOM em `docs/research/f15/`.

> ASSUMPTION documentada: eventos da subscricao da curva Pump.fun incluem muitos
> transfers/SYSTEM_PROGRAM que NAO sao swaps ÔÇö decodificar = UNKNOWN explicito
> e correto. A taxa de cobertura do backfill (abaixo) e consistente com isso.

## Backfill (one-shot, 10k eventos)

- `backfill-report.json`: seen=10000, enriched=1914 (**cobertura 19.1%** do lote),
  undecodable=8086 (transfers/creates/migrations sem instrucao de swap), retried=0, elapsedSec=4139.
- Breakdown: pump_buy=675, pump_sell=1580, pumpswap_sell=10 (ultimas medidas do lote).

## Bugs descobertos/validados no caminho (todos FIXED)

1. Endpoint Enhanced: `api.helius.dev` nao resolve no DNS local; use
   `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem barra antes de `?`).
2. getTransaction: transacoes podem ser `version: 1` ÔÇö `maxSupportedTransactionVersion: 1`.
3. Helius free: `logsSubscribe` aceita 1 endereco por subscription ÔÇö provider faz 1 sub/endereco.
4. Codama: `accept(renderVisitor)` e async ÔÇö script aguarda ambos antes de achatar; clientes gerados
   ficam com `@ts-nocheck` (postprocess documentado em `packages/pumpfun/codama.pump.mjs`).
=====FIXTURES-REPORT=====
{
[0m
[0m$ [0mgit show 38cf505ee228a35eb4dba6fae1e301e8feaeacfa:docs/research/f15/fixtures-report.json
{
  "at": "2026-09-25T04:01:22.876Z",
  "sample": 10,
  "pumpswapFixtures": 9,
  "pumpFixtures": 1,
  "perfectMatches": 5,
  "divergencesCount": 5,
  "probes": {
    "decoded": 10,
    "undecodable": 45,
    "errors": 58
  },
  "divergences": [
    {
      "signature": "18gsjP9rGMfZfEtspzW3wo217qfCMLMurP1RKwoiawzozugUnA3E1Mv2LCmKwfyjcy2C5CXCfwjXCLNJrNUY36s",
      "kind": "pumpswap_sell",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "44xtWfqJHffGtQCDPVsrNSUQsZHqEuMc4ktNowgVpump",
        "user": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw",
        "counterparty": "GsTVhFUwk6hwH9PaQipLna9KsXfu4h8ENUsCpB8wdtHG",
        "tokenAmount": "414750041004",
        "solAmount": "727895025"
      },
      "heliusDir": null,
      "feePayer": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw"
    },
    {
      "signature": "tg3pusCqXV29Pop4pCybRKVoUWJoYXqCYoiUAdstCtazFLSVBTNh4fytii9MLBwmGgjLCTpY7org9QDSPAimzJY",
      "kind": "pumpswap_sell",
      "mismatches": [
        "directionEq"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        "user": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS",
        "counterparty": "2uF4Xh61rDwxnG9woyxsVQP7zuA6kLFpb3NvnRQeoiSd",
        "tokenAmount": null,
        "solAmount": "21529728095"
      },
      "heliusDir": "buy",
      "feePayer": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS"
    },
    {
      "signature": "3ipBKg9Hf5oemkQc2Ftm7zBiCxkjhxZ9YW61Bgu491KYQCeFmotzzkThnK23EmGWFCw5NB2Gb7shyE2u6fqpuhs6",
      "kind": "pumpswap_sell",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "379246310276",
        "solAmount": "1040652818"
      },
      "heliusDir": null,
      "feePayer": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT"
    },
    {
      "signature": "5sCEF7pq4YpiVJBNDXe1G9zQv5PfszLRvg1V95t5UiRsBLLKgc2JK68ojnRToz9VD4F1Dx1xwPqfkc7PK5ViLcPT",
      "kind": "pumpswap_buy",
      "mismatches": [
        "mintPresent"
      ],
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "41n8gyoVAuDjZdUeHRGrPscG2DzJawDHpa1Y6VLV4VqJ",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "536446568993",
        "solAmount": "686657357"
      },
      "heliusDir": null,
      "feePayer": "41n8gyoVAuDjZdUeHRGrPscG2DzJawDHpa1Y6VLV4VqJ"
    },
    {
      "signature": "2FMmRXtRiyVbMV4Csv3Zz6XUcJmYqwGcCuJ1WrSUybRTM1iJGauqZ3qbyD7q3afVZzVJJcwcTBcACmT8SEESybTt",
      "kind": "pumpswap_sell",
      "mismatches": [
        "userEq"
      ],
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "CBXs6RDnfV93SvsAR9dUqeFj3tuFEM9bNJisnJ8Lpump",
        "user": "Gx32W57YqGYbrF7JQqyvqJAsSKm3BPxXo3gynguf3DsL",
        "counterparty": "E36fi2hUsjkiLJSLAXHwL6FSFnywEyqJ1GTM845rAL52",
        "tokenAmount": "40760213608",
        "solAmount": "0"
      },
      "heliusDir": "sell",
      "feePayer": "AgmLJBMDCqWynYnQiPCuj9ewsNNsBJXyzoUhD9LJzN51"
    }
  ],
  "results": [
    {
      "signature": "18gsjP9rGMfZfEtspzW3wo217qfCMLMurP1RKwoiawzozugUnA3E1Mv2LCmKwfyjcy2C5CXCfwjXCLNJrNUY36s",
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "44xtWfqJHffGtQCDPVsrNSUQsZHqEuMc4ktNowgVpump",
        "user": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw",
        "counterparty": "GsTVhFUwk6hwH9PaQipLna9KsXfu4h8ENUsCpB8wdtHG",
        "tokenAmount": "414750041004",
        "solAmount": "727895025"
      },
      "heliusDir": null,
      "feePayer": "DDHT3naWyb5s5vpbtRfoQtyXJGR7vtbQKvspA5FwusYw",
      "mismatches": [
        "mintPresent"
      ]
    },
    {
      "signature": "4pc34pU1bwCks9FPReyEu4y5WbVFjN36thGgN6rnBHASLmjwsd9xqNhoKAbCcragLGMCWR8ssFNhFdPvdcpd1Pod",
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "9B96MFgb3LVZdvXxHadtUKN2jK39amvHbuchZMTnwucH",
        "user": "FMJFEan1xKY7fu71Xxst61g1eR5RWLT7VWfamiy8qotZ",
        "counterparty": "6ugmRe8AVEWq543uC1n6d9hsw7WuercBJ7J9HEdHg1HM",
        "tokenAmount": null,
        "solAmount": "126330"
      },
      "heliusDir": "buy",
      "feePayer": "FMJFEan1xKY7fu71Xxst61g1eR5RWLT7VWfamiy8qotZ",
      "mismatches": []
    },
    {
      "signature": "tg3pusCqXV29Pop4pCybRKVoUWJoYXqCYoiUAdstCtazFLSVBTNh4fytii9MLBwmGgjLCTpY7org9QDSPAimzJY",
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        "user": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS",
        "counterparty": "2uF4Xh61rDwxnG9woyxsVQP7zuA6kLFpb3NvnRQeoiSd",
        "tokenAmount": null,
        "solAmount": "21529728095"
      },
      "heliusDir": "buy",
      "feePayer": "AcKSYGckD3RAAB9yhA1dVm6C9taSNMmEyzCZEbYoWiWS",
      "mismatches": [
        "directionEq"
      ]
    },
    {
      "signature": "3ipBKg9Hf5oemkQc2Ftm7zBiCxkjhxZ9YW61Bgu491KYQCeFmotzzkThnK23EmGWFCw5NB2Gb7shyE2u6fqpuhs6",
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "379246310276",
        "solAmount": "1040652818"
      },
      "heliusDir": null,
      "feePayer": "Dx7VEnLELVkXBiVYe6nqN62zJbYw9xAf9Jq5LpatZCCT",
      "mismatches": [
        "mintPresent"
      ]
    },
    {
      "signature": "5sCEF7pq4YpiVJBNDXe1G9zQv5PfszLRvg1V95t5UiRsBLLKgc2JK68ojnRToz9VD4F1Dx1xwPqfkc7PK5ViLcPT",
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "Bg75GaeTN7uVqtUEsquh61hwENeaA8TD5K8HwX4Lfomo",
        "user": "41n8gyoVAuDjZdUeHRGrPscG2DzJawDHpa1Y6VLV4VqJ",
        "counterparty": "EJXEbdsXFJ9AFEu1EqNHycfAEoBN7BFtfLVWx4DsEWUG",
        "tokenAmount": "536446568993",
        "solAmount": "686657357"
      },
      "heliusDir": null,
      "feePayer": "41n8gyoVAuDjZdUeHRGrPscG2DzJawDHpa1Y6VLV4VqJ",
      "mismatches": [
        "mintPresent"
      ]
    },
    {
      "signature": "5vp2E7eyStjKNicJd3BuFduWUjq2NADkkFhMuFT4UQy2TNz6owAhPzVefBpsrYp9WpWvpdABNTMgMeqs1LFWQDib",
      "local": {
        "kind": "pump_sell",
        "direction": "sell",
        "mint": "Ee1gKy1bECuyZ4a7Lb2iPAyyY4PR7pKajbG8s2QBpump",
        "user": "9qL4hMBNUo7qeC4CvUDGbbzb8nP71EgpMHfen68Awpmv",
        "counterparty": "4MgtDTrp4qC3dZ2LVBDp9T9hQi3sQCSDZHXa51pucSLV",
        "tokenAmount": "322096783474",
        "solAmount": "1"
      },
      "heliusDir": "sell",
      "feePayer": "9qL4hMBNUo7qeC4CvUDGbbzb8nP71EgpMHfen68Awpmv",
      "mismatches": []
    },
    {
      "signature": "aDvmn3XKqSbh7RkfowUzbA1tkeJThA7BCFc8akeJvFATFkUxX5MBUDJZ9ZpUrRW4QbznTzxBQAGmwVhNfmJmAnZ",
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "8sRNE1WxASDG7mX1pjhVdt3S3i274G193x19bm8kUu5a",
        "user": "ETqHCncrjHGjCnzuZ18sKqEutMWiVNmTjZjJnatngc3k",
        "counterparty": "HRibzckmd2m6mx2eh9NB1WnVHcSUgNq8Dfe8JbTTtYoA",
        "tokenAmount": null,
        "solAmount": "28836"
      },
      "heliusDir": "buy",
      "feePayer": "ETqHCncrjHGjCnzuZ18sKqEutMWiVNmTjZjJnatngc3k",
      "mismatches": []
    },
    {
      "signature": "2yjJC3farByjRtbX7HgsJhcSTXjcz1qqBBJ5Vq3r5os2mbsQDDzQreSxs76W3ud9cTtLgMeP2T99afwNUNgQnHhY",
      "local": {
        "kind": "pumpswap_buy",
        "direction": "buy",
        "mint": "qSzFKNg8tqZHenMp4hsUkMBRrVMfyagyBaZLFmKpump",
        "user": "5Ru8VsUChXeGmsthcDf95bh5ua6daucQfMhBC5tGw8xM",
        "counterparty": "7QMm9LmwnoCjxf3bZxkKNy5cxLtEWbyYRnAMBgwZPoKx",
        "tokenAmount": "222430",
        "solAmount": "412706"
      },
      "heliusDir": "buy",
      "feePayer": "5Ru8VsUChXeGmsthcDf95bh5ua6daucQfMhBC5tGw8xM",
      "mismatches": []
    },
    {
      "signature": "2FMmRXtRiyVbMV4Csv3Zz6XUcJmYqwGcCuJ1WrSUybRTM1iJGauqZ3qbyD7q3afVZzVJJcwcTBcACmT8SEESybTt",
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "CBXs6RDnfV93SvsAR9dUqeFj3tuFEM9bNJisnJ8Lpump",
        "user": "Gx32W57YqGYbrF7JQqyvqJAsSKm3BPxXo3gynguf3DsL",
        "counterparty": "E36fi2hUsjkiLJSLAXHwL6FSFnywEyqJ1GTM845rAL52",
        "tokenAmount": "40760213608",
        "solAmount": "0"
      },
      "heliusDir": "sell",
      "feePayer": "AgmLJBMDCqWynYnQiPCuj9ewsNNsBJXyzoUhD9LJzN51",
      "mismatches": [
        "userEq"
      ]
    },
    {
      "signature": "rriTinxpNMve7NmhUueN5ni1uhdvyk7h6XHKqz5TePGdgRwHgpxaDBeLcJEs2Zs5M6AfjoFBfdXV3EUxiWVPU1p",
      "local": {
        "kind": "pumpswap_sell",
        "direction": "sell",
        "mint": "2DznHsR5j6XHARnTVGubwAXxfmF9aQ8Pwwu3TN7ppump",
        "user": "tQRN3NXgu8hFy1Rcx1ArMThR7SEdqZkCeam86KNCa9X",
        "counterparty": "2d77EYAt6WeCNwsjEior7N91mw1uj7tayXtVMub7mXcQ",
        "tokenAmount": "74193",
        "solAmount": "211299"
      },
      "heliusDir": "sell",
      "feePayer": "tQRN3NXgu8hFy1Rcx1ArMThR7SEdqZkCeam86KNCa9X",
      "mismatches": []
    }
  ]
}
[0m
Gates run on a clean checkout. Cleanup and final verdict:
[0m$ [0mgit worktree remove "C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505" --force; git worktree prune; git 
worktree list
error: failed to delete 'C:/Users/enzo/AppData/Local/Temp/opencode/wt-38cf505': Filename too long
C:/Users/enzo/Desktop/copytrade 2                      3838e2f [master]
C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment     aea11df [sprint/f1-5-enrichment]
C:/Users/enzo/Desktop/copytrade-wt-f1-postgres-live    cbd49d4 [sprint/f1-postgres-live]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes   19ffacc [sprint/f1-security-fixes]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes-2 df98063 [sprint/f1-security-fixes-2]
[0m
[0m$ [0m$e=(Join-Path $env:TEMP "opencode\empty-rm"); if (-not (Test-Path $e)) { New-Item -ItemType Directory -Path 
$e | Out-Null }; robocopy $e "C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505" /MIR /NFL /NDL /NJH /NJS /NP | 
Out-Null; if (Test-Path "C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505") { Remove-Item -Recurse -Force 
"C:\Users\enzo\AppData\Local\Temp\opencode\wt-38cf505" }; git worktree prune; git worktree list
C:/Users/enzo/Desktop/copytrade 2                      3838e2f [master]
C:/Users/enzo/Desktop/copytrade-wt-f1-5-enrichment     aea11df [sprint/f1-5-enrichment]
C:/Users/enzo/Desktop/copytrade-wt-f1-postgres-live    cbd49d4 [sprint/f1-postgres-live]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes   19ffacc [sprint/f1-security-fixes]
C:/Users/enzo/Desktop/copytrade-wt-f1-security-fixes-2 df98063 [sprint/f1-security-fixes-2]
[0m
Auditoria conclu├¡da. Abaixo o relat├│rio adversarial de `38cf505ee228a35eb4dba6fae1e301e8feaeacfa`.

---

## VEREDITO: REJEITADO

**Contexto da revis├úo:** commit `38cf505` (branch `sprint/f1-5-enrichment`) ÔÇö enricher F1.5, runner, wiring, retention opt-in, instance-lock, scripts de gate e docs. Revisado em worktree **limpo** do commit (n├úo no worktree `copytrade-wt-f1-5-enrichment`, que cont├®m fixes n├úo commitados ÔÇö o que viciaria a auditoria).

---

## ACHADOS

### CRITICAL ÔÇö A-1: gate de contas (16/22) antes do discriminador derruba **todo** o lado SELL (recorr├¬ncia da review `d016b8b` ÔÇö n├úo resolvido)

**Arquivo:** `packages/pumpfun/src/decode.ts:51` (`accounts.length < PUMP_MIN_ACCOUNTS` com `PUMP_MIN_ACCOUNTS=16`) e `:81` (`AMM_MIN_ACCOUNTS=22`)

**Evid├¬ncia (aritm├®tica da pr├│pria IDL vendered no commit):**
- `idl/pump.json` ÔåÆ pump.`sell` = **14 contas** ÔåÆ `14 < 16` ÔåÆ `return null` sempre.
- `idl/pump_amm.json` ÔåÆ pump_amm.`sell` = **21 contas** ÔåÆ `21 < 22` ÔåÆ `return null` sempre.
- O gate ├® aplicado **antes** do match de discriminador (linhas 55-60/84-89 v├¬m depois). O coment├írio do c├│digo ("pump.buy/sell = 16; pump_amm.buy/sell = 22", linha 49) est├í errado frente ├á IDL.

**Como reproduzir:** `decodePumpInstruction(PUMP_PROGRAM_ADDRESS, sellDataValido, 14ContasCanonicasDaIDL)` ÔåÆ `null`.

**Impacto:** em copy-trading, o pipeline perde **100% dos sinais de sa├¡da** (sell) das carteiras monitoradas ÔÇö vi├®s de sele├º├úo exatamente da classe que AGENTS.md pro├¡be; o feed fica composto s├│ de buys (lado otimista do trade).

**M├íscara no teste:** `decode.test.ts:73-79` testa `pump sell decodifica` com `pumpAccounts()` de **16** contas ÔÇö shape inexistente na IDL. N├úo existe teste de sell do AMM. Gates verdes com bug vivo (confirmado: `npm test` ÔåÆ 106/106 passando).

**Sugest├úo:** mover gate para **depois** do discriminador, com m├¡nimo **por instru├º├úo** extra├¡do da mesma IDL (buy: pump=16, amm=23; sell: pump=14, amm=21), + testes com contagem can├┤nica + fixture real de sell. O fix j├í existe no worktree ÔÇö precisa ser commitado **junto** das evid├¬ncias (ver A-2).

---

### CRITICAL ÔÇö A-2: evid├¬ncias commitadas s├úo **irreproduz├¡veis** do c├│digo commitado (integridade do gate)

**Arquivos:** `docs/research/f15/backfill-report.json`, `docs/research/f15/fixtures-report.json`, `docs/research/f15/README.md`

**Evid├¬ncia:**
- `backfill-report.json` ÔåÆ `pump_decoder-v1:pump_sell = 1580`, `pumpswap_sell = 10`.
- `fixtures-report.json` ÔåÆ `results[]` com `kind: "pump_sell"` / `"pumpswap_sell"` decodificados (ex.: `5vp2E7eyStj...`, `tg3pusCqXV...`).
- **Ambos imposs├¡veis** com o `decode.ts` commitado (A-1: sell sempre `null`). As evid├¬ncias s├│ puderam ser geradas rodando o servi├ºo do **worktree com o decoder corrigido e n├úo commitado** (diff do worktree referencia "review d016b8b CRITICAL A-1").

**Como reproduzir:** `git show 38cf505:packages/pumpfun/src/decode.ts` + `git show 38cf505:docs/research/f15/backfill-report.json` ÔåÆ contradi├º├úo aritm├®tica direta.

**Impacto:** viola├º├úo de reprodutibilidade (AGENTS.md ┬º6, ┬º7.1 ÔÇö evid├¬ncia deve mapear ao commit). Pior: os ~8086 eventos marcados `undecodable` (incluindo sells reais) j├í t├¬m `enrichedAt` setado ÔÇö o fix futuro **n├úo reabre** essas linhas (`findUnenriched` s├│ seleciona `enrichedAt=null`) ÔåÆ **perda irrevers├¡vel** do material de sell j├í processado.

**Sugest├úo:** commitar o fix do decoder **no mesmo commit** das evid├¬ncias regeneradas; adicionar mecanismo de reabertura (ex.: janela de retry antes de marcar terminal, ou flag de re-processo).

---

### HIGH ÔÇö B-1: tx `null` (lag/pruning de RPC) ÔåÆ `undecodable` **permanente**

**Arquivo:** `services/data-ingestion/src/enricher.ts` (fluxo `getTransaction` ÔåÆ `collectInstructionCalls` ÔåÆ `markUndecodable`)

**Evid├¬ncia:** `getTransaction` do `@ct/solana` resolve `payload.result` ÔÇö pode ser `null` (tx ainda n├úo indexada, pruned, falhou). `collectInstructionCalls(null)` ÔåÆ `[]` ÔåÆ `markUndecodable(id, 'no-decodable-instruction')` ÔåÆ `enrichedAt` setado ÔåÆ **nunca** retentado. O teste cobre s├│ fetcher que *lan├ºa* (retry), n├úo fetcher que resolve `null`.

**Como reproduzir:** `new Enricher({ getTransaction: async () => null }, store, logger, 5).enrich(id, sig)` ÔåÆ retorna `'undecodable'` e persiste terminal.

**Impacto:** em RPC com lag >2s ou prunning, eventos v├ílidos s├úo destru├¡dos permanentemente ÔÇö composto com o backlog de 1,92M linhas n├úo enriquecidas.

**Sugest├úo:** `null` ÔåÆ `'retry'` com janela, reason distinto (`tx-not-found` vs `no-decodable-instruction`); teste para o caminho.

---

### HIGH ÔÇö B-2: enricher ignora `instruction_index` da linha; decodifica o primeiro swap da tx

**Arquivo:** `services/data-ingestion/src/enricher.ts` (la├ºo `for (const c of calls)`)

**Evid├¬ncia:** a linha carrega `instruction_index` (normalizer preserva; dedup key ├® `signature+instruction_index+wallet`), mas o enricher varre **todas** as calls (externas + `innerInstructions`) e usa a primeira decodific├ível. Em tx `create+buy` (padr├úo de launch do pump.fun) ou `buy+sell` no mesmo bloco, **todas** as linhas da tx ÔÇö inclusive a do launch/transfer ÔÇö s├úo enriquecidas como o mesmo swap.

**Impacto:** evento de launch vira "buy" da wallet monitorada (falso sinal de copy); linhas subsequentes de tx multi-swap recebem dire├º├úo/valores da primeira.

**Sugest├úo:** casar o call pelo `instructionIndex` real da linha (ou validar mint/user/counterparty antes de marcar); teste com tx multi-ix.

---

### HIGH ÔÇö B-3: `setInterval(2s)` < dura├º├úo do batch ÔåÆ sobreposi├º├úo **garantida** ÔåÆ attempts inflados e perda permanente sob falha transit├│ria

**Arquivos:** `services/data-ingestion/src/index.ts` (`setInterval(() => void runner.runUntilEmpty(1), 2_000)`), `enrich-runner.ts`, `observed-events.ts` (`findUnenriched`/`bumpAttempt` sem guarda)

**Evid├¬ncia (aritm├®tica):** batch = 25 ├ù (RPC getTransaction ~0,3-1s + sleepMs 120) Ôëê **8-28s > 2s** ÔåÆ a cada tick um batch novo seleciona as **mesmas** linhas ainda em processamento. `Enricher.running` ├® incrementado/decrementado e **nunca lido** (c├│digo morto ÔÇö guarda planejada, n├úo implementada; contraste com `RetentionJob.running`).

**Consequ├¬ncia:** attempts sobem ~4-5x por linha; sob falha transit├│ria, a linha atinge `maxAttempts` dentro do primeiro batch ÔåÆ exclu├¡da da fila **permanentemente** (`findUnenriched` filtra `attempts >= max`); `markEnriched` concorrente lan├ºa `RepositoryError` (count 0) engolido como `'retry'` mal rotulado.

**Sugest├úo:** guarda single-flight (como retention), ou remover `sleepMs` do batch, ou driver por heartbeat de "fila vazia".

---

### MEDIUM ÔÇö C-1 (recorr├¬ncia d016b8b): ramo sem perna wSOL rotula quantidade de **token** como `solAmount`

**Arquivo:** `packages/pumpfun/src/decode.ts` (buy: `tokenAmount: null, solAmount: d.baseAmountOut`; sell idem)

**Evid├¬ncia viva no pr├│prio fixture:** `fixtures-report.json` ÔÇö `4pc34pU...` (`pumpswap_buy`, `tokenAmount: null`, `solAmount: 126330`) listado como **perfectMatch** porque o gate **nunca compara amounts** (reivindica├º├úo "compara├º├úo 1:1" da README n├úo inclui valores). O C-1 n├úo ├® corrigido e ainda ├® *validado pelo gate*.

**Sugest├úo:** `tokenAmount=baseAmount*`, `solAmount=null` no ramo sem SOL; gate passa a comparar amounts.

---

### MEDIUM ÔÇö C-2 (recorr├¬ncia d016b8b ÔÇö reaberto e **provado**): artefato emitido pelo gate quebra no runtime Node ESM

**Arquivo:** `packages/pumpfun/dist/generated/pump/instructions/*.js` (ap├│s `npm run typecheck`)

**Evid├¬ncia (executado nesta revis├úo):** `node -e "import(.../dist/decode.js)"` ÔåÆ `ERR_MODULE_NOT_FOUND ... dist/generated/pump/instructions/addQuoteControlMint` (import relativo sem extens├úo; `fix-esm-imports.mjs` roda **s├│** no `build` do pumpfun, n├úo no typecheck nem no build do data-ingestion).

**Impacto:** `npm ci && npm run typecheck && node services/data-ingestion/dist/main.js` (fluxo t├¡pico de deploy) **crasha** ao carregar `@ct/pumpfun`; o backfill s├│ funcionou porque `build` rodou antes.

**Sugest├úo:** renderers codama com `imports: "extension"`, ou fix-esm em todo emit, ou typecheck `noEmit`.

---

### MEDIUM ÔÇö C-3: retention: `deleteMany` ├║nico e **ilimitado**, contradiz o pr├│prio header ("em lotes") e apaga RAW n├úo enriquecido

**Arquivo:** `services/data-ingestion/src/retention.ts` (`runOnce`)

**Evid├¬ncia:** um ├║nico `deleteMany({ receivedAt < cutoff })` sem pagina├º├úo, sem filtro de `enrichStatus`. Com 1,92M linhas n├úo enriquecidas e backfill a ~9+ dias de drain, ligar `RETENTION_RAW_ENABLED=true` (default 3 dias) destr├│i material n├úo enriquecido. O header declara "em lotes, fora do caminho quente" ÔÇö a implementa├º├úo n├úo lota.

**Sugest├úo:** loop de lotes (`take`/`LIMIT`), filtro opcional `enrichedAt != null` ou camada agregada antes; alinhar doc Ôåö c├│digo.

---

### MEDIUM ÔÇö C-4: catch-all do enricher engole `DATABASE_ERROR` e bugs internos como `'retry'` + r├│tulo `RPC_ERROR`

**Arquivo:** `services/data-ingestion/src/enricher.ts` (try/catch ├║nico)

**Evid├¬ncia:** `markEnriched` com `RepositoryError` (TOCTOU count=0 ÔÇö colis├úo do B-3) e qualquer erro de programa├º├úo caem no mesmo `warn('RPC_ERROR') + retry` at├® `maxAttempts`. Classifica├º├úo mentirosa (AGENTS.md ┬º6) + retry cego (regra 9).

**Sugest├úo:** classificar por tipo (`DATABASE_ERROR`ÔåÆparar/alertar; `VALIDATION_ERROR`ÔåÆterminal com reason); nunca rotular DB como RPC.

---

### MEDIUM ÔÇö C-5: `base58ToBytes` off-by-one para input all-zero (`"1"` ÔåÆ `[0,0]`)

**Arquivo:** `services/data-ingestion/src/enricher.ts` (`base58ToBytes`)

**Evid├¬ncia:** `if (n === 0n) bytes.push(0)` + la├ºo de `'1'` com `unshift(0)` ÔåÆ dupla contagem para data `"1"`; `bytes.reverse().reverse()` ├® no-op (c├│digo morto). Zero nunca ├® testado no `enricher.test.ts` (round-trips partem de bytes n├úo-nulos).

**Sugest├úo:** remover o ramo `n===0n`; teste para `"1"`, `"11"`, `"111"`.

---

### LOW ÔÇö D-1 (recorr├¬ncia): `package.json`/`tsconfig.json` do data-ingestion com BOM U+FEFF + indenta├º├úo 12 espa├ºos

**Evid├¬ncia:** diff mostra `+´╗┐` no in├¡cio dos arquivos. Padr├úo exato do incidente de encoding registrado em AGENTS.md ┬º8.3.6 (2026-09-23). Sem impacto funcional (npm/tsc toleram), mas diffs ruidosos e `format:check` falharia. Sugest├úo: regravar UTF-8 sem BOM.

### LOW ÔÇö D-2: `instance-lock.test.ts` cont├®m teste vazio (stub)

**Evid├¬ncia:** `it('lock recente com PID vivo rejeita (nao stale)', ...)` sem asser├º├Áes ÔÇö pendente, "passa" silenciosamente. Sugest├úo: implementar (mock de PID vivo) ou remover com ADR.

### LOW ÔÇö D-3: env vars novas sem documenta├º├úo em `.env.example`

**Evid├¬ncia:** `ENRICH_ENABLED/BATCH_SIZE/MAX_ATTEMPTS/SLEEP_MS`, `RETENTION_RAW_*`, `INGESTION_LOCK_PATH` lidas via `process.env` sem entrada no `.env.example`. Sugest├úo: documentar.

### LOW ÔÇö D-4: claims do commit message vs conte├║do

**Evid├¬ncia:** "Resolve ... 2ab477f MEDIUM fixtures" ÔÇö corrigido apenas parcialmente (amounts continuam n├úo comparados ÔÇö provado pelos pr├│prios `fixtures-report.json` perfectMatches); "Resolve reviews 5299d25*/dddb30b1/c438ef1c" procede para gates (ver Testes), mas A-1 da review `d016b8b` segue em aberto sem ser listado.

### INFO ÔÇö c├│digo gerado com `duplicate key "mint"`

**Evid├¬ncia:** warning do esbuild ao carregar `generated/pump/instructions/migrate.ts` (chave duplicada no objeto ÔÇö colis├úo de naming do renderer codama). N├úo usado no decode; monitorar.

---

## TESTES EXECUTADOS (tentativas de quebra, worktree limpo em `38cf505`)

1. `npm ci` ÔåÆ OK em 12s (lockfile em sincronia ÔÇö B-1 da review `d016b8b` **resolvido**).
2. `npm run typecheck` ÔåÆ **passa** (mas emite dist quebrado ÔÇö C-2).
3. `npm test` ÔåÆ **106/106 testes verdes** (enricher 8, decode 15, dedup 3, property 2, backoff 6, security-fixes 16...) ÔÇö incluindo o teste que **mascara A-1**.
4. `npm run lint` ÔåÆ **passa** (0 warnings).
5. `npm audit --omit=dev` ÔåÆ 0 vulns (2 moderates s├úo dev-only).
6. **Repro A-1:** decode de sell com contagem can├┤nica da IDL (14/21) ÔåÆ `null` (aritm├®tica gate ├ù IDL vendered).
7. **Repro C-2:** `node` import de `dist/decode.js` p├│s-typecheck ÔåÆ `ERR_MODULE_NOT_FOUND`.
8. **Prova A-2:** contradi├º├úo direta entre `decode.ts` commitado e `backfill-report.json`/`fixtures-report.json` commitados.

## O QUE N├âO FOI POSS├ìVEL VERIFICAR

- Se o servi├ºo live rodou o decoder corrigido do worktree durante o backfill (prov├ível ÔÇö ├® a ├║nica forma de produzir `pump_sell=1580`; sem logs das execu├º├Áes).
- Frequ├¬ncia real de txs multi-ix (create+buy) no feed para quantificar B-2 em produ├º├úo.
- Validade dos valores *realizados* vs par├ómetros de instru├º├úo (fora do escopo do decoder ÔÇö documentado em `decode.ts`, mas condiciona o uso dos campos por sinais ├á jusante).
- Migra├º├úo Prisma aplicada em banco real (migration.sql lido; coerente).

---

**S├¡ntese:** 2 CRITICAL + 3 HIGH + 5 MEDIUM. O A-1 (elimina├º├úo silenciosa de todo o lado sell ÔÇö metade do fluxo de sinais de um copy-trading engine) e o A-2 (evid├¬ncias irreproduz├¡veis do c├│digo commitado) bloqueiam a integra├º├úo, de forma independente. O fix existe no worktree mas n├úo est├í no commit ÔÇö **commitar o fix do decoder junto das evid├¬ncias regeneradas antes de re-submeter**. Nenhum commit desta branch pode ser mergeado at├® nova revis├úo aprovada (regra 3 do pipeline ┬º7.1).

VERDICT: REJEITADO

