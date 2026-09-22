# Guia Rápido do Dono — mensagens prontas e fluxo obrigatório

> **Para quem é este arquivo:** o dono (humano). Copie e cole os blocos. Não improvise.
> **Para chats de IA:** este arquivo define o protocolo. Ele complementa — nunca substitui — `AGENTS.md` e `docs/operations/phase-pipeline.md`.

---

## 0. O FLUXO SAGRADO (nunca muda, não importa o contexto)

```
     ┌─────────────────────────────────────────────────────────┐
     │  Nenhuma fase avança fora desta ordem. Não há atalho.   │
     └─────────────────────────────────────────────────────────┘

1. DONO abre a fase            → msg 1 (abaixo) no chat DEV
2. DEV trabalha na worktree sprint/<fase>  (commits frequentes)
3. REVIEW (watcher) aprova cada commit     → vereditos em docs/reviews/
4. DEV avisa "sprint fechada"  → msg 2 no DONO verifica docs/reviews/
5. DONO mergeia sprint → master (só se TODOS aprovados)
6. DONO dispara SEC            → msg 3
7. SEC publica veredito        → LIBERADO ou BLOQUEADO
   - BLOQUEADO → volta ao passo 2 (DEV corrige) 
8. DONO+CÉREBRO fecham a fase  → msg 4 (handoff atualizado)
9. Só então: próxima fase      → volta ao passo 1

REGRAS ABSOLUTAS:
- Nenhum código entra no master sem passar por REVIEW APROVADO.
- Nenhuma fase começa sem SEC LIBERADO da fase anterior.
- Nenhum chat altera MAX_*, TRADING_MODE, LIVE_TRADING_ENABLED. Nunca.
- Trava de LIVE: TRADING_MODE=LIVE E LIVE_TRADING_ENABLED=true, ambos,
  com aprovação humana explícita por escrito. Sem exceção.
```

---

## 1. Mensagens prontas (copiar e colar)

### MSG 1 — Abertura de fase → chat DEV

> Você é o DEV da fase **F<N>**: <nome>. Antes de qualquer linha de código, leia nesta ordem: `AGENTS.md`, `docs/operations/phase-pipeline.md`, `docs/roadmap.md` (linha da F<N>), `docs/handoff.md` (último bloco) e `docs/reviews/README.md`.
>
> Regras inegociáveis para esta fase:
> 1. Trabalhe SEMPRE via `powershell -File scripts/start-sprint-worktree.ps1 -Name f<n>-<slug>` e dentro da worktree criada. Nunca no master.
> 2. Gate da fase (critério de conclusão): **<colar o critério do roadmap>**.
> 3. Commits pequenos e frequentes, mensagem convencional (`feat:`, `fix:`…). A cada task: `npm run lint && npm run typecheck && npm test` verdes antes de commitar.
> 4. Se decidir entre alternativas, registre ADR em `docs/architecture/decision-log.md`.
> 5. Ao concluir: atualize seu `docs/handoff.md` na branch e me responda com a LISTA DE SHAs. Não declare a fase concluída sem eu confirmar o merge.
>
> Confirme o entendimento repetindo o gate da fase e a branch que vai usar.

### MSG 2 — Fechamento de sprint (quando DEV avisar) → delegue ao CÉREBRO

Você NÃO precisa fazer manualmente. Mande ao chat CÉREBRO:

> O DEV fechou a sprint `sprint/<nome>` da F<N>. Roda o gate de merge e, se tudo aprovado, integra no master.

O CÉREBRO executa `scripts/merge-sprint.ps1 -Branch sprint/<nome> [-Push]`, que faz **mecanicamente**: lista os commits da sprint → exige `docs/reviews/<sha>.md` com APROVADO para **cada um** → aborta se faltar review ou houver REJEITADO → merge `--no-ff` → roda lint/typecheck/test no resultado. Falha em qualquer ponto = sem merge, e a correção volta ao DEV:

> "Commit <sha> rejeitado/sem review. Leia `docs/reviews/<sha>.md`, corrija na sua branch (ou aceite `review-fix/`) e recommite."

Se você quiser fazer sozinho mesmo assim, basta rodar o mesmo script num terminal.

### MSG 3 — Auditoria de segurança → chat SEC

> Você é o SEC (red-team) da fase **F<N>**, que acabou de mergear no master. Leia nesta ordem: `AGENTS.md`, `docs/operations/phase-pipeline.md`, `docs/security/red-team/README.md` + `FINDINGS.md` + threat model, e o diff da sprint: `git log --oneline master` (commits da F<N>) + `git diff <sha-antes>..master`.
>
> Regras:
> 1. Você é READ-ONLY para código. Nunca edita `packages/`, `services/`, `apps/`.
> 2. Procure: vazamento/manuseio de secrets, paths que contornem as travas LIVE, idempotência/dedup quebráveis, validação zod ausente na borda, injeção via dados on-chain, dependências novas suspeitas (`npm audit` + análise do diff do package-lock).
> 3. Cada finding: vetor de ataque + evidência reproduzível + severidade (CRITICAL/HIGH/MEDIUM/LOW) + recomendação. Registre em `docs/security/red-team/` conforme o README.
> 4. Termine com veredicto explícito: **LIBERADO** ou **BLOQUEADO**. CRITICAL/HIGH aberto = BLOQUEADO automático.

### MSG 4 — Fechamento de fase → chat CÉREBRO (eu)

> F<N> mergeada e SEC LIBERADO. Último commit master: <sha>. Fecha a fase: valide os gates contra `docs/roadmap.md`, atualize `docs/handoff.md` (feito/pendências/próximo passo com SHAs), liste decisões que preciso tomar antes da F<N+1> e me diga se existe qualquer débito técnico que deva entrar antes de abrir a próxima fase.

### MSG 5 — Abertura de QUALQUER chat novo (template universal)

> Este projeto é o copytrade (Solana). Antes de qualquer tarefa leia: `AGENTS.md`, `docs/operations/phase-pipeline.md`, `docs/handoff.md`. Seu papel nesta sessão é: <DEV | REVIEW | SEC | CÉREBRO>. Confirme seu papel e as regras que se aplicam a você.

---

## 2. Tabela anti-esquecimento (cole na parede)

| Momento | Quem age | Mensagem/ação |
|---|---|---|
| Vou começar a fase F<N> | DONO → DEV | MSG 1 |
| DEV disse "terminei" | DONO → CÉREBRO | MSG 2 (delegada; script `merge-sprint.ps1`) |
| Merge OK | DONO → SEC | MSG 3 |
| SEC LIBEROU | DONO → CÉREBRO | MSG 4 |
| Abrir chat novo | DONO → chat novo | MSG 5 |

## 3. Sinais de alarme (pare tudo se ver)

- Alguém pediu para pular REVIEW "só dessa vez" → **sinal vermelho**
- SEC querendo corrigir código sozinho → **sinal vermelho** (perde o veto independente)
- DEV editando arquivos no master em vez de worktree → **sinal vermelho**
- Qualquer proposta envolvendo `TRADING_MODE=LIVE` antes de F9 → **pare e chame o CÉREBRO**
- progresso "óbvio demais" sem evidência (testes, prints, SHAs) → peça evidência

---

*Última revisão: 2026-09-22 (CÉREBRO). Alterar este arquivo exige aprovação do dono.*
