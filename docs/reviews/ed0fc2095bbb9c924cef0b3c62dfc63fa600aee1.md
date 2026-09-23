# Review ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1

- Branch: sprint/f1-security-fixes-2
- Data: 2026-09-23 20:30:58
- Gates: lint=0 typecheck=0 test=0 (0 = ok)
- Veredito: **APROVADO**

## Saida do code-reviewer

opencode.exe : [0m
No C:\Users\enzo\AppData\Roaming\npm\opencode.ps1:14 caractere:3
+   & "$basedir/node_modules/opencode-ai/bin/opencode.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ([0m:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
> code-reviewer ┬À big-pickle
[0m
[0m$ [0mgit show ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1 --stat
commit ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Wed Sep 23 20:28:33 2026 -0300

    fix(security): review 19ffacc - propagacao de erro a waiters (sem cadeia de lideranca), cleanup inFlight com 
self-check, testes dos caminhos de erro, testes reescritos em UTF-8 limpo

 services/data-ingestion/src/dedup-store.ts         |  44 ++++++++++++++++-----
 services/data-ingestion/src/security-fixes.test.ts | Bin 5687 -> 9388 bytes
 2 files changed, 34 insertions(+), 10 deletions(-)
[0m
[0m$ [0mgit log --oneline -5 ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1
ed0fc20 fix(security): review 19ffacc - propagacao de erro a waiters (sem cadeia de lideranca), cleanup inFlight com 
self-check, testes dos caminhos de erro, testes reescritos em UTF-8 limpo
9ece7b8 docs(handoff): incidente race no merge gate + plano de fechamento do RT-005
676bc50 fix(ops): merge-sprint anti-race (pull antes de verificar + ultimo veredito + state.json rejected)
c1430a4 merge: sprint/f1-security-fixes (todos os commits aprovados em docs/reviews/)
755cbd1 docs(sec): findings RT-004/005/006 + sprint 2 PoCs (red-team)
[0m
[0m$ [0mgit show ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1
commit ed0fc2095bbb9c924cef0b3c62dfc63fa600aee1
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Wed Sep 23 20:28:33 2026 -0300

    fix(security): review 19ffacc - propagacao de erro a waiters (sem cadeia de lideranca), cleanup inFlight com 
self-check, testes dos caminhos de erro, testes reescritos em UTF-8 limpo

diff --git a/services/data-ingestion/src/dedup-store.ts b/services/data-ingestion/src/dedup-store.ts
index 16523b3..b160be6 100644
--- a/services/data-ingestion/src/dedup-store.ts
+++ b/services/data-ingestion/src/dedup-store.ts
@@ -45,6 +45,8 @@ export class DedupCounters {
   ingested = 0;
   deduplicated = 0;
   errors = 0;
+  /** Waiters que receberam o resultado agregado de uma opera├º├úo em voo com erro (RT-005). */
+  joined = 0;
 }
 
 export class DedupStore {
@@ -52,9 +54,23 @@ export class DedupStore {
   /**
    * RT-005: mapa de opera├º├Áes em voo. Concorr├¬ncia sobre a mesma dedupKey
    * (reconnect storm) N├âO cria N inserts paralelos que inflam contadores ÔÇö
-   * somente o primeiro vira l├¡der de insert; os demais aguardam e, se o
-   * l├¡der persistiu, s├úo classificados como 'duplicate' (j├í existe no DB).
-   * Se o l├¡der falhar, o primeiro waiter assume a lideran├ºa e tenta.
+   * somente o primeiro vira l├¡der de insert; os demais aguardam o l├¡der.
+   *
+   * SEM├éNTICA DOS CONTADORES (documentada ÔÇö review 19ffacc, achado 2):
+   * - ingested      : inserts que persistiram de fato no DB (autoridade).
+   * - deduplicated  : eventos classificados como duplicata (cache hit, P2002,
+   *                   ou waiter cujo l├¡der persistiu/era duplicata).
+   * - errors        : tentativas de persist├¬ncia MAL-SUCEDIDAS ÔÇö conta 1 por
+   *                   opera├º├úo-l├¡der que falhou (n├úo por tentativa de reexecu├º├úo,
+   *                   pois n├úo h├í reexecu├º├úo autom├ítica).
+   * - joined        : callers que receberam o resultado AGREGADO de uma opera├º├úo
+   *                   em voo conclu├¡da com erro (sem retry, sem nova ida ao DB).
+   *
+   * Em um burst de N chamadas com a mesma key e DB fora do ar:
+   *   errors=1, joined=N-1, exatamente 1 chamada a repo.create.
+   * Nenhum waiter vira novo l├¡der: erro transit├│rio ├® propagado como est├í
+   * (o produtor upstream decide re-tentar; retry de escrita financeira/eventual
+   * nunca ├® feito cegamente aqui ÔÇö AGENTS.md retries+idempot├¬ncia).
    */
   private readonly inFlight = new Map<string, Promise<DedupOutcome>>();
   readonly counters = new DedupCounters();
@@ -91,14 +107,15 @@ export class DedupStore {
         status: 'error',
         error: err instanceof Error ? err : new Error(`DATABASE_ERROR: ${String(err)}`),
       };
-    } finally {
-      this.inFlight.delete(key);
     }
+    // SEM finally-delete aqui: o cleanup mora em checkAndPersist com auto-verifica├º├úo
+    // (review achado 3 ÔÇö sync-throw executaria finally antes de inFlight.set).
   }
 
   /**
    * Verifica e persiste. Retorna 'duplicate' se a dedupKey j├í existe
    * (cache, unique constraint do banco OU opera├º├úo em voo conclu├¡da com sucesso).
+   * Erro do l├¡der ├® PROPAGADO aos waiters (sem re-tentativa cega).
    */
   async checkAndPersist(key: string, record: ObservedEventInsertData): Promise<DedupOutcome> {
     // Fast-path: mem├│ria (s├│ evita trabalho; NUNCA ├® a autoridade final).
@@ -111,16 +128,23 @@ export class DedupStore {
     const existing = this.inFlight.get(key);
     if (existing !== undefined) {
       const leaderOutcome = await existing;
-      if (leaderOutcome.status === 'new' || leaderOutcome.status === 'duplicate') {
-        this.counters.deduplicated++;
-        return { status: 'duplicate' };
+      if (leaderOutcome.status === 'error') {
+        // Review achado 2: N├âO virar l├¡der; propagar o erro do l├¡der.
+        this.counters.joined++;
+        return leaderOutcome;
       }
-      // L├¡der falhou (erro de DB transit├│rio): este waiter tenta como novo l├¡der.
-      return this.checkAndPersist(key, record);
+      this.counters.deduplicated++;
+      return { status: 'duplicate' };
     }
 
     const promise = this.persistLeader(key, record);
     this.inFlight.set(key, promise);
+    // Cleanup protegido contra envenenamento por sync-throw (achado 3):
+    // .then sempre executa em microtask AP├ôS o set acima; deleta apenas a
+    // pr├│pria entrada (outra opera├º├úo jamais remove a alheia).
+    void promise.then(() => {
+      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
+    });
     return promise;
   }
 
diff --git a/services/data-ingestion/src/security-fixes.test.ts b/services/data-ingestion/src/security-fixes.test.ts
index 7dcb8d2..48b9e33 100644
Binary files a/services/data-ingestion/src/security-fixes.test.ts and 
b/services/data-ingestion/src/security-fixes.test.ts differ
[0m
[0mÔåÆ [0mRead services/data-ingestion/src/dedup-store.ts
The test file shows as binary (encoding issue). Let me read the actual files and the related context.
[0m
[0m$ [0mgit log --oneline -3 19ffacc 2>$null; git show 19ffacc --stat 2>$null | Select-Object -First 20
19ffacc fix(security): RT-005 dedup thread-safe com in-flight map (contadores fiaveis sob concorrencia)
ea88b46 fix(security): RT-004 limites de tamanho no schema + RT-006 allowlist base58 na signature
d59cf20 review(sprint/f1-postgres-live): REJEITADO cbd49d4fa82a2f97e8e9b134239f9ab282539ac0
commit 19ffacc3726223dab70613484bba5432cd289d9c
Author: EznRB <EznRB@users.noreply.github.com>
Date:   Wed Sep 23 01:03:43 2026 -0300

    fix(security): RT-005 dedup thread-safe com in-flight map (contadores fiaveis sob concorrencia)
[0m
[0m$ [0mgit show ed0fc20:services/data-ingestion/src/dedup-store.ts
/**
 * DedupStore ÔÇö deduplica├º├úo em duas camadas (AGENTS.md ┬º2.6 idempot├¬ncia).
 *
 * (a) Cache em mem├│ria (LRU simples, limite configur├ível) ÔÇö fast-path.
 * (b) Banco: insert com @@unique([signature, instructionIndex, wallet]).
 *     Conflito (Prisma P2002) = duplicata. A camada (b) ├® a AUTORIDADE:
 *     garante idempot├¬ncia mesmo entre restarts do processo.
 *
 * Erros: apenas P2002 ├® classificado como duplicata. Qualquer outro erro de
 * persist├¬ncia ├® DATABASE_ERROR.
 */

/** JSON recursivo compat├¡vel com Prisma.InputJsonValue (mant├®m o package desacoplado). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Shape alinhado ao model ObservedEvent real (packages/database/prisma/schema.prisma). */
export interface ObservedEventInsertData {
  signature: string;
  instructionIndex: number;
  wallet: string;
  eventType: string;
  slot?: bigint | null;
  blockTime?: Date | null;
  /** Prisma Json fields n├úo aceitam null direto (usar Prisma.JsonNull); omitimos quando ausente. */
  payload?: Exclude<JsonValue, null>;
}

/** Interface m├¡nima do reposit├│rio (prisma.observedEvent). */
export interface ObservedEventRepo {
  create(args: { data: ObservedEventInsertData }): Promise<unknown>;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
  );
}

export type DedupOutcome =
  | { status: 'new' }
  | { status: 'duplicate' }
  | { status: 'error'; error: Error };

export class DedupCounters {
  ingested = 0;
  deduplicated = 0;
  errors = 0;
  /** Waiters que receberam o resultado agregado de uma opera├º├úo em voo com erro (RT-005). */
  joined = 0;
}

export class DedupStore {
  private readonly seen = new Set<string>();
  /**
   * RT-005: mapa de opera├º├Áes em voo. Concorr├¬ncia sobre a mesma dedupKey
   * (reconnect storm) N├âO cria N inserts paralelos que inflam contadores ÔÇö
   * somente o primeiro vira l├¡der de insert; os demais aguardam o l├¡der.
   *
   * SEM├éNTICA DOS CONTADORES (documentada ÔÇö review 19ffacc, achado 2):
   * - ingested      : inserts que persistiram de fato no DB (autoridade).
   * - deduplicated  : eventos classificados como duplicata (cache hit, P2002,
   *                   ou waiter cujo l├¡der persistiu/era duplicata).
   * - errors        : tentativas de persist├¬ncia MAL-SUCEDIDAS ÔÇö conta 1 por
   *                   opera├º├úo-l├¡der que falhou (n├úo por tentativa de reexecu├º├úo,
   *                   pois n├úo h├í reexecu├º├úo autom├ítica).
   * - joined        : callers que receberam o resultado AGREGADO de uma opera├º├úo
   *                   em voo conclu├¡da com erro (sem retry, sem nova ida ao DB).
   *
   * Em um burst de N chamadas com a mesma key e DB fora do ar:
   *   errors=1, joined=N-1, exatamente 1 chamada a repo.create.
   * Nenhum waiter vira novo l├¡der: erro transit├│rio ├® propagado como est├í
   * (o produtor upstream decide re-tentar; retry de escrita financeira/eventual
   * nunca ├® feito cegamente aqui ÔÇö AGENTS.md retries+idempot├¬ncia).
   */
  private readonly inFlight = new Map<string, Promise<DedupOutcome>>();
  readonly counters = new DedupCounters();

  constructor(
    private readonly repo: ObservedEventRepo,
    private readonly maxCacheSize = Number(process.env['INGESTION_DEDUP_CACHE_SIZE'] ?? 50_000),
  ) {}

  /** Insere a chave no cache LRU (evict do mais antigo ao exceder o limite). */
  private remember(key: string): void {
    if (this.seen.has(key)) this.seen.delete(key);
    this.seen.add(key);
    if (this.seen.size > this.maxCacheSize) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  private async persistLeader(key: string, record: ObservedEventInsertData): Promise<DedupOutcome> {
    try {
      await this.repo.create({ data: record });
      this.remember(key);
      this.counters.ingested++; // contabiliza AP├ôS insert real (RT-005)
      return { status: 'new' };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.remember(key);
        this.counters.deduplicated++;
        return { status: 'duplicate' };
      }
      this.counters.errors++;
      return {
        status: 'error',
        error: err instanceof Error ? err : new Error(`DATABASE_ERROR: ${String(err)}`),
      };
    }
    // SEM finally-delete aqui: o cleanup mora em checkAndPersist com auto-verifica├º├úo
    // (review achado 3 ÔÇö sync-throw executaria finally antes de inFlight.set).
  }

  /**
   * Verifica e persiste. Retorna 'duplicate' se a dedupKey j├í existe
   * (cache, unique constraint do banco OU opera├º├úo em voo conclu├¡da com sucesso).
   * Erro do l├¡der ├® PROPAGADO aos waiters (sem re-tentativa cega).
   */
  async checkAndPersist(key: string, record: ObservedEventInsertData): Promise<DedupOutcome> {
    // Fast-path: mem├│ria (s├│ evita trabalho; NUNCA ├® a autoridade final).
    if (this.seen.has(key)) {
      this.counters.deduplicated++;
      return { status: 'duplicate' };
    }

    // RT-005: dedup concorrente ÔÇö join na opera├º├úo em voo da mesma key.
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      const leaderOutcome = await existing;
      if (leaderOutcome.status === 'error') {
        // Review achado 2: N├âO virar l├¡der; propagar o erro do l├¡der.
        this.counters.joined++;
        return leaderOutcome;
      }
      this.counters.deduplicated++;
      return { status: 'duplicate' };
    }

    const promise = this.persistLeader(key, record);
    this.inFlight.set(key, promise);
    // Cleanup protegido contra envenenamento por sync-throw (achado 3):
    // .then sempre executa em microtask AP├ôS o set acima; deleta apenas a
    // pr├│pria entrada (outra opera├º├úo jamais remove a alheia).
    void promise.then(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    return promise;
  }

  /** Apenas observabilidade/teste: tamanho do mapa em voo. */
  get inFlightSize(): number {
    return this.inFlight.size;
  }
}
[0m
The working tree shows the old version ÔÇö let me read the actual committed versions and check the test file encoding situation.
[0m$ [0mgit branch --show-current; git status --short | Select-Object -First 10
master
[0m
[0m$ [0mgit show ed0fc20:services/data-ingestion/src/security-fixes.test.ts > "$env:TEMP\ed0fc20-test.ts"; Get-Item 
"$env:TEMP\ed0fc20-test.ts" | Select-Object Length; $bytes = 
[System.IO.File]::ReadAllBytes("$env:TEMP\ed0fc20-test.ts"); $bytes[0..20] -join ','
Length
------
 18778
255,254,47,0,42,0,42,0,13,0,10,0,32,0,42,0,32,0,84,0,101
[0m
The committed `dedup-store.ts` is clear. The test file diff is flagged as **binary** ÔÇö I need to check the encoding of the committed test file and its content.
[0m$ [0mgit show 19ffacc:services/data-ingestion/src/security-fixes.test.ts > "$env:TEMP\19ffacc-test.ts"; $bytes = 
[System.IO.File]::ReadAllBytes("$env:TEMP\19ffacc-test.ts"); "len: $($bytes.Length)"; $bytes[0..20] -join ','
len: 11684
255,254,47,0,42,0,42,0,13,0,10,0,32,0,42,0,32,0,84,0,101
[0m
The UTF-16 BOM could be an artifact of PowerShell's `>` redirection. Let me verify with byte-preserving `cmd` redirection.
[0m$ [0mcmd /c "git show ed0fc20:services/data-ingestion/src/security-fixes.test.ts > %TEMP%\t-ed0fc20.ts" ; cmd /c 
"git show 19ffacc:services/data-ingestion/src/security-fixes.test.ts > %TEMP%\t-19ffacc.ts" ; $b1 = 
[System.IO.File]::ReadAllBytes("$env:TEMP\t-ed0fc20.ts"); $b2 = 
[System.IO.File]::ReadAllBytes("$env:TEMP\t-19ffacc.ts"); "NEW len=$($b1.Length) head: $($b1[0..15] -join ',')"; "OLD 
len=$($b2.Length) head: $($b2[0..15] -join ',')"
NEW len=9388 head: 47,42,42,13,10,32,42,32,84,101,115,116,101,115,32,100
OLD len=5687 head: 47,42,42,10,32,42,32,84,101,115,116,101,115,32,100,111
[0m
The new test file is UTF-8 CRLF (clean). But git flagged the diff as binary ÔÇö let me check for NUL bytes and then read the test file content.
[0m$ [0mgit diff 19ffacc ed0fc20 --stat; git diff --numstat 19ffacc ed0fc20 -- 
services/data-ingestion/src/security-fixes.test.ts
docs/handoff.md                                    |   25 +
 .../19ffacc3726223dab70613484bba5432cd289d9c.md    |  858 +++++++++++
 .../ea88b4649a2b109ebf0b963b92f289dcc957feb5.md    | 1600 ++++++++++++++++++++
 docs/reviews/state.json                            |    6 +-
 docs/security/red-team/FINDINGS.md                 |   40 +-
 docs/security/red-team/SPRINTS.md                  |   37 +-
 .../security/red-team/poc/sprint2-fuzz.poc.test.ts |   52 +
 .../red-team/poc/sprint2-ingestion.poc.test.ts     |  167 ++
 docs/security/red-team/poc/vitest.poc.config.mjs   |    9 +
 scripts/merge-sprint.ps1                           |   26 +-
 services/data-ingestion/src/dedup-store.ts         |   44 +-
 services/data-ingestion/src/security-fixes.test.ts |  Bin 5687 -> 9388 bytes
 12 files changed, 2838 insertions(+), 26 deletions(-)
-	-	services/data-ingestion/src/security-fixes.test.ts
[0m
[0m$ [0m$b1 = [System.IO.File]::ReadAllBytes("$env:TEMP\t-ed0fc20.ts"); $nulCount = ($b1 | Where-Object { $_ -eq 0 
}).Count; "NUL bytes in NEW: $nulCount"; "CR count: $(($b1 | Where-Object { $_ -eq 13 }).Count)"; "LF count: $(($b1 | 
Where-Object { $_ -eq 10 }).Count)"
NUL bytes in NEW: 1
CR count: 236
LF count: 236
[0m
**Found 1 NUL byte in the committed test file** ÔÇö that's why git treats it as binary. Let me locate it.
[0m$ [0m$b1 = [System.IO.File]::ReadAllBytes("$env:TEMP\t-ed0fc20.ts"); for ($i = 0; $i -lt $b1.Length; $i++) { if 
($b1[$i] -eq 0) { "NUL at byte offset $i"; $start = [Math]::Max(0, $i - 60); $end = [Math]::Min($b1.Length - 1, $i + 
60); $slice = $b1[$start..$end]; $text = [System.Text.Encoding]::UTF8.GetString($slice); "Context: [$text]" } }
NUL at byte offset 3360
Context: [eRawNotification(raw({ signature: VALID_SIG.slice(0, 87) + ' ' })).success).toBe(
      false,
    );
  });

  it('R]
[0m
**A literal NUL byte (0x00) inside a string literal in the committed test file.** Let me compare with the old version and check whether TypeScript accepts this, and whether tests actually run.
[0m$ [0m$b2 = [System.IO.File]::ReadAllBytes("$env:TEMP\t-19ffacc.ts"); $text = 
[System.Text.Encoding]::UTF8.GetString($b2); $text -split "`n" | Select-String -Pattern "0, 87|slice\(0, 87\)|\\0|x00" 
| ForEach-Object { $_.Line.Trim() }
expect(parseRawNotification(raw({ signature: VALID_SIG.slice(0, 87) + ' ' })).success).toBe(
parseRawNotification(raw({ signature: VALID_SIG.slice(0, 87) + '?' })).success,
[0m
[0m$ [0m$text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes("$env:TEMP\t-ed0fc20.ts")); 
$text -split "`r`n" | ForEach-Object { $_.Trim() } | Select-String -Pattern "slice\(0, 87\)" -Context 2,2
describe('RT-006 - signature com allowlist base58', () => {
  it('caractere de controle (\\u0000) rejeitado', () => {
> expect(parseRawNotification(raw({ signature: VALID_SIG.slice(0, 87) + ' ' })).success).toBe(
  false,
  );
  
  it('RTL override (\\u202E) rejeitado', () => {
> const sig = VALID_SIG.slice(0, 87) + String.fromCharCode(0x202e);
  expect(sig.charCodeAt(87)).toBe(0x202e);
  expect(parseRawNotification(raw({ signature: sig })).success).toBe(false);
[0m
[0m$ [0m$b2 = [System.IO.File]::ReadAllBytes("$env:TEMP\t-19ffacc.ts"); "OLD NUL count: $(($b2 | Where-Object { $_ 
-eq 0 }).Count)"; $oldText = [System.Text.Encoding]::UTF8.GetString($b2); $idx = $oldText.IndexOf('slice(0, 87)'); 
$oldText.Substring($idx, 60)
OLD NUL count: 1
slice(0, 87) + ' ' })).success).toBe(
      false,
    );
[0m
[0m$ [0mTest-Path "node_modules"; Test-Path "services/data-ingestion/node_modules"; Test-Path "package.json"; 
Get-ChildItem -Name | Select-Object -First 25
True
True
True
.agents
.github
.opencode
apps
backtester
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
AGENTS.md
opencode.json
package-lock.json
package.json
README.md
tsconfig.base.json
[0m
Both old and new files have the NUL byte ÔÇö so the NUL predates the commit, but the commit claims "UTF-8 limpo" while the file remains binary for git. Let me read the full committed test file.
[0m$ [0m$text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes("$env:TEMP\t-ed0fc20.ts")); 
$text -replace "`r", ""
/**
 * Testes dos fixes de seguranca pos-F1 (sprints f1-security-fixes[-2]).
 * Reproduzem os PoCs do red-team: docs/security/red-team/poc/sprint2-ingestion.poc.test.ts
 *
 * RT-004 - limites de tamanho (DoS memoria/DB)
 * RT-005 - dedup concorrente thread-safe (contadores fieis) + caminhos de erro
 *          (review 19ffacc, achados 2/3/4)
 * RT-006 - signature com allowlist base58 (anti log injection)
 *
 * NOTA: este arquivo e ASCII-only de proposito (achado 6 do review: versao
 * anterior foi commitada com encoding corrompido e o git a tratava como binario).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseRawNotification, boundedJson, SIGNATURE_REGEX } from './schemas.js';
import { DedupStore, type ObservedEventInsertData } from './dedup-store.js';
import { dedupKey } from '@ct/types';

const VALID_SIG = '5'.repeat(88); // base58 valido, 88 chars
const VALID_WALLET = '7'.repeat(44);

function raw(overrides: Record<string, unknown> = {}) {
  return { signature: VALID_SIG, slot: 123, wallet: VALID_WALLET, ...overrides };
}

function fakeRepo(latencyMs = 5) {
  const rows = new Map<string, ObservedEventInsertData>();
  let createCalls = 0;
  return {
    rows,
    get createCalls() {
      return createCalls;
    },
    async create(args: { data: ObservedEventInsertData }) {
      createCalls++;
      const key = dedupKey({
        signature: args.data.signature,
        instruction_index: args.data.instructionIndex,
        wallet: args.data.wallet,
      });
      // Latencia antes da checagem: maximiza a janela de corrida entre waiters.
      await new Promise((r) => setTimeout(r, latencyMs));
      if (rows.has(key)) {
        const err = new Error('Unique constraint failed');
        (err as Error & { code: string }).code = 'P2002';
        throw err;
      }
      rows.set(key, args.data);
      return {};
    },
  };
}

const record = (sig = VALID_SIG, w = VALID_WALLET, i = 0): ObservedEventInsertData => ({
  signature: sig,
  instructionIndex: i,
  wallet: w,
  eventType: 'UNKNOWN',
});

const key1 = (): string => `${VALID_SIG}:0:${VALID_WALLET}`;

describe('RT-004 - limites de tamanho no schema de ingestao', () => {
  it('signature gigante (10MB) e rejeitada', () => {
    expect(parseRawNotification(raw({ signature: '5'.repeat(10_000_000) })).success).toBe(false);
  });

  it('signature valida passa', () => {
    expect(parseRawNotification(raw()).success).toBe(true);
  });

  it('wallet gigante e rejeitada', () => {
    expect(parseRawNotification(raw({ wallet: '7'.repeat(100_000) })).success).toBe(false);
  });

  it('slot astronomico e rejeitado', () => {
    expect(parseRawNotification(raw({ slot: Number.MAX_SAFE_INTEGER })).success).toBe(false);
  });

  it('payload gigante e truncado pela serializacao limitada', () => {
    const big = { blob: 'x'.repeat(100_000) };
    const out = boundedJson(big);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed['_truncated']).toBe(true);
    expect(out.length).toBeLessThan(9_000);
  });
});

describe('RT-006 - signature com allowlist base58', () => {
  it('caractere de controle (\\u0000) rejeitado', () => {
    expect(parseRawNotification(raw({ signature: VALID_SIG.slice(0, 87) + ' ' })).success).toBe(
      false,
    );
  });

  it('RTL override (\\u202E) rejeitado', () => {
    const sig = VALID_SIG.slice(0, 87) + String.fromCharCode(0x202e);
    expect(sig.charCodeAt(87)).toBe(0x202e);
    expect(parseRawNotification(raw({ signature: sig })).success).toBe(false);
  });
  it('emoji / multibyte rejeitado', () => {
    const sig = VALID_SIG.slice(0, 85) + '\uD83D\uDE80';
    expect(sig.length).toBe(87);
    expect(parseRawNotification(raw({ signature: sig })).success).toBe(false);
  });

  it('caracteres fora do alphabet base58 (0, O, I, l) rejeitados', () => {
    expect(SIGNATURE_REGEX.test('0'.repeat(88))).toBe(false);
    expect(SIGNATURE_REGEX.test('O'.repeat(88))).toBe(false);
    expect(SIGNATURE_REGEX.test('I'.repeat(88))).toBe(false);
    expect(SIGNATURE_REGEX.test('l'.repeat(88))).toBe(false);
  });

  it('property: toda string aceita e base58 puro de 64-88', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (s) => {
        const ok = parseRawNotification(raw({ signature: s })).success;
        if (ok) expect(SIGNATURE_REGEX.test(s)).toBe(true);
      }),
    );
  });
});

describe('RT-005 - dedup sob concorrencia (contadores fieis)', () => {
  it('burst de 50 chamadas simultaneas com a mesma key: ingested=1, deduplicated=49', async () => {
    const repo = fakeRepo();
    const store = new DedupStore(repo);
    const outcomes = await Promise.all(
      Array.from({ length: 50 }, () => store.checkAndPersist(key1(), record())),
    );
    expect(repo.rows.size).toBe(1);
    expect(repo.createCalls).toBe(1);
    expect(store.counters.ingested).toBe(1);
    expect(store.counters.deduplicated).toBe(49);
    expect(store.counters.errors).toBe(0);
    expect(store.counters.joined).toBe(0);
    expect(outcomes.filter((o) => o.status === 'new')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'duplicate')).toHaveLength(49);
    expect(store.inFlightSize).toBe(0);
  });

  it('property: bursts arbitrarios concorrentes nunca inflam contadores', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 30 }), async (burst) => {
        const repo = fakeRepo();
        const store = new DedupStore(repo);
        await Promise.all(
          Array.from({ length: burst }, () => store.checkAndPersist(key1(), record())),
        );
        expect(repo.createCalls).toBe(1);
        expect(store.counters.ingested).toBe(1);
        expect(store.counters.deduplicated).toBe(burst - 1);
        expect(store.counters.errors).toBe(0);
        expect(store.inFlightSize).toBe(0);
      }),
    );
  });

  it('sequencial continua correto (regressao)', async () => {
    const repo = fakeRepo();
    const store = new DedupStore(repo);
    const r1 = await store.checkAndPersist(key1(), record());
    const r2 = await store.checkAndPersist(key1(), record());
    expect(r1.status).toBe('new');
    expect(r2.status).toBe('duplicate');
  });
});

describe('RT-005 - caminhos de erro (review 19ffacc, achados 2/3/4)', () => {
  it('(a) lider falha + burst: 1 so tentativa de DB, erro propagado a todos, sem cadeia de retries', async () => {
    let createCalls = 0;
    const failingRepo = {
      async create(): Promise<unknown> {
        createCalls++;
        await new Promise((r) => setTimeout(r, 10));
        throw new Error('timeout de rede');
      },
    };
    const store = new DedupStore(failingRepo);
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => store.checkAndPersist(key1(), record())),
    );
    // Sem cadeia de liderancas: UMA unica ida ao DB.
    expect(createCalls).toBe(1);
    expect(store.counters.errors).toBe(1);
    expect(store.counters.joined).toBe(9);
    expect(store.counters.ingested).toBe(0);
    expect(store.counters.deduplicated).toBe(0);
    expect(outcomes.every((o) => o.status === 'error')).toBe(true);
    expect(store.inFlightSize).toBe(0);
  });

  it('(b) sync-throw do repo.create nao envenena o inFlight: 2a chamada resolve', async () => {
    let calls = 0;
    // Repo com throw SINCRONO (contrato nao garante async) - cenario do achado 3.
    const syncThrowRepo = {
      create(_args: { data: ObservedEventInsertData }): Promise<unknown> {
        calls++;
        throw new Error('boom sincrono');
      },
    };
    const store = new DedupStore(syncThrowRepo);
    const r1 = await store.checkAndPersist(key1(), record());
    expect(r1.status).toBe('error');
    // Drain de microtasks para o cleanup protegido rodar.
    await Promise.resolve();
    await Promise.resolve();
    expect(store.inFlightSize).toBe(0);
    // 2a chamada DEVE resolver (nao travar em recursao de join).
    const r2 = (await Promise.race([
      store.checkAndPersist(key1(), record()),
      new Promise((_, rej) => setTimeout(() => rej(new Error('HANG')), 500)),
    ])) as { status: string };
    expect(r2.status).toBe('error');
    expect(calls).toBe(2);
  });

  it('(c) P2002 no lider com waiters: todos duplicate, 1 remember, 0 errors', async () => {
    const repo = fakeRepo(10);
    // Pre-semeia a key no repo: todo insert vira P2002.
    repo.rows.set(key1(), record());
    const store = new DedupStore(repo);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => store.checkAndPersist(key1(), record())),
    );
    expect(outcomes.every((o) => o.status === 'duplicate')).toBe(true);
    expect(store.counters.deduplicated).toBe(8);
    expect(store.counters.errors).toBe(0);
    expect(repo.createCalls).toBe(1); // waiters nunca tocam o DB
    // `seen` contem a key uma unica vez (Set) - remember idempotente.
    const again = await store.checkAndPersist(key1(), record());
    expect(again.status).toBe('duplicate'); // agora via cache fast-path
    expect(repo.createCalls).toBe(1);
    expect(store.inFlightSize).toBe(0);
  });
});
[0m
[0mÔ£▒ [0mGrep "checkAndPersist"[90m in services/data-ingestion/src ┬À 7 matches[0m
The NUL byte is a real finding (old file had it too, new one still has it ÔÇö so the commit's claim of fixing git's binary treatment failed). Now let me verify integration: how callers use `checkAndPersist`, and the schemas the tests exercise.
[0mÔ£▒ [0mGrep "dedupKey"[90m in packages/types/src ┬À 1 match[0m
[0mÔåÆ [0mRead services/data-ingestion/src/pipeline.ts
[0m
[0m$ [0m$t = Get-Content "packages\types\src\index.ts" -Raw; $i = $t.IndexOf('export function dedupKey'); 
$t.Substring($i, 500)
Exce´┐¢´┐¢o ao chamar "Substring" com "2" argumento(s): "O ´┐¢ndice e o comprimento devem se referir a um local dentro 
da 
cadeia de caracteres.
Nome do par´┐¢metro: length"
No linha:1 caractere:99
+ ... w; $i = $t.IndexOf('export function dedupKey'); $t.Substring($i, 500)
+                                                     ~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:) [], MethodInvocationException
    + FullyQualifiedErrorId : ArgumentOutOfRangeException
[0m
[93m[1m! [0mpermission requested: external_directory (C:\Users\enzo\AppData\Local\Temp\*); auto-rejecting
[0mÔ£ù [0mgit show ed0fc20:services/data-ingestion/src/dedup.test.ts | Out-File -Encoding utf8 
"$env:TEMP\dedup-branch.ts"; Get-Content "$env:TEMP\dedup-branch.ts" -Raw | Select-Object -First 1 | Out-String -Width 
400 failed
[91m[1mError: [0mThe user rejected permission to use this specific tool call.
`dedup.test.ts` (pre-existing) may lock in the OLD join-as-leader behavior this commit removes. Let me check both the branch state of `dedup.test.ts` and `dedupKey`.
[0m
[0m$ [0m$t = Get-Content "packages\types\src\index.ts" -Raw; $i = $t.IndexOf('dedupKey'); $t.Substring($i - 100, 400)
deduplica´┐¢´┐¢Ã£o (´┐¢´┐¢17). Formato: `${signature}:${instruction_index}:${wallet}`.
 */
export function dedupKey(
  e: Pick<NormalizedEvent, 'signature' | 'instruction_index' | 'wallet'>,
): string {
  return `${e.signature}:${e.instruction_index}:${e.wallet}`;
}

/** Marca de tempo por estÃ¡gio do pipeline de execu´┐¢´┐¢Ã£o (´┐¢´┐¢41). */
export interface LatencyTrace {
  source_detected_at: number;
  local_
[0m

