# data-ingestion

- **Responsabilidade:** pipeline de ingestão de dados on-chain Solana (providers, event pipeline, deduplicação).
- **Entradas:** streams de transações/eventos de providers Solana; config via `@ct/config`.
- **Saídas:** eventos normalizados e deduplicados para consumo dos monitores (wallet/token).
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
