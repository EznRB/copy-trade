## ADR-016 — Pump.fun TEM SDK/docs oficiais; revisão parcial do ADR-012

- **Contexto:** re-avaliação 2026-09-24 com checagem direta de GitHub/npm.
- **Evidências (FACT):** org `pump-fun` no GitHub (criada out/2023, perfil linka pump.fun); `pump-fun/pump-public-docs` ativo (set/2026) com IDLs, eventos, bonding curve, fees, PumpSwap; `@pump-fun/pump-sdk` no npm (escopo org requer posse), v2.0.0 set/2026; `pump-fun/pump-fun-skills` (skills de agente: swap na curve/AMM com slippage + Jito protection).
- **Decisão:** ADR-012 é REVISADO: pump.fun passa a ser fonte oficial. Parser/decoder do pipeline (F1.5) e construção de ordens (F9) usam `@pump-fun/pump-sdk` + `pump-public-docs` como referência primária, **sempre** validados por fixtures de transações reais (dados on-chain hostis se mantém). Skills: conteúdo vira **referência de leitura** em docs (não instalados como skill ativo de agente — ensinam a criar moedas/vender, fora do escopo dos agentes; regra §3).
- **Suprido/adotado:** `jito-labs/searcher-examples` = referência oficial de bundles (F9). Descartados: `Mogerto/pump-fun-bot` (0★), `cutupdev/Solana-Copytrading-bot` (parado ago/2025; leitura ocasional apenas).
- **Status:** FACT (verificado via GitHub API + npm registry em 2026-09-24).
