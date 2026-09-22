# wallet-monitor

- **Responsabilidade:** monitorar e classificar wallets smart-money (Wallet Score, clusters).
- **Entradas:** eventos de transações ingeridos pelo data-ingestion.
- **Saídas:** classificações e scores de wallets para feature-engine/signal-engine.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
