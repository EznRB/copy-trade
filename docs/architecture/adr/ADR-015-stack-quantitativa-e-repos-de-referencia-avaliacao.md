## ADR-015 — Stack quantitativa e repos de referência (avaliação 2026-09-24)

- **Contexto:** avaliação de lista externa (GPT) de MCPs/repos/tópicos quant para o projeto.
- **Decisões positivas:**
  - **Serena MCP** instalado (navegação semântica da codebase; único MCP novo aprovado).
  - **VectorBT** e **Optuna**: stack Python da F5/F7 (backtest vetorizado de sinais + HPO com walk-forward externo obrigatório — anti-overfit). Instalar apenas na fase correspondente.
  - **Referências de arquitetura (leitura, não dependência):** `nautechsystems/nautilus_trader` (engine event-driven), `freqtrade` (dry-run = análogo do nosso PAPER; risk controls), `hummingbot` (separação strategy/executor/backtest).
- **Decisões negativas (com motivo):**
  - `pumpfun-mcp` e MCPs comunitários de dados on-chain: **bloqueados** (autor anônimo, dados hostis no contexto do LLM — regras §2/§4; nosso caminho é IDL vendored + parser validado por fixtures).
  - Orderflow (CVD/VPIN/OFI off-the-shelf): inaplicável — não há order book em AMM/bonding curve. Análogo válido: desequilíbrio de fluxo de swaps por slot + impacto na curva (feature própria, F3/F4).
  - Options/IV walls/expected range: inaplicável — memecoins não têm mercado de opções. HV realizada migra como feature de Token Risk (F3).
  - SMC (FVG/OB/BOS/CHoCH): entra apenas como **HYPOTHESIS testável** com walk-forward; nunca como regra. Sem evidência estatística prévia.
  - ORB: re-frameado para "primeiros N minutos pós-launch do token" (opening range do bonding curve) — candidato de feature F4, não estratégia pronta.
  - axiom.trade / j7 tracker / GMGN: benchmark de UX/métricas para o dashboard futuro; sem API pública confiável; não integrar.
  - "Estratégias de smart money/manipulação": estudar como **defesa** (heurísticas do Risk Engine: sandwich, rug patterns, dedump). Executar manipulação está fora do escopo ético/legal do projeto.
  - Twitter monitor: válido para F3, mas só via API oficial paga (scraping = ToS frágil); DexScreener/Helius primeiro.
- **Status:** FACT (decisões). Serena verificado conectado (10/10 MCPs).
