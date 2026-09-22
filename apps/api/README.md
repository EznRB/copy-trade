# api

- **Responsabilidade:** API HTTP de consulta (health, posições, métricas) para o dashboard e operadores.
- **Entradas:** requisições HTTP autenticadas; estado dos serviços internos.
- **Saídas:** JSON de status, posições, PnL decomposto e métricas.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
