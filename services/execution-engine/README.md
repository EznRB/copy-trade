# execution-engine

- **Responsabilidade:** construir e (quando permitido) enviar ordens; modos PAPER/SHADOW/LIVE com dupla trava.
- **Entradas:** ordens aprovadas pelo risk-engine.
- **Saídas:** ordens simuladas ou transações enviadas, com decomposition de fees/slippage.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`. Nunca habilita LIVE automaticamente.
