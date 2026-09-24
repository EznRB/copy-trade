## ADR-001 — npm workspaces como gerenciador de monorepo

- **Contexto:** múltiplos apps/services/packages em um repo.
- **Alternativas:** pnpm workspaces, Turborepo, npm workspaces.
- **Decisão:** npm workspaces.
- **Justificativa:** zero dependência adicional, suporte nativo do Node 20 e do GitHub Actions. Turborepo/pnpm são otimizações que só se justificam com medição de gargalo de build (filosofia zero-cost-first).
- **Status:** FACT (decisão de scaffold). Revisitar se build > limiar medido.
