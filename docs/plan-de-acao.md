# Plano de Ação — Visão Executiva

> Derivado de `prompt copytrade.txt`. Detalhes de arquitetura em `docs/architecture/architecture.md`, decisões em `docs/architecture/decision-log.md`, fases em `docs/roadmap.md`.

## Objetivo quantitativo

Responder experimentalmente: "Quais comportamentos observáveis de wallets continuam positivos quando reproduzidos por nós com latência, slippage, taxas e limitações reais?" — não "qual wallet ganhou mais".

## MVP (produto mínimo, sem live trading)

1. Monitorar wallets; 2. Detectar BUY/SELL; 3. Armazenar; 4. Métricas de wallet; 5. Wallet Score; 6. Copyability Score; 7. Acompanhar tokens; 8. Token Risk; 9. Signal; 10. Paper trades; 11. Dashboard; 12. Alertas Telegram.

**Métrica principal do MVP:** quanto do comportamento das wallets selecionadas continua reproduzível após custos e atraso realista.

## Estratégia de execução

1. **Fases com gates** (ver roadmap) — nenhum avanço sem validação.
2. **Agentes especializados** (`.agents/`) orquestrados pelo orchestrator; code-reviewer adversarial em toda entrega; risk-security com veto.
3. **Zero-cost-first:** medir gargalo antes de pagar qualquer serviço.
4. **Pesquisa dirigida:** toda mudança de estratégia é um experimento com hipótese registrada em `docs/research/experiments/`.

## Riscos-chave identificados na análise

| Risco                                 | Mitigação                                                   |
| ------------------------------------- | ----------------------------------------------------------- |
| Limites de free tiers (Helius/Oracle) | validar doc oficial na Fase 1; medir antes de pagar         |
| Acoplamento a provider                | interfaces `BlockchainDataProvider`/`ExecutionProvider`     |
| Leakage / survivorship bias           | auditoria adversarial obrigatória em backtest; walk-forward |
| Execução acidental de LIVE            | dupla trava + falha fechada no config + aprovação humana    |
| Dados hostis on-chain                 | validação zod na borda; nunca executar metadata             |
| Confiança estatística prematura       | critérios mínimos de amostra; PnL sem top-N trades          |

## Pontos pendentes de decisão humana

- Valores reais dos limites `MAX_*` (antes de qualquer modo além de PAPER).
- Lista inicial de wallets (Fase 2).
- Escolha do servidor 24/7 (Oracle Always Free vs. alternativa) — após verificação de limites oficiais.
- Aprovação de cada gate de fase e, especialmente, de LIVE.
