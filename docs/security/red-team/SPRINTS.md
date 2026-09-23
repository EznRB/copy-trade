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

## SPRINT 2 — 2026-09-22 — Auditoria pós-merge F1 (ingestion + dedup)
- Executada por: chat SEC (red-team), após merge `6b1ed97`.
- Escopo: parsers de eventos on-chain (`schemas.ts`, `normalizer.ts`), dedup sob replay/reconnect/concorrência (`dedup-store.ts`), validação zod na borda, guards pipeline, provider `helius-provider.ts` (WSS, não há webhooks implementados).
- Envolvidos: arquivos novos alterados em F1 + contexto de `packages/solana`, `packages/config`.
- Cobertura de alvos da fila: **3 (input adversarial/parsers)** ✓, **5 (DoS/estresse/dedup)** ✓ (parcial — fault-injection DB/RPC simulada via stubs; carga real de rede adiada), webhooks → **N/A nesta fase** (não há webhook na F1; usar WSS).
- Método: 13 testes unitários adversariais + 2 suites property-based (fast-check, 500 + 2000 runs) em `docs/security/red-team/poc/`.
- Findings novos: **RT-004 (MEDIUM)**, RT-005 (LOW), RT-006 (LOW).
- Findings fechados: nenhum.
- Evasões tentadas SEM SUCESSO (defesa segurou — importante documentar):
  1. Strict mode do zod rejeitou campos extras de forma hostil — sem prototype pollution via spread.
  2. `z.coerce.number().int()` rejeitou NaN/Infinity/negativos em slot/block_time.
  3. Dedup cache LRU está correto em chamadas sequenciais e em P2002; erro transitório NÃO marca cache (retry-friendly, comportamento correto).
  4. Slot perda de precisão exige ≥ 2^53 (9007199254740992) — inalcançável na Solana (~3e8). Ataque refutado.
  5. `normalizeRawNotification` nunca lança exceção para NENHUM input arbitrário (fast-check 500 runs).
  6. `safeHost()` não vaza `api-key` em logs (helius-provider.ts:424).
  7. `failPendingSubscribes` fecha leak de promises de subscribe em disconnect.
- Veredicto: veja seção "## Veredictos" abaixo.
- Próximo alvo sugerido: **F1.5 enrichment (getTransaction parsing) — quando mergeado**, alvo 1 da fila (guards financeiros LIVE/kill switch) para F2+.

## Veredictos

### Sprint 2 — F1 ingestion (commit `6b1ed97`)
**Veredicto: LIBERADO**
- Nenhum finding CRITICAL/HIGH novo.
- RT-004 (MEDIUM) e RT-005/006 (LOW) são resiliência/robustez — **não bloqueiam a F2**, mas DEVEM entrar na fila de trabalho de solana-ingestion. Alta prioridade para RT-004 antes de F1.5 (enrichment vai aumentar volumes).

### Sprint 1 — Tooling
**Veredicto: LIBERADO** (RT-001 FIXED-VERIFIED; RT-002 ACCEPTED; RT-003 FIXED-VERIFIED).

<!-- Template:

## SPRINT N — <data> — <tema>
- Executada por: (chat/sessão)
- Escopo:
- Findings novos: RT-001, RT-002...
- Findings fechados (re-testados):
- Evasões tentadas sem sucesso (defesas que seguraram):
- Próximo alvo sugerido:
-->
