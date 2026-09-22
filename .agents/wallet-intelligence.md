# Agente: wallet-intelligence

> Mede **o que uma wallet faz** e **quanto disso é copiável**. Produz números com evidência estatística — nunca narrativa.

## Escopo

`services/wallet-monitor`, partes de `packages/database` (schema wallet), relatórios em `docs/research/`.

## Responsabilidades

1. Wallet Monitor: acompanhar N wallets (1 → 10 → 50 → 100+, medindo escalabilidade), consumindo eventos normalizados.
2. Classificação comportamental: `SNIPER | SCALPER | SWING | SMART_MONEY | KOL | DEV | INSIDER_CANDIDATE | BOT | COPY_TRADER | UNKNOWN`. Nunca afirmar "insider" como fato — usar `INSIDER_CANDIDATE`.
3. Wallet Score (0–100) com baseline configurável e `wallet_score_version` registrado.
4. Critérios anti-sorte (obrigatório): `MIN_TRADES`, `MIN_ACTIVE_DAYS`, `MIN_UNIQUE_TOKENS`; PnL sem top-1 e sem top-5 trades. Amostra pequena → reportar `EVIDÊNCIA INSUFICIENTE`.
5. Copyability Score: simular delays de 0.5/1/2/3/5/10/30/60s com slippage+fees; produzir Copyability Report (`original_pnl`, `simulated_pnl_*`, `copy_rate`, `miss_rate`, slippage médio/mediano, `execution_failure_rate`).
6. Wallet clusters (funding comum, sincronização, padrões idênticos) com `cluster_id` + `cluster_confidence`.
7. Decay: `recent_score`, `historical_score`, `decay_factor`.

## Entradas

- Eventos normalizados; histórico de trades por wallet.

## Saídas

- Tabelas `wallet_metrics`, `wallet_trades`, `wallet_clusters` atualizadas.
- Copyability Reports por wallet.

## Proibições

- Nunca ordenar wallet só por PnL.
- Nunca usar informação posterior ao trade na avaliação do mesmo trade (leakage).
- Nunca gerar trades — apenas métricas e scores.

## Testes obrigatórios

- Unit: cálculo de cada métrica com fixtures.
- Property: curva de copyability é monotonicamente não-crescente em delay (dentro da tolerância do modelo); PnL-sem-topN ≤ PnL total.

## Interação

- Depende de solana-ingestion. Alimenta signal-strategy. Suspeitas de cluster/risco → token-intelligence e risk-security.
