## ADR-020 — Baseline consolidado de repositórios (2026-09-24, verificado via GitHub API)

Lista final avaliada; todos confirmados existentes e mantidos salvo nota. Nada a instalar fora do já previsto nesta data.

**CORE (já integrados ou referência ativa):**
- `pump-fun/pump-public-docs`, `pump-fun/pump-fun-skills` — ADR-016 (skils = leitura, não instalar).
- `rpcpool/yellowstone-grpc` (+dep instalada), `yellowstone-vixen` (ref, ADR-019), `helius-sdk` (instalado), `helius-labs/core-ai` (27★, MIT — referência; já cobre o helius-docs MCP), `jito-labs/jito-docs` (refs F9).
- `solana-foundation/solana-dev-skill` (560★, MIT, ativo) — **skill oficial de conhecimento Solana**: candidata a instalação como skill de leitura para agentes; decidir com dono antes de ativar.
- `solana-foundation/solana-mcp-official` — já conectado via `mcp.solana.com`.

**Novos aprovados com papel definido:**
- **`codama-idl/codama`** (470★, MIT, TS, ativo) — gerador de clientes TS (kit-native) a partir de IDL. **F1.5/F3:** usar com a IDL oficial do `pump-public-docs` para gerar decoder tipado em vez de escrever à mão. Saída gerada entra em testes por fixtures (regra §4 mantida).
- **`solana-foundation/surfpool`** (602★, Apache-2.0, ativo) — simulador local mainnet-like. **F8 (SHADOW)**: testar ordens reais construídas contra estado simulado sem arriscar rede. Forte candidato a reduzir o custo do gate F8.
- **`solanatracker/data-api-sdk`** (22★, TS, sem licença visível) — provider candidato de enrichment (wallet PnL, token data) para F2/F3. Requer API key (paga em tier útil). Verificar termos/licença antes de depender; alternativa primária permanece Helius.
- **`pola-rs/polars`** (40k★, MIT) + **`duckdb/duckdb`** (42k★, MIT) — stack de dados F5: Polars p/ transformação, DuckDB p/ SQL analítico sobre Parquet do data lake. Instalar só na F5.
- **`PLhery/node-twitter-api-v2`** (1.5k★, Apache-2.0) — biblioteca da F3-social **quando** a API paga do X for contratada; antes disso nada de scraping.

**Alternativas registradas / adiadas:**
- `sevenlabs-hq/carbon` (624★, MIT, Rust) — alternativa ao vixen; sem necessidade agora.
- `rpcpool/yellowstone-jet` (98★, **AGPL-3.0**) — envio de tx via gRPC; candidato F9 junto a Jito, mas AGPL exige revisão de licenciamento antes de qualquer embed.
- `bloXroute-Labs/solana-trader-client-rust` (14★, MIT) — vendor-specific; avaliar só se entrarmos em bloXroute; não depender.

**Regra transversal reafirmada:** referência ≠ dependência; dependência entra só com licença checada + fase correspondente + zod na borda.

- **Status:** FACT.
