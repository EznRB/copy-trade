## ADR-019 — Camada de streaming: vixen / shredstream / laserstream / shredtop

- **Verificação (FACT, GitHub API 2026-09-24):** `rpcpool/yellowstone-vixen` (256★, MIT, ativo, Rust — parser framework sobre Yellowstone com exemplos pump.fun); `jito-labs/shredstream-proxy` (245★, Apache-2.0, ativo — shreds sub-slot, requer acordo/infra Jito); `helius-labs/laserstream-sdk` (57★, MIT, ativo — gRPC gerenciado com replay/failover); `malbeclabs/shredtop` (12★, licença não padrão, parado mai/2026 — comparador de latência).
- **Decisões:**
  - **Vixen:** referência primária de design do decoder pipeline (F1.5). Não integrar (Rust); o decoder TS usa `@pump-fun/pump-sdk` (ADR-016). Se parsing virar gargalo medido, vixen é o candidato a serviço lateral.
  - **LaserStream:** continua o caminho de produção do ADR-011; `laserstream-sdk` dedicado entra quando migrarmos do Enhanced WS (dev) para streaming dedicado (servidor Linux).
  - **ShredStream:** adiado para F9 avançado, condicionado a medição provando que LaserStream/gRPC é insuficiente; bloco de infra dedicada obrigatório.
  - **Shredtop:** laboratório opcional para medir latência de providers antes da escolha final de streaming em produção; não virar dependência.
- **Status:** FACT (decisões registradas).
