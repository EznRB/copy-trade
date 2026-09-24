## ADR-022 - Schema de env SEM zod .strict()

- **Contexto:** `envSchema.strict()` rejeitava todas as variaveis do OS presentes em `process.env`, impedindo boot.
- **Decisao:** validar apenas chaves conhecidas; desconhecidas sao ignoradas (zod default, sem .strict()).
- **Status:** FACT. Seguranca mantida: tipos e limites ainda validados; chaves desconhecidas nunca sao usadas.
- **Nota de renumeracao:** ex-ADR-012 (numero duplicado; renumerado no split de 2026-09-24).
