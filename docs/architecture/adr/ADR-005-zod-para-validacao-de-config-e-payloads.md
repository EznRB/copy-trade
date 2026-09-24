## ADR-005 — zod para validação de config e payloads

- **Contexto:** dados on-chain e variáveis de ambiente são hostis (§66, §131).
- **Decisão:** zod em `@ct/config` e na borda de ingestão.
- **Justificativa:** falha fechada na inicialização (config inválida nunca inicia o bot); schemas compartilháveis com `@ct/types`.
- **Status:** FACT.
