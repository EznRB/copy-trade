## ADR-003 — Dev local nativo, Docker apenas para o servidor futuro

- **Contexto:** máquina de desenvolvimento com virtualização desligada.
- **Decisão:** desenvolvimento e testes rodam nativamente; Dockerfiles/compose ficam em `infrastructure/docker/` para deploy 24/7 futuro.
- **Justificativa:** impossibilidade técnica atual; Docker permanece especificado para produção (§118 do documento fonte).
- **Status:** FACT.
