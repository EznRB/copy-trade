# Handoff entre chats/sessões

> Protocolo: AGENTS.md §8.1. Bloco mais recente no topo.

---

## 2026-09-22 — Setup de ambiente + F1 em andamento

### Feito (chat de tooling/orquestração)
- Dependências F1 instaladas em `@ct/solana`: `@solana/kit@6.10`, `helius-sdk@3.2`, `@triton-one/yellowstone-grpc@7.0`, `@solana-program/token`, `@solana-program/system`.
- ADRs 011–014 no `docs/architecture/decision-log.md` (stack kit/helius/grpc; pump.fun = IDL vendored; Jupiter/DexScreener/Birdeye/RugCheck = clientes HTTP internos com zod; política de MCPs).
- Fix de 2 erros de typecheck pré-existentes em `packages/solana/src` (`rpc-provider.ts`, `helius-provider.ts`).
- MCPs configurados no `opencode.json` (9/9 conectados): context7, github (via `{env:GITHUB_TOKEN}`, env var de usuário do Windows), solana, helius-docs, sequential-thinking, memory, playwright, chrome-devtools, postgres (connection string literal de dev).
- `.env` criado com `HELIUS_API_KEY` validada contra mainnet (RPC, DAS, priority fee, enhanced tx `/v0/addresses/...`).
- **Atenção:** chave Helius e token GitHub expostos no histórico de chat — rotação pendente.
- Arquivo `scripts/ensure-watcher.ps1` criado por outra sessão (chat dev F1) — não auditado ainda.

### Em andamento (chat de desenvolvimento F1)
- Código F1 pronto e testado (28 testes verdes): `packages/solana` (providers, backoff) + `services/data-ingestion` (pipeline, normalizer, dedup-store).
- **Pendente (gate F1):** rodar ingestão contra mainnet real + Postgres local; medir dedup/latência; persistir eventos; commitar.

### Próximo passo exato
1. Chat dev F1: concluir gate F1 (eventos reais persistidos, dedup sob reconnect) e **commitar**.
2. Após commit: revisão externa (chat de orquestração) contra os gates da F1.
3. Só então abrir F2 (wallet monitor).

### Regras novas relevantes
- Nenhum threshold/config em código — sempre `@ct/config` + zod.
- Yellowstone gRPC: sem binário nativo no Windows — usar client JS puro no dev; NAPI só no servidor Linux futuro.
