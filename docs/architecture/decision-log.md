# Decision Log (ADRs)

Formato: cada decisão registra contexto, alternativas, decisão, justificativa e status (FACT/ASSUMPTION).

---

## ADR-001 — npm workspaces como gerenciador de monorepo

- **Contexto:** múltiplos apps/services/packages em um repo.
- **Alternativas:** pnpm workspaces, Turborepo, npm workspaces.
- **Decisão:** npm workspaces.
- **Justificativa:** zero dependência adicional, suporte nativo do Node 20 e do GitHub Actions. Turborepo/pnpm são otimizações que só se justificam com medição de gargalo de build (filosofia zero-cost-first).
- **Status:** FACT (decisão de scaffold). Revisitar se build > limiar medido.

## ADR-002 — PostgreSQL local via Prisma (sem acoplamento ao Supabase)

- **Contexto:** free tier do Supabase pode não cobrir ingestão 24/7 (limites de storage/conexões).
- **Alternativas:** Supabase free, Postgres nativo local, SQLite.
- **Decisão:** Prisma → PostgreSQL local nativo; Supabase como opção futura documentada.
- **Justificativa:** Prisma desacopla schema do backend; migrações versionadas; sem risco de quota surpresa. SQLite insuficiente para concorrência de ingestão.
- **Status:** FACT (decisão). Limites reais do Supabase: UNKNOWN (verificar doc oficial se/opção for retomada).

## ADR-003 — Dev local nativo, Docker apenas para o servidor futuro

- **Contexto:** máquina de desenvolvimento com virtualização desligada.
- **Decisão:** desenvolvimento e testes rodam nativamente; Dockerfiles/compose ficam em `infrastructure/docker/` para deploy 24/7 futuro.
- **Justificativa:** impossibilidade técnica atual; Docker permanece especificado para produção (§118 do documento fonte).
- **Status:** FACT.

## ADR-004 — Vitest + fast-check / pytest + hypothesis

- **Contexto:** documento fonte exige property-based tests (§148).
- **Decisão:** Vitest + fast-check (TS), pytest + hypothesis (Python).
- **Justificativa:** cobertura nativa de property testing nos dois runtimes; Vitest com ESM nativo e compatível com forks de Node 20.
- **Status:** FACT.

## ADR-005 — zod para validação de config e payloads

- **Contexto:** dados on-chain e variáveis de ambiente são hostis (§66, §131).
- **Decisão:** zod em `@ct/config` e na borda de ingestão.
- **Justificativa:** falha fechada na inicialização (config inválida nunca inicia o bot); schemas compartilháveis com `@ct/types`.
- **Status:** FACT.

## ADR-006 — Guard LIVE em falha fechada no carregamento de config

- **Contexto:** regra inviolável: LIVE exige dupla trava.
- **Decisão:** `@ct/config` lança erro fatal se `TRADING_MODE=LIVE` e `LIVE_TRADING_ENABLED!=true`.
- **Justificativa:** torna configuração incorreta impossível de executar, não apenas de detectar.
- **Status:** FACT.

## ADR-007 — Sem Redis na fase inicial

- **Contexto:** §64 do documento fonte: cache só quando medido.
- **Decisão:** nenhum cache externo; estado em Postgres.
- **Status:** FACT.

## ADR-008 — LLM fora do caminho crítico

- **Contexto:** regra §4.
- **Decisão:** LLMs auxiliam código/pesquisa/revisão; produção usa regras determinísticas + ML tabular versionado.
- **Status:** FACT.

## ADR-009 — Perfis de agentes versionados no repo

- **Contexto:** coordenação entre múltiplos agentes de IA.
- **Decisão:** `.agents/*.md` como fonte canônica + cópias com frontmatter em `.opencode/agents/`.
- **Status:** FACT.


## ADR-010 — ObservedEvent.wallet como address (String), sem FK

- **Contexto:** schema.prisma declarava Wallet.observedEvents ObservedEvent[], mas ObservedEvent.wallet é o address on-chain (String), não FK — prisma migrate diff falhava com P1012 (opposite relation ausente).
- **Decisão:** remover a relation observedEvents de Wallet. Eventos observados podem incluir wallets não rastreadas; relacionar por address exigiria unique constraint redundante. Dedup permanece via @@unique([signature, instructionIndex, wallet]).
- **Status:** FACT.

## ADR-011 — Stack de dados Solana: @solana/kit + helius-sdk + yellowstone-grpc

- **Contexto:** F1 (ingestion) precisa de SDK Solana e streaming de transações.
- **Alternativas:** `@solana/web3.js` v1 (legacy, manutenção), `@solana/kit` (v2 oficial, anza-xyz), QuickNode, Yellowstone gRPC (Triton).
- **Decisão:** `@solana/kit` (+ `@solana-program/token`/`system`), `helius-sdk` (Enhanced WS/LaserStream), `@triton-one/yellowstone-grpc` (client gRPC; NAPI nativo só existe p/ Linux — no Windows usar fallback JS puro ou WSL2).
- **Justificativa:** kit é o sucessor oficial; helius-sdk 3.x é construído sobre kit; gRPC é padrão da indústria p/ baixa latência. Arquitetura abstrai provider (`TransactionStreamProvider`) p/ trocar implementação sem reescrever consumidores.
- **Status:** FACT (instalado em `@ct/solana`). Risco: NAPI indisponível no Windows dev local — mitigado via fallback.

## ADR-012 — Pump.fun: IDL vendored, nenhum SDK npm de terceiros

- **Contexto:** pump.fun não publica SDK/IDL oficial; `pumpdotfun-sdk` (rckprtr) é autor individual, sem testes, estagnado desde mar/2025, preso a web3.js v1.
- **Decisão:** IDL comunitária **vendored** no repo (versionada, auditada), validada contra transações reais on-chain (fixtures de signatures conhecidas). Nenhuma dependência npm de "pump" de autor anônimo.
- **Justificativa:** supply-chain security (regra inviolável §2/§9); programa on-chain `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`. PumpSwap migrou parte do fluxo — IDLs podem estar desatualizadas, daí fixtures contra txs reais.
- **Status:** FACT (decisão). IDL específica ainda não escolhida: UNKNOWN até validação contra on-chain.

## ADR-013 — Jupiter/DexScreener/Birdeye/RugCheck via clientes HTTP internos

- **Contexto:** nenhum desses serviços tem SDK TS oficial mantido.
- **Decisão:** clientes HTTP internos finos com zod-validação, retry/timeout, rate-limit e circuit breaker. Jupiter: REST API (Ultra/Quote v6, Price v3). GMGN: evitar (sem API pública; scraping viola robustez/ToS).
- **Justificativa:** zero dependência externa = zero superfície de supply chain; alinhado com "SDK oficial > oficial > consolidada > comunitária".
- **Status:** FACT (decisão).

## ADR-014 — MCP servers no ambiente de dev (opencode.json)

- **Contexto:** seleção de MCPs/plugins para dev; pesquisa avaliou manutenção, autoridade e risco de supply-chain.
- **Decisão:** apenas remotos oficiais: Context7 (docs atualizadas — mitiga "nunca inventar endpoint") e GitHub MCP (repos/issues/PRs). Playwright MCP adiado p/ fase do dashboard. Postgres MCP opcional (dev read-only) quando necessário.
- **Evitados:** qualquer MCP comunitário de Solana/Helius/Jupiter (dados hostis injetados no contexto do LLM + autores não verificados); oh-my-opencode (hooks/telemetria conflitam com a arquitetura de agentes versionada do projeto).
- **Status:** FACT.
