## ADR-023 - Fixture de smoke F1: programa Pump.fun como alvo de subscricao

- **Contexto:** gate F1 exige "eventos reais observados" mas ainda nao existe lista de wallets.
- **Decisao:** subscrever o endereco publico do programa Pump.fun (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) — volume alto e publico, ideal para validar throughput/dedup sem depender de input do usuario.
- **Resultado:** RESULT: 780.053 eventos em ~40min (~325/s), dedup funcionando (sigs unicas == total persistido).
- **Status:** FACT (validado com dados).
- **Nota de renumeracao:** ex-ADR-013 (numero duplicado; renumerado no split de 2026-09-24).
