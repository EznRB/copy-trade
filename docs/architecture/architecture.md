# Arquitetura do Sistema

## Pipeline canônico

```
SOLANA
  └─► DATA INGESTION (BlockchainDataProvider: Helius/RPC → gRPC futuro)
        └─► EVENT NORMALIZATION + DEDUP (signature+instruction_index+wallet)
              └─► WALLET INTELLIGENCE ──┐
              └─► TOKEN INTELLIGENCE ───┤
                                        ▼
                                  FEATURE ENGINE
                                        ▼
                                  SIGNAL ENGINE (Consensus + Signal Score, regras versionadas)
                                        ▼
                                  RISK ENGINE (VETO ABSOLUTO + kill switch + circuit breakers)
                                        ▼
                          EXECUTION (Paper | Shadow | Live — execution_provider registrado)
                                        ▼
                              POSITION MANAGEMENT (estado persistido)
                                        ▼
                            RESULTS → DATABASE → BACKTEST / ML → MODEL IMPROVEMENT
```

## Princípios estruturais

1. **Separação estrita de fases:** ingestion nunca conhece estratégia; estratégia nunca conhece execução; execução nunca decide.
2. **Interfaces, não providers:** nenhum código de negócio depende de Helius, Pump, Jupiter ou Jito diretamente — sempre atrás de interface.
3. **Correlação ponta a ponta:** `signal_id → order_id → transaction_id → position_id`, todos com `correlation_id` comum.
4. **Estado em DB, não em RAM:** restart nunca duplica trade; reconstrução de estado é testável.
5. **LLM fora do caminho crítico:** decisão financeira = regras determinísticas + estatística + modelos tabulares versionados.

## Componentes

| Componente           | Local                           | Papel                                        |
| -------------------- | ------------------------------- | -------------------------------------------- |
| data-ingestion       | `services/data-ingestion`       | stream, normalização, dedup, failover RPC    |
| wallet-monitor       | `services/wallet-monitor`       | registry, métricas, classificação de wallets |
| token-monitor        | `services/token-monitor`        | métricas de token, risk, creator analysis    |
| feature-engine       | `services/feature-engine`       | features temporais sem leakage               |
| signal-engine        | `services/signal-engine`        | consensus + signal score + regras            |
| risk-engine          | `services/risk-engine`          | limites, circuit breakers, kill switch       |
| execution-engine     | `services/execution-engine`     | ExecutionProvider, ciclo de tx               |
| position-manager     | `services/position-manager`     | posições, exits, PnL                         |
| notification-service | `services/notification-service` | alertas Telegram                             |
| backtester           | `backtester/`                   | replay histórico com custos/latência         |
| ml                   | `ml/`                           | features, treino, avaliação (Python)         |

## Packages compartilhados

- `@ct/types` — contratos canônicos (NormalizedEvent, enums, ids)
- `@ct/config` — env + zod; **guard LIVE falha fechado**
- `@ct/logging` — JSON estruturado + redaction
- `@ct/metrics` — contadores/histogramas
- `@ct/database` — Prisma schema + client
- `@ct/solana` — BlockchainDataProvider + RpcProvider
- `@ct/dex` — DexRouter abstrato
- `@ct/pumpfun` — integração Pump (apenas com doc oficial verificada)

## Modos de operação

`PAPER` (default) → simula tudo, não envia. `SHADOW` → constrói ordem real, não envia, compara previsto vs. mercado. `LIVE` → somente com `TRADING_MODE=LIVE` **e** `LIVE_TRADING_ENABLED=true` **e** aprovação humana explícita.
