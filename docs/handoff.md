# Handoff — Estado do Projeto

> Protocolo §8.1 do AGENTS.md: este arquivo é a memória entre sessões. Todo chat novo DEVE ler: AGENTS.md → docs/roadmap.md → docs/architecture/decision-log.md → este arquivo.

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
