# Red Team — Protocolo de operação

Esta pasta é o **ponto de sincronização entre os chats/sprints** de segurança. Como cada sessão de IA começa sem memória da anterior, a coordenação acontece via arquivos versionados neste diretório.

## Arquivos

| Arquivo          | Função                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `threat-model.md` | Ativos, superfícies de ataque e trust boundaries do sistema (vivo).  |
| `FINDINGS.md`     | Registro único de todos os achados (`RT-NNN`), com status.            |
| `SPRINTS.md`      | Histórico de sprints executadas: escopo, resultado, próximo alvo.     |

## Como trabalhar em harmonia com os outros chats (fluxo)

1. **Novo chat de red-team inicia** → ler `AGENTS.md`, `.agents/red-team.md`, `threat-model.md`, `FINDINGS.md` (abertos primeiro) e `SPRINTS.md` (última sprint). Isso reconstrói o contexto completo.
2. **Escolher alvo**: prioridade definida pelo orchestrator, ou próximo alvo sugerido na última sprint que ainda não foi coberto.
3. **Atacar** conforme `.agents/red-team.md` (fuzzing, injection, guards, DoS local, secrets).
4. **Registrar findings** em `FINDINGS.md` (IDs sequenciais `RT-NNN`, nunca reutilizar).
5. **CRITICAL/HIGH** → notificar orchestrator + risk-security no mesmo chat, antes de continuar.
6. **Fix**: o finding é despachado pelo orchestrator ao agente dono do código (via outro chat). O fix referencia o ID (`fix: RT-003`).
7. **Re-teste**: em qualquer chat posterior, red-team verifica `FIX-IN-REVIEW`, executa o PoC original, e marca `FIXED-VERIFIED` ou reabre.
8. **Fechamento de sprint**: atualizar `SPRINTS.md` com o relatório e sugerir o próximo alvo — é isso que permite a continuidade entre sessões.

## Regras de ouro do protocolo

- Um único arquivo-fonte por informação: findings só em `FINDINGS.md`, histórico só em `SPRINTS.md`.
- Nunca reutilizar IDs. Nunca editar finding fechado sem registrar o re-teste.
- Nenhum secret real em nenhum arquivo desta pasta (referenciar por localização/hash).
- Tudo que é `FACT/HYPOTHESIS/EVIDÊNCIA INSUFICIENTE` deve ser rotulado (§5 do AGENTS.md).
