## ADR-012 — Pump.fun: IDL vendored, nenhum SDK npm de terceiros

- **Contexto:** pump.fun não publica SDK/IDL oficial; `pumpdotfun-sdk` (rckprtr) é autor individual, sem testes, estagnado desde mar/2025, preso a web3.js v1.
- **Decisão:** IDL comunitária **vendored** no repo (versionada, auditada), validada contra transações reais on-chain (fixtures de signatures conhecidas). Nenhuma dependência npm de "pump" de autor anônimo.
- **Justificativa:** supply-chain security (regra inviolável §2/§9); programa on-chain `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`. PumpSwap migrou parte do fluxo — IDLs podem estar desatualizadas, daí fixtures contra txs reais.
- **Status:** FACT (decisão). IDL específica ainda não escolhida: UNKNOWN até validação contra on-chain. **REVISADO pelo ADR-016 (2026-09-24):** existe SDK oficial `@pump-fun/pump-sdk` e `pump-public-docs`; a premissa "pump.fun não publica nada oficial" era falsa na época da verificação mais recente. IDL vendored continua vetada de fontes anônimas, mas a referência primária agora é oficial.
