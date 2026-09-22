# Solana Smart-Money Intelligence + Pump.fun Copy Trading Engine

Infraestrutura quantitativa para monitorar wallets Solana, medir **copyability real** (após latência, slippage e taxas), e operar em modo **PAPER** — com caminho auditado para SHADOW e LIVE somente após todas as gates de validação.

> **Pergunta central do projeto:** é possível obter EV positivo líquido copiando wallets com comportamento historicamente consistente, após atraso, slippage, taxas, falhas de execução e mudanças de regime? A resposta virá de experimentos — não é presumida.

## Status

**FASE 0 — Scaffold concluído.** Nenhuma lógica de trading implementada. Consulte `docs/roadmap.md` para as fases e gates.

## Princípios invioláveis

- Default absoluto: `TRADING_MODE=PAPER`. LIVE exige **duas** variáveis (`TRADING_MODE=LIVE` + `LIVE_TRADING_ENABLED=true`) + aprovação humana explícita.
- Nenhuma private key/seed phrase em arquivos, logs ou prompts — apenas public keys.
- LLM nunca decide trades; decisões são determinísticas/estatísticas.
- Regras completas: **[AGENTS.md](AGENTS.md)**.

## Stack

| Camada               | Tecnologia                                                      |
| -------------------- | --------------------------------------------------------------- |
| Services / real-time | TypeScript · Node 20 · npm workspaces                           |
| Dados                | PostgreSQL (nativo, via Prisma)                                 |
| ML / backtest        | Python 3.11+ (XGBoost/LightGBM)                                 |
| Dashboard            | Next.js (fase posterior)                                        |
| CI                   | GitHub Actions                                                  |
| Deploy futuro        | Docker no servidor 24/7 (dev local roda **nativo**, sem Docker) |

## Quickstart (dev local, sem Docker)

Pré-requisitos: Node ≥ 20, PostgreSQL local (ver `docs/operations/database-setup.md`).

```powershell
npm install                                # instala dependências dos workspaces
cp .env.example .env                       # preencher (nunca commitar)
npm run lint
npm run typecheck
npm test
```

Gate da Fase 0 (§107 do documento fonte): os três comandos acima devem passar.

## Estrutura

```
agents/ de IA .......... .agents/ e .opencode/agents/
docs ................... docs/ (architecture, roadmap, security, research)
serviços ............... services/ (ingestion, wallet, token, signal, risk, execution, ...)
pacotes compartilhados . packages/ (@ct/types, config, logging, metrics, database, solana, dex, pumpfun)
ML ..................... ml/ (Python)
backtest ............... backtester/ (engine, scenarios, fixtures, reports)
infra .................. infrastructure/ (docker p/ servidor futuro, scripts)
```

## Documentação essencial

- [AGENTS.md](AGENTS.md) — regras invioláveis para humanos e agentes
- [docs/roadmap.md](docs/roadmap.md) — fases 0–10 e gates de avanço
- [docs/architecture/architecture.md](docs/architecture/architecture.md) — arquitetura do sistema
- [docs/architecture/decision-log.md](docs/architecture/decision-log.md) — ADRs
- [docs/security/secret-policy.md](docs/security/secret-policy.md) — política de segredos
