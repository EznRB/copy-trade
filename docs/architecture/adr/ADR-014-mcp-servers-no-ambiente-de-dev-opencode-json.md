## ADR-014 — MCP servers no ambiente de dev (opencode.json)

- **Contexto:** seleção de MCPs/plugins para dev; pesquisa avaliou manutenção, autoridade e risco de supply-chain.
- **Decisão:** apenas remotos oficiais: Context7 (docs atualizadas — mitiga "nunca inventar endpoint") e GitHub MCP (repos/issues/PRs). Playwright MCP adiado p/ fase do dashboard. Postgres MCP opcional (dev read-only) quando necessário.
- **Evitados:** qualquer MCP comunitário de Solana/Helius/Jupiter (dados hostis injetados no contexto do LLM + autores não verificados); oh-my-opencode (hooks/telemetria conflitam com a arquitetura de agentes versionada do projeto).
- **Status:** FACT.
