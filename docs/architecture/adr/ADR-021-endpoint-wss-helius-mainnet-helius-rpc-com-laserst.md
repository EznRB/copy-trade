## ADR-021 - Endpoint WSS Helius: mainnet.helius-rpc.com (LaserStream WebSocket)

- **Contexto:** smoke test F1 retornou HTTP 403 em `wss://atlas-mainnet.helius-rpc.com`.
- **Decisao:** usar `wss://mainnet.helius-rpc.com/?api-key=...` (LaserStream WebSocket).
- **Evidencia:** documentacao oficial Helius (helius.dev/docs/api-reference/endpoints), verificada em 2026-09-22. Timer de inatividade de 10 min — heartbeat de 30s ja implementado cobre.
- **Status:** FACT.
- **Nota de renumeracao:** ex-ADR-011 (numero duplicado; renumerado no split de 2026-09-24).
