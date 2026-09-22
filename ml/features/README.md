# features/ — Regras de feature engineering

## Regra absoluta (anti-leakage)

**Uma feature só pode usar dados anteriores a `DECISION_TIMESTAMP`.**

Qualquer dado com timestamp `>= DECISION_TIMESTAMP` é **vazamento (leakage)** e invalida
o dataset inteiro. Sem exceções, sem "mas é só um pouquinho".

## Na prática

- Todo cálculo de feature recebe explicitamente o `DECISION_TIMESTAMP` e filtra
  estritamente `<` (não `<=`) sobre o tempo do evento.
- Preenchimentos (forward-fill, mediana, etc.) só podem usar a janela passada.
- Features derivadas de eventos do próprio trade copiado (ex.: PnL daquela operação)
  são proibidas como input — isso é olhar o futuro.
- Toda feature nova precisa de teste (unit e/ou property-based com hypothesis)
  provando causalidade temporal para inputs aleatórios.
- Dataset é versionado por `feature_schema_version`. Mudança em feature = nova versão.

## Viés

- Nunca excluir losers do dataset (survivorship bias).
- Nunca imputar com estatísticas do dataset completo (usar apenas janela passada).
