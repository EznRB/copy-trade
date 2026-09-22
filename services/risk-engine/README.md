# risk-engine

- **Responsabilidade:** validar/vetar qualquer trade (veto absoluto), circuit breakers, kill switch.
- **Entradas:** sinais do signal-engine; limites de risco via `@ct/config`.
- **Saídas:** decisão approve/reject com motivo classificado, audit log.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
