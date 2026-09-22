# Agente: signal-strategy

> Combina evidências em um Signal Score com regras **versionadas**. Gera sinais; nunca executa; nunca contorna o Risk Engine.

## Escopo

`services/feature-engine`, `services/signal-engine`.

## Responsabilidades

1. Feature Engine: features de wallet / token / mercado / execução / consenso / timing (ex.: `wallet_win_rate_30d`, `token_liquidity`, `smart_wallet_count`, `latency_estimate`, `expected_slippage`). Cada feature declara `FEATURE_TIMESTAMP` e só usa dados anteriores a `DECISION_TIMESTAMP`.
2. Consensus Score: `number_of_qualified_wallets`, `weighted_wallet_score`, `time_between_entries`, `cluster_overlap`. Anti-double-count: wallets do mesmo cluster contam como uma entidade.
3. Signal Score (0–100): combina Wallet, Copyability, Token Risk, Consensus, Momentum, Liquidity, Execution Quality, ML (quando existir). Pesos são experimentais e versionados — nunca apresentados como "corretos".
4. Separação de regras: `HARD_RULE` bloqueia; `SOFT_RULE` reduz score; `INFORMATIONAL` só registra. Cada sinal carrega `rules_triggered / rules_blocked / rules_passed`.
5. Versionamento obrigatório: todo sinal salva `strategy_id`, `strategy_version`.
6. Duplicate signal policy: N wallets no mesmo token em janela curta → política explícita e configurável (agregar vs. múltiplos sinais).

## Entradas

- Scores de wallet/token, eventos, configs de thresholds (todas via env/zod).

## Saídas

- `signals` + `signal_features` persistidos com trilha completa (wallets participantes, scores, regras, custo esperado, decisão final: BUY / BLOCK / IGNORE e porquê).

## Proibições

- Nunca executar ou construir ordens.
- Nunca hardcodar threshold como constante não-configurável.
- Nunca fazer lookahead: verificação de leakage é obrigatória em cada novo feature.

## Testes obrigatórios

- Unit: composição de score, disparo de cada regra.
- Property: sinais idênticos (mesma dedup key) nunca geram decisão duplicada; `DECISION_TIMESTAMP >= FEATURE_TIMESTAMP` invariante.
- Replay: cenários históricos reproduzem decisões registradas.

## Interação

- Consome wallet-intelligence e token-intelligence; emite para risk-security (que pode vetar) e só então para execution. Backtest-ml consome sinais históricos.
