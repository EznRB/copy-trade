# F1.5 — Evidências do gate (enrichment)

## Fixtures (validacao 1:1 vs Helius Enhanced) — RE-REVIEW 2026-09-25

- Rodada inicial (prematura): 16/16 por criterio raso (apenas `helius.type === SWAP`) — **rejeitado** em `docs/reviews/2ab477f7*` (MEDIUM-2: ignora user/mint/direction/amounts).
- Rodada rigorosa: comparacao 1:1 com direction(=token-side), user==feePayer, mint em tokenTransfers. **Resultado:** sample=10, pumpswap=9, perfectMatches=5, divergences=5 (listadas no JSON).
  - Bug REAL encontrado e corrigido: pool PumpSwap com **base=wSOL** inverte a semantica buy/sell (direction muta pelo lado do token) — fix em `decode.ts` + fixture real `62uhRP3s…` era pump_buy-de-wSOL exibido como sell pelo Helius.
  - Divergencias restantes = **classes semanticas**, nao erro de decode: `mintPresent` (Enhanced nem sempre lista mint do lado wSOL em tokenTransfers; heliusDir=null quando indeterminavel) e `directionEq` ocasional em multi-hop. Documentado, nunca engolido — o JSON lista cada divergencia com campos.
- `fixtures-report.json` reescrito sem BOM em `docs/research/f15/`.

> ASSUMPTION documentada: eventos da subscricao da curva Pump.fun incluem muitos
> transfers/SYSTEM_PROGRAM que NAO sao swaps — decodificar = UNKNOWN explicito
> e correto. A taxa de cobertura do backfill (abaixo) e consistente com isso.

## Backfill (one-shot, 10k eventos)

- `backfill-report.json`: seen=10000, enriched=1914 (**cobertura 19.1%** do lote),
  undecodable=8086 (transfers/creates/migrations sem instrucao de swap), retried=0, elapsedSec=4139.
- Breakdown: pump_buy=675, pump_sell=1580, pumpswap_sell=10 (ultimas medidas do lote).

## Bugs descobertos/validados no caminho (todos FIXED)

1. Endpoint Enhanced: `api.helius.dev` nao resolve no DNS local; use
   `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem barra antes de `?`).
2. getTransaction: transacoes podem ser `version: 1` — `maxSupportedTransactionVersion: 1`.
3. Helius free: `logsSubscribe` aceita 1 endereco por subscription — provider faz 1 sub/endereco.
4. Codama: `accept(renderVisitor)` e async — script aguarda ambos antes de achatar; clientes gerados
   ficam com `@ts-nocheck` (postprocess documentado em `packages/pumpfun/codama.pump.mjs`).
