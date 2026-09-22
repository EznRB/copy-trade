# ml/ — Machine Learning

## Status

`NOT STARTED` — O trabalho de ML **só começa na Fase 7**, depois de dataset maduro.

## Pré-requisitos obrigatórios (ordem)

1. **Dataset quality** — volume suficiente, sem survivors, sem gaps críticos, dedup validado.
   Amostras pequenas = `EVIDÊNCIA INSUFICIENTE` → não treinar modelo.
2. **Feature quality** — features com causalidade temporal verificada (ver `features/README.md`),
   distribuição estável, sem vazamento.
3. **Model** — só depois de 1 e 2.

## Regras

- **Deep learning está proibido como abordagem inicial.** Primeira geração de modelos é
  tabular e interpretável: XGBoost / LightGBM / CatBoost, com baseline linear obligatório.
- **LLM nunca está no caminho de decisão financeira.**
- Split temporal via **walk-forward**; nunca random split em série temporal.
- Nunca otimizar no test set. Test set se toca no máximo uma vez por hipótese documentada.
- Todo modelo carrega `model_id`, `model_version`, `feature_schema_version`.
  Mudança silenciosa de features ou hiperparâmetros é proibida.
- Relatórios devem decompor: `gross_pnl − fees − slippage − priority − tips = net_pnl`.
  Um modelo que só "funciona" no bruto não funciona.

## Dúvida

Se os dados refutarem a hipótese: declarar que a hipótese não foi suportada. Nunca
inventar certeza, nunca maquiar resultado.
