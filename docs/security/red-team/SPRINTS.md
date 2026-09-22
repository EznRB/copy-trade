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

_Nenhuma sprint executada ainda._

<!-- Template:

## SPRINT N — <data> — <tema>
- Executada por: (chat/sessão)
- Escopo:
- Findings novos: RT-001, RT-002...
- Findings fechados (re-testados):
- Evasões tentadas sem sucesso (defesas que seguraram):
- Próximo alvo sugerido:
-->
