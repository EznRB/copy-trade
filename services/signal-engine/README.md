# signal-engine

- **Responsabilidade:** gerar sinais de trade determinísticos (Consensus, Signal Score) — nunca via LLM.
- **Entradas:** features do feature-engine; regras versionadas (`strategy_id`/`strategy_version`).
- **Saídas:** sinais com `correlation_id` para risk-engine.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
