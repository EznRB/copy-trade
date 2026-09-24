## ADR-006 — Guard LIVE em falha fechada no carregamento de config

- **Contexto:** regra inviolável: LIVE exige dupla trava.
- **Decisão:** `@ct/config` lança erro fatal se `TRADING_MODE=LIVE` e `LIVE_TRADING_ENABLED!=true`.
- **Justificativa:** torna configuração incorreta impossível de executar, não apenas de detectar.
- **Status:** FACT.
