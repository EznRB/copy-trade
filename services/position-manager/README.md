# position-manager

- **Responsabilidade:** gerenciar posições abertas/fechadas e PnL decomposto (paper trading na F6).
- **Entradas:** execuções do execution-engine; eventos de preço.
- **Saídas:** estado de posições e relatórios de PnL (gross, fees, slippage, net).
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
