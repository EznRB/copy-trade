# Pipeline de 4 chats — camada humana de orquestração

> **Base normativa:** AGENTS.md §4, §5, §7.1. Este documento NÃO substitui o pipeline de revisão autônomo do §7.1 (worktrees + `scripts/review-loop.ps1` + `docs/reviews/`) — ele é a camada por cima: como o **dono** orquestra os 4 chats humanamente entre fases.

> **Mecânica de git/worktree/revisão automática:** ver AGENTS.md §7.1 e `docs/reviews/README.md`. Aqui só mora o que o §7.1 não cobre: papéis dos 4 chats, passagem de fase e veto de segurança.

## Os 4 papéis

| # | Chat | Papel | Pode escrever em | Nunca escreve em |
|---|------|-------|------------------|------------------|
| 1 | **DEV** | Implementa a fase, roda gates (`lint`/`typecheck`/`test`), commita na branch `sprint/<nome>` | `packages/`, `services/`, `apps/`, `tests/`, `docs/*` (exceto `docs/security/`), `AGENTS.md` | — (único escritor de código) |
| 2 | **REVIEW** | Revisão autônoma (watcher `scripts/review-loop.ps1`) — publica vereditos por commit | `docs/reviews/` | Nunca altera código-fonte; nunca commita em branch de produtor |
| 3 | **SEC** | Auditoria de segurança adversarial + veto | `docs/security/red-team/` | Nunca altera código; veto via finding documentado |
| 4 | **CÉREBRO** (alinhamento com o dono) | Arquitetura, decisões, gestão de contexto entre fases | `docs/architecture/`, `docs/handoff.md`, `docs/operations/` | `packages/`, `services/` enquanto DEV está ativo |

## Regra de ouro: single-writer (robusta via worktrees)

**Em qualquer instante, no máximo UM chat escreve no código.** O §7.1 resolve isso tecnicamente: DEV trabalha em `sprint/<nome>` via worktree; o watcher do REVIEW só publica vereditos em `docs/reviews/`; merge só com todos os commits APROVADOS.

Colisões ainda possíveis: arquivos transversais na raiz do master (`opencode.json`, `AGENTS.md`, `package.json` root, `.env.example`). Regra: quem não é DEV só toca neles com aviso explícito e enquanto o DEV está parado. Foi uma colisão desse tipo (`opencode.json`) que motivou esta regra.

Sinal de colisão: `git status` mostra arquivos modificados que você não editou → pare e alinhe antes de escrever.

## Ordem de execução por fase (camada humana)

```
DEV implementa em sprint/<nome> (commits frequentes)
   → watcher REVIEW publica veredito por commit em docs/reviews/<sha>.md
      → todos APROVADOS → merge da sprint em master
         → SEC audita (read-only) → docs/security/red-team/ (findings + sprint)
            → sem CRITICAL/HIGH abertos → CÉREBRO valida gates de fase vs docs/roadmap.md
               → dono aprova abertura da próxima fase
```

Qualquer REJEITADO volta ao DEV (correção na própria branch ou via `review-fix/*`). Nenhuma fase avança com finding `CRITICAL`/`HIGH` aberto (equivalente ao veto do risk-security, AGENTS.md §5).

## Mensagens-modelo

### DEV → REVIEW (ao concluir a sprint)
> "F<N> implementada na branch `sprint/<nome>`. Commits: <lista SHAs>. Gates verdes: lint/typecheck/test. ADRs novos: <ids>. Pendências conhecidas: <lista>."

*(A revisão em si é automática — o watcher já publicou os vereditos. A mensagem é o aviso de "sprint fechada, conferir `docs/reviews/` e mergear")*

### REVIEW → dono (resultado)
> Resumo de `docs/reviews/`: "commits <a..b>: X aprovados, Y rejeitados (<SHAs>). Apto a merge: SIM/NÃO."

### SEC → dono (resultado)
> Findings em `docs/security/red-team/`: vetor de ataque, evidência reproduzível, severidade (CRITICAL/HIGH/MEDIUM/LOW), recomendação. Veredicto explícito: LIBERADO ou BLOQUEADO.

### CÉREBRO → dono (fechamento)
> Checklist do gate da fase vs `docs/roadmap.md`; decisões a tomar; sinal verde/vermelho para a próxima fase; atualiza `docs/handoff.md`.

## Protocolo de sincronização entre chats

1. **Antes de qualquer sessão:** `git status` + `git log --oneline -10` — entenda o que mudou.
2. **DEV commita no mínimo uma vez por task** (ver §7.1). Trabalho não commitado não existe.
3. **REVIEW/SEC só atuam sobre commits**, nunca sobre working tree sujo.
4. **Ao trocar de chat**, handoff contém: SHA do último commit, status das gates, pendências.
5. **Handoff persistente:** `docs/handoff.md` (bloco datado no topo) — atualizado pelo CÉREBRO (ou pelo DEV ao fim da fase).

## Checklist de abertura de fase (CÉREBRO + dono)

- [ ] `docs/handoff.md` reflete o estado real
- [ ] Gates da fase anterior verificados conforme `docs/roadmap.md`
- [ ] Findings SEC da fase anterior fechados ou rebaixados
- [ ] Entregável + métrica de sucesso da fase atual escritos
- [ ] Nenhum chat paralelo ativo em arquivo transversal

## Anti-padrões proibidos

- ❌ REVIEW "corrigindo" código (vira DEV#2 e fura a separação)
- ❌ SEC escrevendo patch (perde independência do veto)
- ❌ DEV trabalhando no master / sem worktree
- ❌ Merge com algum commit REJEITADO
- ❌ Qualquer chat alterando `MAX_*`, `TRADING_MODE` ou `LIVE_TRADING_ENABLED` (regra inviolável §2)
