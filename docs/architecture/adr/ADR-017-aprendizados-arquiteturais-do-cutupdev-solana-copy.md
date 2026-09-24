## ADR-017 — Aprendizados arquiteturais do cutupdev/Solana-Copytrading-bot + status VectorBT/Optuna

- **cutupdev/Solana-Copytrading-bot** (276★, Rust, sem licença → leitura apenas, repo-vitrine de freelancer): insights adotados como HYPOTHESIS a validar na F9 — (a) gRPC/Geyser ~50-100ms vs RPC WS ~300-500ms para detecção de tx da wallet (coerente com ADR-011); (b) swap direto na DEX (pump.swap/curve) reduz latência vs Jupiter aggregator; Jupiter vira fallback, não caminho primário. Reclamações de performance = claims de vendedor, não fatos.
- **VectorBT** (9.2k★, ativo set/2026, licença custom — revisar antes de uso em produção): confirmado para research/SPP na F5 sobre eventos persistidos; backtester determinístico próprio segue como autoridade de decisão.
- **Optuna** (14.8k★, MIT, ativo): F7; proibido otimizar sobre test set — walk-forward externo obrigatório.
- **Status:** FACT (verificado GitHub em 2026-09-24).
