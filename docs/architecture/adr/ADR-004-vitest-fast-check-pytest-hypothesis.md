## ADR-004 — Vitest + fast-check / pytest + hypothesis

- **Contexto:** documento fonte exige property-based tests (§148).
- **Decisão:** Vitest + fast-check (TS), pytest + hypothesis (Python).
- **Justificativa:** cobertura nativa de property testing nos dois runtimes; Vitest com ESM nativo e compatível com forks de Node 20.
- **Status:** FACT.
