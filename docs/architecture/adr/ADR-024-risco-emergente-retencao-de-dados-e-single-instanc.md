## ADR-024 - Risco emergente: retencao de dados e single-instance

- **Contexto:** smoke gerou 568 MB em 40min; executamos acidentalmente 2 processos de ingestao simultaneos.
- **Decisao:** registrar como debito tecnico da F1.5: (1) politica de retencao RAW→AGGREGATE (§63); (2) guard de instancia unica (lock file) no boot do servico.
- **Status:** FACT (risco medido), mitigacao pendente.
- **Nota de renumeracao:** ex-ADR-014 (numero duplicado; renumerado no split de 2026-09-24).
