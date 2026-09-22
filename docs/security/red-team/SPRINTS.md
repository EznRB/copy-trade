# SPRINTS — Histórico de sprints do Red Team

> Formato por sprint: escopo, findings novos, findings fechados, evasões sem sucesso, próximo alvo sugerido.
> É este arquivo que permite a continuidade entre chats diferentes.

## Fila de alvos sugeridos (prioridade decrescente inicial)

1. Guards financeiros: kill switch, dupla trava LIVE, Risk Engine bypass (race conditions).
2. Secrets: `npm run check:secrets`, `npm audit`, redaction de logs, git history.
3. Input adversarial: parsers de eventos on-chain, metadata de tokens, webhooks.
4. Injection: Prisma raw queries, comandos shell, template injection em alertas Telegram.
5. DoS/estresse: flood de eventos, dedup sob replay, reconnect storms.
6. Supply chain: auditoria de dependências e lockfile.

## Histórico

## SPRINT 1 — 2026-09-21 — Setup do red-team + supply chain/secrets baseline
- Executada por: sessão de criação do agente red-team.
- Escopo: criação da estrutura (`docs/security/red-team/`, agente `.agents/red-team.md`), varredura de secrets (`check:secrets`), `npm audit`.
- Findings novos: RT-001 (vitest/vite CVEs — FIXED-VERIFIED), RT-002 (residual moderate — ACCEPTED), RT-003 (check-secrets quebrado no CI + falso negativo em `*_PRIVATE_KEY=` — FIXED-VERIFIED).
- Automação implementada: CI agora tem job **Security Gate** (`npm run check:security` = secrets audit + npm audit high+) em todo push/PR e **schedule semanal** (segundas 03:00 UTC). AGENTS.md §8 agora exige sprint do red-team como **gate de conclusão de cada fase**.
- Findings fechados (re-testados): nenhum.
- Evasões tentadas sem sucesso: `check-secrets` detectou e ignora comentários apropriadamente após ajuste (falso positivo corrigido: linha `# A private key...` no `.env`).
- Observação: script `check-secrets.ps1` agora ignora linhas comentadas (`#`/`//`) — trade-off documentado; revisar se surgir falso negativo.
- Próximo alvo sugerido: **guards financeiros** (kill switch, dupla trava LIVE, Risk Engine bypass por race condition) — prioridade 1 da fila.

<!-- Template:

## SPRINT N — <data> — <tema>
- Executada por: (chat/sessão)
- Escopo:
- Findings novos: RT-001, RT-002...
- Findings fechados (re-testados):
- Evasões tentadas sem sucesso (defesas que seguraram):
- Próximo alvo sugerido:
-->
