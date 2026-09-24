## ADR-010 — ObservedEvent.wallet como address (String), sem FK

- **Contexto:** schema.prisma declarava Wallet.observedEvents ObservedEvent[], mas ObservedEvent.wallet é o address on-chain (String), não FK — prisma migrate diff falhava com P1012 (opposite relation ausente).
- **Decisão:** remover a relation observedEvents de Wallet. Eventos observados podem incluir wallets não rastreadas; relacionar por address exigiria unique constraint redundante. Dedup permanece via @@unique([signature, instructionIndex, wallet]).
- **Status:** FACT.
