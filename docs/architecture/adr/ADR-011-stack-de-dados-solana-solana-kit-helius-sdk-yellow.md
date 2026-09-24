## ADR-011 — Stack de dados Solana: @solana/kit + helius-sdk + yellowstone-grpc

- **Contexto:** F1 (ingestion) precisa de SDK Solana e streaming de transações.
- **Alternativas:** `@solana/web3.js` v1 (legacy, manutenção), `@solana/kit` (v2 oficial, anza-xyz), QuickNode, Yellowstone gRPC (Triton).
- **Decisão:** `@solana/kit` (+ `@solana-program/token`/`system`), `helius-sdk` (Enhanced WS/LaserStream), `@triton-one/yellowstone-grpc` (client gRPC; NAPI nativo só existe p/ Linux — no Windows usar fallback JS puro ou WSL2).
- **Justificativa:** kit é o sucessor oficial; helius-sdk 3.x é construído sobre kit; gRPC é padrão da indústria p/ baixa latência. Arquitetura abstrai provider (`TransactionStreamProvider`) p/ trocar implementação sem reescrever consumidores.
- **Status:** FACT (instalado em `@ct/solana`). Risco: NAPI indisponível no Windows dev local — mitigado via fallback.
