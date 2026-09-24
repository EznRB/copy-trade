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

## ADR-015 — Stack quantitativa e repos de referência (avaliação 2026-09-24)

- **Contexto:** avaliação de lista externa (GPT) de MCPs/repos/tópicos quant para o projeto.
- **Decisões positivas:**
  - **Serena MCP** instalado (navegação semântica da codebase; único MCP novo aprovado).
  - **VectorBT** e **Optuna**: stack Python da F5/F7 (backtest vetorizado de sinais + HPO com walk-forward externo obrigatório — anti-overfit). Instalar apenas na fase correspondente.
  - **Referências de arquitetura (leitura, não dependência):** `nautechsystems/nautilus_trader` (engine event-driven), `freqtrade` (dry-run = análogo do nosso PAPER; risk controls), `hummingbot` (separação strategy/executor/backtest).
- **Decisões negativas (com motivo):**
  - `pumpfun-mcp` e MCPs comunitários de dados on-chain: **bloqueados** (autor anônimo, dados hostis no contexto do LLM — regras §2/§4; nosso caminho é IDL vendored + parser validado por fixtures).
  - Orderflow (CVD/VPIN/OFI off-the-shelf): inaplicável — não há order book em AMM/bonding curve. Análogo válido: desequilíbrio de fluxo de swaps por slot + impacto na curva (feature própria, F3/F4).
  - Options/IV walls/expected range: inaplicável — memecoins não têm mercado de opções. HV realizada migra como feature de Token Risk (F3).
  - SMC (FVG/OB/BOS/CHoCH): entra apenas como **HYPOTHESIS testável** com walk-forward; nunca como regra. Sem evidência estatística prévia.
  - ORB: re-frameado para "primeiros N minutos pós-launch do token" (opening range do bonding curve) — candidato de feature F4, não estratégia pronta.
  - axiom.trade / j7 tracker / GMGN: benchmark de UX/métricas para o dashboard futuro; sem API pública confiável; não integrar.
  - "Estratégias de smart money/manipulação": estudar como **defesa** (heurísticas do Risk Engine: sandwich, rug patterns, dedump). Executar manipulação está fora do escopo ético/legal do projeto.
  - Twitter monitor: válido para F3, mas só via API oficial paga (scraping = ToS frágil); DexScreener/Helius primeiro.
- **Status:** FACT (decisões). Serena verificado conectado (10/10 MCPs).

## ADR-014 — MCP servers no ambiente de dev (opencode.json)

- **Contexto:** seleção de MCPs/plugins para dev; pesquisa avaliou manutenção, autoridade e risco de supply-chain.
- **Decisão:** apenas remotos oficiais: Context7 (docs atualizadas — mitiga "nunca inventar endpoint") e GitHub MCP (repos/issues/PRs). Playwright MCP adiado p/ fase do dashboard. Postgres MCP opcional (dev read-only) quando necessário.
- **Evitados:** qualquer MCP comunitário de Solana/Helius/Jupiter (dados hostis injetados no contexto do LLM + autores não verificados); oh-my-opencode (hooks/telemetria conflitam com a arquitetura de agentes versionada do projeto).
- **Status:** FACT.

## ADR-011 - Endpoint WSS Helius: mainnet.helius-rpc.com (LaserStream WebSocket)

- **Contexto:** smoke test F1 retornou HTTP 403 em `wss://atlas-mainnet.helius-rpc.com`.
- **Decisao:** usar `wss://mainnet.helius-rpc.com/?api-key=...` (LaserStream WebSocket).
- **Evidencia:** documentacao oficial Helius (helius.dev/docs/api-reference/endpoints), verificada em 2026-09-22. Timer de inatividade de 10 min — heartbeat de 30s ja implementado cobre.
- **Status:** FACT.

## ADR-012 - Schema de env SEM zod .strict()

- **Contexto:** `envSchema.strict()` rejeitava todas as variaveis do OS presentes em `process.env`, impedindo boot.
- **Decisao:** validar apenas chaves conhecidas; desconhecidas sao ignoradas (zod default, sem .strict()).
- **Status:** FACT. Seguranca mantida: tipos e limites ainda validados; chaves desconhecidas nunca sao usadas.

## ADR-013 - Fixture de smoke F1: programa Pump.fun como alvo de subscricao

- **Contexto:** gate F1 exige "eventos reais observados" mas ainda nao existe lista de wallets.
- **Decisao:** subscrever o endereco publico do programa Pump.fun (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) — volume alto e publico, ideal para validar throughput/dedup sem depender de input do usuario.
- **Resultado:** RESULT: 780.053 eventos em ~40min (~325/s), dedup funcionando (sigs unicas == total persistido).
- **Status:** FACT (validado com dados).

## ADR-014 - Risco emergente: retencao de dados e single-instance

- **Contexto:** smoke gerou 568 MB em 40min; executamos acidentalmente 2 processos de ingestao simultaneos.
- **Decisao:** registrar como debito tecnico da F1.5: (1) politica de retencao RAW→AGGREGATE (§63); (2) guard de instancia unica (lock file) no boot do servico.
- **Status:** FACT (risco medido), mitigacao pendente.
