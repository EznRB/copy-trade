# FINDINGS — Registro único de achados do Red Team

> IDs sequenciais `RT-NNN`, nunca reutilizar. Template obrigatório definido em `.agents/red-team.md`.
> CRITICAL/HIGH notificam orchestrator + risk-security imediatamente.

## Resumo

| Total | OPEN | FIX-IN-REVIEW | FIXED-VERIFIED | ACCEPTED | FALSE-POSITIVE |
| ----- | ---- | ------------- | -------------- | -------- | -------------- |
| 6     | 3    | 0             | 2              | 1        | 0              |

## Findings

### RT-001 — Dependências dev (vitest/vite/esbuild) com CVEs (1 CRITICAL, 1 HIGH, 2 moderate)
- Severidade: HIGH (mapeada a CRITICAL no CVE do vitest, mas impacto real é dev-only)
- Status: FIXED-VERIFIED
- Arquivo/linha: `package.json` (`vitest ^1.6.0`), `services/data-ingestion/package.json` (`vitest ^1.5.0`)
- Descrição: `vitest <=3.2.5` com CVE crítico (vulnerabilidade no dev server/API do vitest), `vite <=6.4.2` high, `esbuild <=0.24.2` moderate. Apenas devDependencies — não afetam runtime de produção, mas um CVE crítico no dev server é explorável durante desenvolvimento.
- PoC: `npm audit --audit-level=high` → 4 vulnerabilities (2 moderate, 1 high, 1 critical).
- Impacto realista: execução de código no ambiente de dev ao rodar testes com arquivos maliciosos (dev-only).
- CWE/OWASP: CWE-1395 (Dependency with known CVEs).
- Agente dono sugerido: devops/red-team (fix direto por ser dev-dep).
- Fix verificado em: vitest `^1.6.0`→`^3.2.7` em ambos os workspaces; `npm audit fix`; `npm test` (34/34), `lint`, `typecheck` OK. Restam 2 moderate (`@vitest/mocker`, `vitest`) que só resolvem com major bump para vitest 4.x — ver RT-002.

### RT-002 — Vulnerabilidades moderate residuais exigem vitest 4.x (major)
- Severidade: LOW (moderate do npm audit, dev-only, risk aceito temporariamente)
- Status: ACCEPTED
- Arquivo/linha: `package.json` (`vitest ^3.2.7`)
- Descrição: `@vitest/mocker` e `vitest` moderate só são corrigidos com upgrade para vitest 4.x (mudança major, pode quebrar config de testes). Prioridade baixa pois é dev-only e CVSS moderado.
- PoC: `npm audit --json`.
- Impacto realista: baixo; revisar quando vitest 4.x estabilizar ou quando o pipeline de testes for migrado.
- CWE/OWASP: CWE-1395.
- Agente dono sugerido: devops.
- Fix verificado em: — (pendente).

### RT-003 — check-secrets falhava no CI e tinha falso negativo em `*_PRIVATE_KEY=`- Severidade: HIGH (falso negativo: o controle de secrets não detectava o formato mais comum de vazamento em `.env`; e falharia silenciosamente no CI Ubuntu por chamar `powershell`)
- Status: FIXED-VERIFIED
- Arquivo/linha: `infrastructure/scripts/check-secrets.ps1` (removido), `package.json` (`check:secrets`)
- Descrição: (a) o script era Windows PowerShell, mas o CI roda Ubuntu → etapa quebrava no CI; (b) o regex era case-sensitive e só cobria `private_key=` minúsculo — `WALLET_PRIVATE_KEY=5Kd...` (formato típico de vazamento) passava sem alerta; (c) falso positivo em comentários (alinhado ao RT da sprint 1).
- PoC: plantar `.env.planted-test` com `WALLET_PRIVATE_KEY=<base58>` → antes do fix: exit 0 (não detectado). Após fix: exit 1, finding em `.env.planted-test:1`.
- Impacto realista: secret real commitado poderia passar pela proteção e chegar ao CI/repo.
- CWE/OWASP: CWE-798 (Use of hard-coded credentials) — ausência de detecção.
- Agente dono sugerido: red-team (fix direto, ferramenta dele).
- Fix verificado em: port para `check-secrets.mjs` (Node, cross-platform), regex case-insensitive + `private[_ -]?key\s*[:=]`, comentários ignorados, base58 64–88 mantido. Teste positivo (planta detectada) e negativo (repo limpo) executados nesta sessão.

<!-- ==== SPRINT 2 (auditoria F1, pós-merge 6b1ed97) ==== -->

### RT-004 — Schema de ingestão aceita strings ilimitadas (DoS de memória/DB)
- Severidade: MEDIUM
- Status: OPEN
- Arquivo/linha: `services/data-ingestion/src/schemas.ts:20-27` (`signature`, `wallet` — `z.string().min(1)` sem `.max()`)
- Descrição: `parseRawNotification` não limita tamanho. Uma única notificação com `signature` de 10 MB é aceita, propagada ao `logsNotification` handler (`helius-provider.ts:299–311`), ao payload Prisma e ao cache LRU de dedup (50k entradas). Um peer WSS hostil/comprometido (ou dado corrompido em massa) pode inflar memória do processo e tabela `ObservedEvent`.
- PoC: `docs/security/red-team/poc/sprint2-ingestion.poc.test.ts` → ATAQUE 2 ("signature de 10 MB é aceita").
- Impacto realista: OOM sobre carga adversarial; crescimento descontrolado do DB. Não afeta integridade lógica (dedup continua correto).
- CWE/OWASP: CWE-770 (Allocation of Resources Without Limits) / OWASP API4:2023.
- Agente dono sugerido: solana-ingestion (fix: `z.string().min(1).max(128)` para signature/wallet + `.max(2_000_000)` em slot/block_time).
- Fix verificado em: —

### RT-005 — Deduplicação concorrente infla contadores (métricas mentirosas)
- Severidade: LOW
- Status: OPEN
- Arquivo/linha: `services/data-ingestion/src/dedup-store.ts:73-96`
- Descrição: `checkAndPersist` libera fast-path antes do insert. Num burst simultâneo (ex.: reconnect storm), 50 chamadas com a mesma key retornam status `'new'` e incrementam `counters.ingested` de 0 → 50, embora apenas 1 persistirá e 49 se tornarão P2002. Contadores `ingested`/`deduplicated` ficam inflados num fator proporcional ao tamanho do burst, degradando o SLO e mascarando DoS real.
- PoC: `docs/security/red-team/poc/sprint2-ingestion.poc.test.ts` → ATAQUE 3 ("REPLAY CONCORRENTE: 50 chamadas simultâneas").
- Impacto realista: métricas operacionais erradas durante incidentes; alertas baseados em `ingested`/`rate` enganosos. Não causa dupla persistência (o banco é a autoridade final).
- CWE/OWASP: CWE-367 (TOCTOU — time-of-check/time-of-use).
- Agente dono sugerido: solana-ingestion (fix: dedup em fila com in-flight map, ou contabilizar só após insert concluído com sucesso real).
- Fix verificado em: —

### RT-006 — Signature unicode hostil aceita sem allowlist base58 (risco de log poisoning)
- Severidade: LOW
- Status: OPEN
- Arquivo/linha: `packages/solana/src/helius-provider.ts:299-311` + `packages/types` (`dedupKey`)
- Descrição: `logsNotification` aceita qualquer string para `signature` — incluindo chars de controle (`\u0000`, `\u202E` RTL override, emoji). Como a signature vira parte da `dedupKey` e aparece em logs (`pipeline.ts:72`, `logger.warn/error`), isso abre **log injection/forging**: um log forjado pode esconder erros reais ou simular eventos falsos para o operador. Não é escalonado a CRITICAL porque logs não são parsed por sistema crítico (por enquanto).
- PoC: `docs/security/red-team/poc/sprint2-ingestion.poc.test.ts` → ATAQUE 2 ("caracteres de controle/unicode hostil aceitos").
- Impacto realista: confusão operacional / esconderijo em log forense. Aumenta risco se os logs forem ingeridos por ferramenta de monitoramento que parseia estrutura.
- CWE/OWASP: CWE-117 (Improper Output Neutralization for Logs).
- Agente dono sugerido: solana-ingestion (fix: validar `^[1-9A-HJ-NP-Za-km-z]{86,88}$` para signature).
- Fix verificado em: —

<!-- Template para novos achados:

### RT-NNN — Título
- Severidade: CRITICAL | HIGH | MEDIUM | LOW
- Status: OPEN
- Arquivo/linha:
- Descrição:
- PoC (como reproduzir):
- Impacto realista:
- CWE/OWASP:
- Agente dono sugerido:
- Fix verificado em:
-->
