## ADR-018 — chainstacklabs/pumpfun-bonkfun-bot como referência primária de arquitetura de bot

- **Contexto:** substituição ao rejeitado Mogerto.
- **Verificação (FACT, GitHub API 2026-09-24):** org Chainstack Labs (empresa real de infra RPC, blog oficial com walkthrough), 1000★/353 forks, Apache-2.0, push ativo (2026-09-23). Estrutura: `geyser/` + `platforms/` (abstração por launchpad) + `trading/` + `monitoring/` + `cookbook/` (scripts standalone por ação).
- **Decisão:** referência de leitura primária para F1.5 (decode das instruções da bonding curve via cookbook) e F6/F9 (máquina de estados detect→evaluate→enter→monitor→exit; Jito/prioritização). Conceitos adaptáveis (Apache-2.0); código **não** integrável diretamente (Python vs nosso TS).
- **Limites:** é sniper bot, não copy trader; métricas de lucro do README não são evidência; `pumpfun-cli`/`pumpclaw` (irmãos) operam wallet — proibidos como dependência (regra §2).
- **Status:** FACT.
