# @ct/backtester — Backtest Engine (Fase 5)

Motor de replay histórico para validar estratégias de copy trading antes de qualquer
modo PAPER/SHADOW/LIVE.

## Princípios invioláveis

1. **Walk-forward apenas.** Nunca random split em séries temporais. Treino sempre
   anterior ao teste; janelas rolantes documentadas.
2. **Sem survivorship bias.** Wallets moribundas, tokens rugados e trades com loss
   permanecem no dataset. Excluir losers é proibido.
3. **PnL decomposto, sempre:**
   `gross_pnl − fees − slippage − priority − tips = net_pnl`.
   Apresentar apenas PnL bruto é fraude contra nós mesmos.
4. **`COPY_EXECUTED_PRICE` nunca é `MASTER_PRICE`.** A cópia executa depois, paga
   delay + slippage + impacto. Simulação com preço do master é inválida.
5. **Leakage zero:** toda decisão no replay usa apenas dados anteriores ao
   timestamp da decisão (ver `ml/features/README.md`).
6. **Sem otimização no test set.** Hiperparâmetros se ajustam no validation split.

## Estrutura

- `src/` — engine e interfaces
- `scenarios/` — cenários nomeados e versionados (parâmetros, não resultados)
- `fixtures/` — dados mínimos de teste (sintéticos ou sanitizados, sem secrets)
- `reports/` — saídas de backtest (gerado; cada report carrega `strategy_version`,
  `feature_schema_version`, período e parâmetros do cenário)

## Status

`NOT STARTED` — interface definida, implementação na Fase 5 após Fases 1–4.
