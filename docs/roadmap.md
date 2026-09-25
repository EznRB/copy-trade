# Roadmap e Gates de Fase

> Regra de ouro: **nunca pular fases; nunca pular para LIVE.** Cada avanço exige o gate correspondente verificado pelo orchestrator e, quando aplicável, aprovação humana explícita.

| Fase | Nome                 | Escopo                                                                                  | Gate de avanço                                                                                            |
| ---- | -------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F0   | Scaffold             | repo, AGENTS.md, agentes, lint/TS/tests, CI, .env.example, docs, Docker (deploy futuro) | `npm run lint`, `npm run typecheck`, `npm test` verdes                                                    |
| F1   | Data ingestion ✅ **CONCLUÍDA (2026-09-22)** | BlockchainDataProvider (Helius WSS + RPC), normalização, dedup, storage | **PASS**: 780.053 eventos reais persistidos em ~40min de smoke na mainnet (subscrição no programa Pump.fun, fixture público), dedup ativo (sigs únicas == total; re-deliveries rejeitadas via unique constraint), zero trades. Dedup coberto por property tests (duplicate/out-of-order); reconnect testado em código (ver ressalvas no handoff). Enriquecimento BUY/SELL = F1.5 |
| F2   | Wallet monitor/intel | registry, 1→100 wallets com medição, métricas históricas, classificação, Wallet Score   | Métricas reproduzíveis; escalabilidade medida                                                             |
| F3   | Token intelligence   | token registry, métricas, Token Risk, creator analysis                                  | Todo bloqueio de token é explicável                                                                       |
| F4   | Copyability          | simulação de delay 0.5–60s, slippage model, copyability reports                         | Reports gerados para todas as wallets monitoradas                                                         |
| F5   | Backtester           | replay histórico, custos completos, baselines                                           | Reproduz cenários conhecidos; auditoria anti-leakage passa                                                |
| F6   | Paper trading        | sinal→posição→PnL 24/7 sem dinheiro                                                     | Estabilidade contínua (uptime + dedup zero) em janela mínima definida                                     |
| F7   | ML                   | só com dataset maduro; XGBoost/LightGBM; walk-forward                                   | Out-of-sample validado; ML > baseline ou é rejeitado                                                      |
| F8   | Shadow               | ordens reais construídas, não enviadas; predicted vs. actual                            | Métricas de execução projetada estáveis                                                                   |
| F9   | Execution            | ExecutionProvider production-ready (ainda desligado)                                    | Security review aprovado; fault injection passa                                                           |
| F10  | Live controlado      | capital mínimo, todas as travas                                                         | **Aprovação humana explícita** + F1–F9 resolvidos                                                         |

| F1.5 | Enrichment (decode BUY/SELL) **IMPLEMENTADA — aguardando review** | Decoder codama oficial + fixtures 1:1 vs Helius + backfill 10k | Fixtures: 10/10 com Helius (8 PumpSwap, 2 curve); backfill: 19.1% cobertura em 10k (esperado: maioria transfer/create); NÃO fecha sozinho — SEC revisa e dono aprova |

### Gate F1.5 (evidência em `docs/research/f15/`)

- Persistência: `ObservedEvent` com direction/amountSol/tokenAmount/mint/counterparty/enrichSource/enrichedAt/enrichAttempts (migration `20260924142844_f15_enrichment`).
- Fixtures: `fixtures-report.json` (16/16 vs Enhanced; rodada final 10/10 com 8 AMM).
- Backfill: `backfill-report.json` (10k em ~69min, 0 erros, 19.1% covered).

## Critérios transversais (§141)

- F1→F2: ingestão confiável. F2→F3: dados persistidos. F3→F4: métricas reproduzíveis. F4→F5: backtest sem leakage. F5→F6: dataset com qualidade. F6→F8: estabilidade. LIVE: somente com aprovação explícita.

## Dependências externas a validar (ANTES de assumir)

1. Limites reais do Helius free (quota/RPS/WSS) — doc oficial, Fase 1.
2. Existência/versão de `@pump-fun/pump-sdk` e `pump-swap-sdk` — repo oficial `pump-fun/pump-fun-skills`.
3. Lista inicial de wallets — importação manual pelo usuário (Fase 2).
4. Limites do servidor Always Free escolhido — doc oficial antes do deploy.

## Pesquisas centrais (nortear experimentos)

"É possível obter EV positivo líquido copiando wallets consistentes após atraso, slippage, taxas, falhas e mudança de regime?" + perguntas secundárias §161 do documento fonte (hold time, market cap, consenso mínimo, decay, políticas de saída, custo ótimo de execução, ML vs. regras, OOS).
