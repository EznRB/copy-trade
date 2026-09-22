# Pipeline de Revisão Autônoma (multi-chat)

Protocolo de coordenação entre chats produtores de código e o revisor autônomo.
A fonte de verdade é o **git local** — não há IPC entre chats.

## Papéis

- **Chat produtor** (qualquer agente): trabalha em worktree próprio, branch `sprint/<nome>` (ou `feat/*`, `task/*`). Cria o worktree com `scripts/start-sprint-worktree.ps1 -Name <nome>`. Commita ao final de cada task.
- **Watcher revisor** (`scripts/review-loop.ps1`): roda em terminal dedicado no worktree principal (master). A cada ciclo (60s) detecta commits novos nas branches monitoradas que ainda não estão em `state.json`, e para cada um:
  1. Roda gates: `npm run lint`, `npm run typecheck`, `npm test`.
  2. Invoca `opencode run --agent code-reviewer` (headless) para revisão adversarial do diff.
  3. Grava veredito em `docs/reviews/<sha>.md` e commita o artefato no master.
  4. Se REJEITADO: tenta correção automática em branch `review-fix/<branch>` (via worktree temporário `.review-wt`), **nunca** na branch do produtor. Correções seguem à revisão humana/produtor para merge.

## Arquivos de estado

- `docs/reviews/state.json` — SHAs já processados (`reviewed` / `rejected`). Garante idempotência (dedup por SHA).
- `docs/reviews/watcher.log` — log do watcher.
- `docs/reviews/<sha>.md` — relatório por commit.

## Operação

```powershell
# iniciar o watcher (deixe rodando durante as sessões de desenvolvimento)
powershell -File scripts/review-loop.ps1

# uma passada só (teste)
powershell -File scripts/review-loop.ps1 -Once
```

## Regras

1. O revisor nunca altera `TRADING_MODE`, `LIVE_TRADING_ENABLED` ou constantes `MAX_*`.
2. Revisões nunca são commitadas na branch do produtor — apenas `docs/reviews/*` no master e fixes em `review-fix/*`.
3. `VERDICT: REJEITADO` do code-reviewer OU falha em qualquer gate = rejeitado.
4. Findings CRITICAL/HIGH de segurança seguem o fluxo do red-team (`docs/security/red-team/FINDINGS.md`) com prioridade de veto.
