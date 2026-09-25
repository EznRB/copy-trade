## ADR-025 — Fatos de runtime descobertos na F1.5 (decoder/enrichment)

- **Contexto:** implementação do enrichment (decoder codama + IDL oficial `pump-public-docs @81091419`).
- **Fatos (FACT, verificados em 2026-09-24 com a API real):**
  1. Enhanced API Helius é acessível em `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=` (sem barra antes de `?`); nessa máquina `api.helius.dev` não resolve DNS.
  2. `getTransaction` pode retornar `version: 1` — usar `maxSupportedTransactionVersion: 1` (antes era 0; quebra nova).
  3. Helius free: `logsSubscribe` aceita **1 endereço por subscription** ("Only 1 address supported") — o provider faz 1 sub/endereço; barato para até dezenas de programas.
- **Decisões:**
  - Clientes codama ficam com `// @ts-nocheck` (postprocess do script `codama.pump.mjs`) porque a IDL oficial contém PDA collisions que o codama renomeia parcialmente; o wrapper `decode.ts` permanece 100% tipado. Revisitar se o upstream corrigir.
  - `trackVolume` usa codec `OptionBool = readonly [boolean]` (arg é tupla `[false]`) — diverge do booleano plano; documentado porque quebra silenciosamente se passado `false`.
- **Status:** FACT.
