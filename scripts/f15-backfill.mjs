// scripts/f15-backfill.mjs - GATE F1.5 (backfill one-shot):
// Processa um lote de eventos persistidos e reporta cobertura (decoded vs UNKNOWN).
// Uso: node --env-file=.env scripts/f15-backfill.mjs [batchSize] [maxBatches]
import { prisma } from '../packages/database/dist/index.js';
import { RpcProvider } from '../packages/solana/dist/index.js';
import { Enricher } from '../services/data-ingestion/dist/enricher.js';
import { EnrichRunner } from '../services/data-ingestion/dist/enrich-runner.js';
import {
  markEnriched,
  markUndecodable,
  findUnenriched,
  incrementEnrichAttempt,
} from '../packages/database/dist/index.js';

const log = { info: console.error, warn: console.error, error: console.error }; // stderr (stdout = relatorio)

const rpc = new RpcProvider(
  [{ name: 'primary', url: process.env.SOLANA_RPC_HTTP, tier: 'primary' }],
  { logger: log },
);

const enricher = new Enricher(
  { getTransaction: (sig) => rpc.getTransaction(sig) },
  {
    bumpAttempt: (id) => incrementEnrichAttempt({ observedEvent: prisma.observedEvent }, id),
    markEnriched: (id, d) =>
      markEnriched({ observedEvent: prisma.observedEvent }, {
        id,
        direction: d.direction,
        amountSol: d.solAmount,
        tokenAmount: d.tokenAmount,
        mint: d.mint,
        counterparty: d.counterparty,
        enrichSource: `pump-decoder-v1:${d.kind}`,
      }),
    markUndecodable: (id, reason) =>
      markUndecodable({ observedEvent: prisma.observedEvent }, id, reason),
  },
  log,
);

const batchSize = Number(process.argv[2] ?? 50);
const maxBatches = Number(process.argv[3] ?? 200); // default: ate 10k eventos
const runner = new EnrichRunner(
  {
    findUnenriched: (limit, maxAttempts) =>
      findUnenriched({ observedEvent: prisma.observedEvent }, { limit, maxAttempts }),
  },
  enricher,
  { batchSize, maxAttempts: 5, sleepMs: 120 },
);

const started = Date.now();
const stats = await runner.runUntilEmpty(maxBatches);
const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

const bySource = await prisma.observedEvent.groupBy({
  by: ['enrichSource'],
  _count: { _all: true },
});
const coverage = {
  ...stats,
  elapsedSec,
  coveragePct:
    stats.seen > 0 ? ((stats.enriched / stats.seen) * 100).toFixed(1) + '%' : 'n/a',
  enrichSourceBreakdown: bySource,
};
process.stdout.write(JSON.stringify(coverage, null, 2) + '\n');
await prisma.$disconnect();
