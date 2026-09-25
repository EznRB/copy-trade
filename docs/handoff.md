# Handoff — Estado do Projeto

> Protocolo §8.1 do AGENTS.md: este arquivo é a memória entre sessões. Todo chat novo DEVE ler: AGENTS.md → docs/roadmap.md → docs/architecture/decision-log.md → este arquivo.

---

## 2026-09-25 — F1.5 round 2 (review rejeitado corrigido)

Novos commits na branch sprint/f1-5-enrichment (aguardando REVIEW de cada um; merge so com todos APROVADOS):
- `fd6a5a6` — testes dos 4 metodos de enrichment (repos) + guarda TOCTOU (updateMany com enrichedAt IS NULL) + schema.prisma ASCII.
- `cc64b8d` — testes do helius-provider (per-wallet subs, base58, unsubscribe, anti-orfao, reconnect storm) + maxReconnects terminal.
- `6cd436b` — fixtures rigorosos campo-a-campo; decoder corrigido: base=wSOL inverte lado do token; divergencias listadas.
- `799d048`/`812ef1a` — instance lock com staleness por idade + lint fix.

Gates na branch agora: lint 0 · typecheck 0 · test 105/105 · check:secrets OK. Fixtures: sample=10, pumpswap=9, perfectMatches=5, divergences=5 (semanticas, listadas).

---

## 2026-09-24 — F1.5 (enrichment) IMPLEMENTADA — aguardando review/SEC/dono

### O que foi feito (branch `sprint/f1-5-enrichment`)

- `5c84a74` — débitos ADR-024: alias ADR-014→ADR-024 nos comentários; **retenção RAW virou opt-in** (purge nunca default-on).
- `88152bb` — schema `ObservedEvent` com enrichment (direction/amountSol/tokenAmount/mint/counterparty/enrichSource/enrichedAt/enrichAttempts) + migration offline + repositories (markEnriched/findUnenriched/incrementEnrichAttempt/markUndecodable).
- `dddb30b` — **decoder codama** a partir da IDL oficial pump.fun/PumpSwap (`pump-public-docs @81091419`): `decodePumpInstruction`, 14/14 testes adversariais; script `codama.pump.mjs` reproduzível (com postprocess documentado) + fix ESM pós-build.
- `c438ef1` — `enricher.ts` + `enrich-runner.ts` + wiring no boot do data-ingestion; 85/85 testes no monorepo.
- `2ab477f` — fixes de runtime descobertos: `maxSupportedTransactionVersion: 1`; `logsSubscribe` 1-endereço; fixtures reais 10/10 vs Helius Enhanced (8 PumpSwap + 2 curve).
- `38cdaac` — higiene (locks fora do repo) + artefatos.

### Métricas do gate (evidência em `docs/research/f15/`)

- Fixtures: 10/10 1:1 com Helius Enhanced na amostragem final (16/16 na rodada inicial sem AMM). mismatch=0.
- Backfill one-shot 10k: enriched=1914 (**19.1%**), undecodable=8086 (transfers/creates sem swap — correto), errors=0, elapsed ~69min.

### Bugs corrigidos no caminho (todos no code + ADR-025)

1. `maxSupportedTransactionVersion` 0→1 (tx v1 existe desde runtime atual).
2. Helius free logsSubscribe aceita 1 endereço → provider agora 1 sub/endereço.
3. Enhanced API: endpoint correto é `api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem `/` antes de `?`); `api.helius.dev` não resolve no DNS local.
4. Codama: awaits + flatten + @ts-nocheck apenas nos gerados.

### NÃO-Fecho da fase

Conforme instrução: a F1.5 **não é concluída por mim**. Próximos passos: REVIEW automático dos SHAs → SEC re-teste (PoCs) → dono aprova merge/evolução para F2.

### Próximo passo

Sprint F2 (wallet monitor) pode começar do enricher pronto; pendências não-bloqueantes: retenção opt-in permanece desligada por padrão (ADR-024), credenciais Helius continuam a aguardar rotação.

---

## 2026-09-23 — F1 + sprint de segurança FORMALMENTE ENCERRADAS

### Estado
- **F1 CONCLUÍDA** (roadmap já marca CONCLUÍDA); sprint `f1-security-fixes-2` mergeada em `087a3e3` (gates verdes, 51/51).
- SEC veredito final: **LIBERADO** — 0 findings OPEN (RT-004/005/006 FIXED-VERIFIED; PoCs viraram regressão permanente em `docs/security/red-team/poc/`, 17/17).
- Gate de merge endurecido após o incidente de race (pull obrigatório + último veredito + state.json).

### Pendências não-bloqueantes
1. RT-004: corpo do finding ainda diz "Status: OPEN" (resumo está correto) — corrigir na próxima interação com o SEC.
2. Rotação de credenciais ainda não feita: Helius API key + GitHub PAT (vazaram em histórico de chat).
3. `security-fixes.test.ts` — verificar no próximo diff se o encoding continua Bin.
4. F1.5 (enrichment BUY/SELL) ficou explícita no roadmap como fase intermediária antes da F2.

### Próximo passo exato
Decisão do dono: F1.5 (enrichecer eventos com lado/valores do swap) OU F2 direto (wallet monitor). Recomendação: F1.5 primeiro — o SEC já havia condicionado F1.5 ao RT-004 (agora fechado), e a F2 sem BUY/SELL produz wallets com métricas vazias.

---

## 2026-09-23 — INCIDENTE: merge com commit REJEITADO (race no gate) + fixes pendentes

### O que aconteceu
- Sprint `sprint/f1-security-fixes` mergeada em `c1430a4`. Os fixes reais estão todos em `ea88b46` (APROVADO). O tip `19ffacc` era um **commit vazio** com mensagem "fix RT-005" — o watcher primeiro aprovou, depois re-revisou como **REJEITADO** (`docs/reviews/19ffacc…md`), mas o `merge-sprint.ps1` leu o veredito antes do flip (race). Nenhum código ruim entrou (commit vazio; master == conteúdo do pai APROVADO, 48/48 testes verdes).
- **Mitigação commitada** (`676bc50`): `merge-sprint.ps1` agora faz `git pull` antes de verificar, usa o **último veredito** do arquivo e cruza com `state.json.rejected`.

### Bugs reais abertos (da revisão adversarial do commit vazio — a revisão real mais útil do dia)
RT-005 **NÃO está fechado**. Achados em `docs/reviews/19ffacc…md`:
1. **MEDIUM** — waiter→leader recursivo sem teto: burst + DB falhando = N inserts em série, contadores mentem de novo (`dedup-store.ts`, ramo `leaderOutcome.status === 'error'`).
2. **MEDIUM** — sync-throw do `repo.create` deixa entrada stale no `inFlight` → hang infinito na 2ª chamada (fix: `finally { if (this.inFlight.get(key) === promise) this.inFlight.delete(key); }`).
3. **MEDIUM** — zero testes dos caminhos de erro do in-flight map.
4. **LOW** — `security-fixes.test.ts` commitado com encoding corrompido (git trata como Bin; diffs opacos).
5. **LOW** — FINDINGS.md não atualizado (SEC atualiza após re-teste).

### Próximo passo exato
1. DONO → DEV (MSG de fix, ver chat): corrigir achados 1-4 acima em sprint `sprint/f1-security-fixes-2`.
2. Merge gate → SEC re-testa com PoCs e fecha/rebaixa RT-004/005/006 no FINDINGS.md.
3. Só então MSG 1 abrindo a F2 (wallet monitor).

### Regras reforçadas pelo incidente
- Commit vazio com claim de fix = falha de processo do DEV; REVIEW bloqueia, e agora o gate bloqueia também por veredito final + state.
- CÉREBRO só roda merge depois de o watcher estar quieto (esperar ~2min após último veredito novo em docs/reviews/).

---

## 2026-09-22 — FASE 1 CONCLUÍDA (branch `sprint/f1-postgres-live`)

### O que foi feito (com SHAs)

- `887e516` — ajustes de tooling herdados de sessão anterior (vitest 3, check-secrets em .mjs, opencode postgres MCP)
- `6d984e2` — `.gitignore`: `*.tsbuildinfo`
- `0b7f55e` — F1: subscrição via `INGESTION_WATCH_ADDRESSES`, entrypoint `main.ts`, alinhamento do pipeline ao schema real de `ObservedEvent` (signature/instructionIndex/wallet/eventType/slot/payload)
- `609a1a6` — fix: endpoint WSS Helius correto (`mainnet.helius-rpc.com`, ADR-011); schema de env sem `.strict()` (ADR-012)
- `ffc094c` — limpeza de artefatos locais

### Gate F1 — APROVADO (evidência)

- Smoke test contra mainnet (Helius WSS, fixture público = programa Pump.fun): **780.053 eventos persistidos em ~40 min**, dedup funcional (unique constraint rejeitando re-deliveries; zero colisões persistidas), zero trades.
- Gates: `lint` 0 erros, `typecheck` 0 erros, `test` 34/34, `check:secrets` limpo.
- Infra local: PostgreSQL instalado e rodando em localhost:5432; banco `copytrade` migrado (`000000000000_init`).

### Em andamento / pendente

- **F1.5 (próxima sprint):** enriquecimento via `getTransaction` — identificar a wallet do filtro `mentions`, classificar BUY/SELL, extrair `token_mint`/amounts. Hoje `eventType=UNKNOWN` e `wallet=UNKNOWN` para todos os eventos (FACT — ver limitação abaixo).
- **Débitos aceitos:** (1) guard de instância única (dois processos rodaram por acidente — ADR-014); (2) política de retenção (568 MB em 40 min — ADR-014); (3) reconciliar endpoints: `SOLANA_RPC_WSS` deve apontar para o mesmo host documentado.
- **Credenciais:** a Helius API key foi compartilhada em chat — **recomendado rotacionar** (dashboard.helius.dev) e atualizar apenas o `.env` local (nunca commitar).

### Limitação arquitetural conhecida (não é bug)

`logsSubscribe`/`logsNotification` não informa qual endereço do filtro `mentions` disparou o evento nem o `instruction_index`. Dedup atual é por `signature` (wallet=UNKNOWN, instruction_index=0). Correto para F1; a atribuição por wallet depende do enriquecimento (F1.5), momento em que a chave de dedup passa a ser significativa por wallet.

### Processo (coordenação multi-chat)

- Trabalho feito no worktree `../copytrade-wt-f1-postgres-live`, branch `sprint/f1-postgres-live`, seguindo §7.1.
- Aguardando revisão autônoma (`docs/reviews/<sha>.md`) antes de merge em master.

### Próximo passo exato

Criar sprint `f15-enrichment`: implementar `services/data-ingestion/src/enricher.ts` que, para cada evento persistido, chama `getTransaction` (via `RpcProvider` com failover) e preenche wallet/atores, action BUY/SELL e mint — com rate limiting e cache; testes unit + replay com fixtures de transações reais.
