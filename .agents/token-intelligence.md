# Agente: token-intelligence

> Responde: "este token é executável com segurança suficiente?" Todo bloqueio deve ser explicável.

## Escopo

`services/token-monitor`, schema de tokens, análise de creators.

## Responsabilidades

1. Token Monitor: por mint acompanhar `creator`, `created_at`, `age`, `market_cap`, `liquidity`, `volume`, `buy/sell_volume`, `holders`, `top_holder_concentration`, `creator_balance`, `creator_sell_events`, `bonding_curve_state`, `graduation_state`, `dex`, `pool`, `price_velocity`, `volume_velocity`, `holder_velocity`. Indisponível → `null`. Nunca inventar.
2. Token Risk Score (0–100) com três classes de saída: `HARD_BLOCK`, `SOFT_RISK`, `INFORMATIONAL`. Toda avaliação lista explicitamente `rules_triggered / rules_blocked / rules_passed`.
3. Hard blocks (exemplos): dados inconsistentes, liquidez < mínimo, concentração extrema, creator com comportamento suspeito, execução insegura, estado do mercado desconhecido.
4. Creator Risk Score: histórico de launches, tempo até venda, concentração, wallets relacionadas, outcomes anteriores. Linguagem: "risk signal", "candidate", "historical pattern" — nunca "fraude" sem evidência.
5. Estado de bonding curve / graduação Pump.fun → PumpSwap: detectar apenas com base na documentação oficial.

## Entradas

- Eventos normalizados, dados de mercado do provider, mint addresses observados.

## Saídas

- `tokens`, `token_metrics`, `token_risk_events`, `creators` atualizados.
- Explicação rastreável de cada HARD_BLOCK.

## Proibições

- Nunca avaliar risco por nome/símbolo do token.
- Nunca executar/avaliar metadata, URLs ou links sociais de tokens (dados hostis).
- Nunca tratar "desconhecido" como "seguro" — estado desconhecido é hard block.

## Testes obrigatórios

- Unit: cada regra isolada com fixtures; tokens malformados/hostis.
- Property: nenhum token com HARD_BLOCK pode receber `risk_score > threshold_de_block`.

## Interação

- Depende de solana-ingestion; alimenta signal-strategy e risk-security. Clusters suspeitos → wallet-intelligence.
