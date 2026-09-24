# Decision Log — Índice de ADRs

> **Estrutura:** um arquivo por decisão em `adr/`. Este índice é somente leitura de navegação.
> Novo ADR = novo arquivo `adr/ADR-0NN-<slug>.md` com número sequencial único + linha neste índice.
> **Regra anti-alucinação (AGENTS.md §8.3):** citar ADR por número; nunca párafrasear decisão de memória.
> Renumerados no split (2026-09-24): ex-011→021 (WSS Helius), ex-012→022 (env sem strict), ex-013→023 (fixture F1), ex-014→024 (retenção/single-instance).

| ADR | Título |
|---|---|
| [ADR-001](adr/ADR-001-npm-workspaces-como-gerenciador-de-monorepo.md) | npm workspaces como gerenciador de monorepo |
| [ADR-002](adr/ADR-002-postgresql-local-via-prisma-sem-acoplamento-ao-sup.md) | PostgreSQL local via Prisma (sem acoplamento ao Supabase) |
| [ADR-003](adr/ADR-003-dev-local-nativo-docker-apenas-para-o-servidor-fut.md) | Dev local nativo, Docker apenas para o servidor futuro |
| [ADR-004](adr/ADR-004-vitest-fast-check-pytest-hypothesis.md) | Vitest + fast-check / pytest + hypothesis |
| [ADR-005](adr/ADR-005-zod-para-validacao-de-config-e-payloads.md) | zod para validação de config e payloads |
| [ADR-006](adr/ADR-006-guard-live-em-falha-fechada-no-carregamento-de-con.md) | Guard LIVE em falha fechada no carregamento de config |
| [ADR-007](adr/ADR-007-sem-redis-na-fase-inicial.md) | Sem Redis na fase inicial |
| [ADR-008](adr/ADR-008-llm-fora-do-caminho-critico.md) | LLM fora do caminho crítico |
| [ADR-009](adr/ADR-009-perfis-de-agentes-versionados-no-repo.md) | Perfis de agentes versionados no repo |
| [ADR-010](adr/ADR-010-observedevent-wallet-como-address-string-sem-fk.md) | ObservedEvent.wallet como address (String), sem FK |
| [ADR-011](adr/ADR-011-stack-de-dados-solana-solana-kit-helius-sdk-yellow.md) | Stack de dados Solana: @solana/kit + helius-sdk + yellowstone-grpc |
| [ADR-012](adr/ADR-012-pump-fun-idl-vendored-nenhum-sdk-npm-de-terceiros.md) | Pump.fun: IDL vendored, nenhum SDK npm de terceiros |
| [ADR-013](adr/ADR-013-jupiter-dexscreener-birdeye-rugcheck-via-clientes-.md) | Jupiter/DexScreener/Birdeye/RugCheck via clientes HTTP internos |
| [ADR-014](adr/ADR-014-mcp-servers-no-ambiente-de-dev-opencode-json.md) | MCP servers no ambiente de dev (opencode.json) |
| [ADR-015](adr/ADR-015-stack-quantitativa-e-repos-de-referencia-avaliacao.md) | Stack quantitativa e repos de referência (avaliação 2026-09-24) |
| [ADR-016](adr/ADR-016-pump-fun-tem-sdk-docs-oficiais-revisao-parcial-do-.md) | Pump.fun TEM SDK/docs oficiais; revisão parcial do ADR-012 |
| [ADR-017](adr/ADR-017-aprendizados-arquiteturais-do-cutupdev-solana-copy.md) | Aprendizados arquiteturais do cutupdev/Solana-Copytrading-bot + status VectorBT/Optuna |
| [ADR-018](adr/ADR-018-chainstacklabs-pumpfun-bonkfun-bot-como-referencia.md) | chainstacklabs/pumpfun-bonkfun-bot como referência primária de arquitetura de bot |
| [ADR-019](adr/ADR-019-camada-de-streaming-vixen-shredstream-laserstream-.md) | Camada de streaming: vixen / shredstream / laserstream / shredtop |
| [ADR-020](adr/ADR-020-baseline-consolidado-de-repositorios-2026-09-24-ve.md) | Baseline consolidado de repositórios (2026-09-24, verificado via GitHub API) |
| [ADR-021](adr/ADR-021-endpoint-wss-helius-mainnet-helius-rpc-com-laserst.md) | Endpoint WSS Helius: mainnet.helius-rpc.com (LaserStream WebSocket) |
| [ADR-022](adr/ADR-022-schema-de-env-sem-zod-strict.md) | Schema de env SEM zod .strict() |
| [ADR-023](adr/ADR-023-fixture-de-smoke-f1-programa-pump-fun-como-alvo-de.md) | Fixture de smoke F1: programa Pump.fun como alvo de subscricao |
| [ADR-024](adr/ADR-024-risco-emergente-retencao-de-dados-e-single-instanc.md) | Risco emergente: retencao de dados e single-instance |
