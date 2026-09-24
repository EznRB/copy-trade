## ADR-013 — Jupiter/DexScreener/Birdeye/RugCheck via clientes HTTP internos

- **Contexto:** nenhum desses serviços tem SDK TS oficial mantido.
- **Decisão:** clientes HTTP internos finos com zod-validação, retry/timeout, rate-limit e circuit breaker. Jupiter: REST API (Ultra/Quote v6, Price v3). GMGN: evitar (sem API pública; scraping viola robustez/ToS).
- **Justificativa:** zero dependência externa = zero superfície de supply chain; alinhado com "SDK oficial > oficial > consolidada > comunitária".
- **Status:** FACT (decisão).
