# token-monitor

- **Responsabilidade:** monitorar tokens e avaliar riscos (Token Risk, Creator Risk).
- **Entradas:** eventos de novos tokens/transações do data-ingestion; metadata on-chain (validada com zod).
- **Saídas:** avaliações de risco de token para feature-engine/signal-engine.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
