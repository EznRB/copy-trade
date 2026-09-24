## ADR-002 — PostgreSQL local via Prisma (sem acoplamento ao Supabase)

- **Contexto:** free tier do Supabase pode não cobrir ingestão 24/7 (limites de storage/conexões).
- **Alternativas:** Supabase free, Postgres nativo local, SQLite.
- **Decisão:** Prisma → PostgreSQL local nativo; Supabase como opção futura documentada.
- **Justificativa:** Prisma desacopla schema do backend; migrações versionadas; sem risco de quota surpresa. SQLite insuficiente para concorrência de ingestão.
- **Status:** FACT (decisão). Limites reais do Supabase: UNKNOWN (verificar doc oficial se/opção for retomada).
