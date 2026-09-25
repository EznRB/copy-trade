-- F1.5 enrichment: colunas nullable em "ObservedEvent".
-- Eventos antigos e nao decodificaveis permanecem NULL/UNKNOWN (nunca inferidos).
ALTER TABLE "ObservedEvent"
  ADD COLUMN "direction" TEXT,
  ADD COLUMN "amountSol" DECIMAL(65,30),
  ADD COLUMN "tokenAmount" DECIMAL(65,30),
  ADD COLUMN "mint" TEXT,
  ADD COLUMN "counterparty" TEXT,
  ADD COLUMN "enrichSource" TEXT,
  ADD COLUMN "enrichedAt" TIMESTAMP(3),
  ADD COLUMN "enrichAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ObservedEvent_mint_idx" ON "ObservedEvent"("mint");
CREATE INDEX "ObservedEvent_eventType_idx" ON "ObservedEvent"("eventType");
