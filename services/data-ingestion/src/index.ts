/**
 * data-ingestion — boot do serviço (Fase 1).
 * Graceful shutdown em SIGINT/SIGTERM: para de aceitar eventos, drena,
 * fecha provider e desconecta Prisma.
 */
import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';
import { prisma } from '@ct/database';
import { normalizeRawNotification } from './normalizer.js';
import { DedupStore } from './dedup-store.js';
import { IngestionPipeline } from './pipeline.js';
import { createDataProvider } from './factory.js';
import { InstanceLock } from './instance-lock.js';
import { RetentionJob } from './retention.js';
import { Enricher, type DecodedSwap } from './enricher.js';
import { EnrichRunner } from './enrich-runner.js';
import { RpcProvider } from '@ct/solana';
import {
  markEnriched as repoMarkEnriched,
  markUndecodable as repoMarkUndecodable,
  findUnenriched as repoFindUnenriched,
  incrementEnrichAttempt as repoIncrementAttempt,
} from '@ct/database';
// Nota: prisma.observedEvent (delegate tipado do Prisma) e a interface mínima
// ObservedEventEnrichDelegate divergem por exactOptionalPropertyTypes; o cast
// no ponto de glue (abaixo) é consciente — os repos validam os payloads.
import type { ObservedEventEnrichDelegate } from '@ct/database';
import type { DecodedSwap as DecodedSwapType } from '@ct/pumpfun';

const SERVICE_NAME = 'data-ingestion';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting', { tradingMode: config.tradingMode });

  // Single-instance (ADR-024): aborta se já houver instância viva rodando.
  const lock = new InstanceLock(
    process.env['INGESTION_LOCK_PATH'] ?? './data/locks/data-ingestion.lock',
  );
  lock.acquire();

  const store = new DedupStore(prisma.observedEvent);
  const pipeline = new IngestionPipeline(store, logger);
  pipeline.start();

  // Retenção RAW (ADR-024): alívio de disco; agregação vem em fases futuras.
  const retention = new RetentionJob(prisma.observedEvent, logger);
  retention.start();

  const provider = createDataProvider(config, { logger });
  /*
   * logsNotification não carrega wallet/instruction_index — o enriquecimento
   * (qual wallet do filtro "mentions" disparou, BUY/SELL, mint) é Fase 1.5
   * via getTransaction. Por isso consumimos onRawEvent e normalizamos apenas
   * signature+slot; demais campos ficam null/UNKNOWN (nunca estimar).
   */
  if (!('onRawEvent' in provider) || typeof provider.onRawEvent !== 'function') {
    throw new Error('CONFIG_ERROR: provider não expõe onRawEvent (interface esperada)');
  }
  const rawProvider = provider as unknown as {
    onRawEvent: (cb: (n: { signature: string; slot: number; value: unknown }) => void) => void;
  };
  rawProvider.onRawEvent((raw) => {
    const result = normalizeRawNotification(
      { signature: raw.signature, slot: raw.slot },
      'websocket',
      Date.now(),
    );
    if (!result.ok) {
      store.counters.errors++;
      logger.warn('notificação crua inválida — VALIDATION_ERROR', {
        errorClass: 'VALIDATION_ERROR',
        error: result.error.message,
      });
      return;
    }
    pipeline.ingest(result.event).catch((e: unknown) => {
      // NUNCA deixar erro escapar do loop do event loop.
      logger.error('erro inesperado no loop de ingestão — UNKNOWN_ERROR', {
        errorClass: 'UNKNOWN_ERROR',
        error: e instanceof Error ? e.message : String(e),
      });
    });
  });
  await provider.connect();

  // ---- F1.5: enricher (decode BUY/SELL real) -------------------------------
  // Ligado por padrão em todos os modos (só leitura on-chain + escrita local;
  // nenhuma transação é enviada). Retries limitados por enrichAttempts.
  const rpc = new RpcProvider(
    [{ name: 'primary', url: config.SOLANA_RPC_HTTP, tier: 'primary' }],
    { logger },
  );
  const enricher = new Enricher(
    { getTransaction: (sig) => rpc.getTransaction(sig) },
    {
      async bumpAttempt(id) {
        await repoIncrementAttempt({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, id);
      },
      async markEnriched(id, d: DecodedSwap) {
        const dec: DecodedSwapType = d;
        await repoMarkEnriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, {
          id,
          direction: dec.direction,
          amountSol: dec.solAmount,
          tokenAmount: dec.tokenAmount,
          mint: dec.mint,
          counterparty: dec.counterparty,
          enrichSource: `pump-decoder-v1:${dec.kind}`,
        });
      },
      async markUndecodable(id, reason) {
        await repoMarkUndecodable({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, id, reason);
      },
    },
    logger,
  );
  let enrichTimer: NodeJS.Timeout | null = null;
  const runner = new EnrichRunner(
    {
      findUnenriched: (limit, maxAttempts) =>
        repoFindUnenriched({ observedEvent: prisma.observedEvent as unknown as ObservedEventEnrichDelegate }, { limit, maxAttempts }),
    },
    enricher,
    {
      batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25),
      maxAttempts: Number(process.env['ENRICH_MAX_ATTEMPTS'] ?? 5),
      sleepMs: Number(process.env['ENRICH_SLEEP_MS'] ?? 120), // ~8 req/s no RPC
    },
  );
  const enrichEnabled = (process.env['ENRICH_ENABLED'] ?? 'true') === 'true';
  if (enrichEnabled) {
    enrichTimer = setInterval(() => void runner.runUntilEmpty(1), 2_000);
    enrichTimer.unref?.();
    logger.info('enricher ativo', { batchSize: Number(process.env['ENRICH_BATCH_SIZE'] ?? 25) });
  } else {
    logger.warn('enricher DESLIGADO (ENRICH_ENABLED=false)');
  }
  // ---------------------------------------------------------------------------

  // Subscrição explícita: sem endereços configurados o pipeline sobe mas não observa nada.
  const watch = (config.INGESTION_WATCH_ADDRESSES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (watch.length === 0) {
    logger.warn('INGESTION_WATCH_ADDRESSES vazio — nenhuma subscrição ativa', {
      errorClass: 'CONFIG_ERROR',
    });
  } else {
    await provider.subscribeWallets(watch);
    logger.info('subscrições ativas', { watchCount: watch.length });
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutdown iniciado', { signal });
    runner.stop();
    if (enrichTimer !== null) clearInterval(enrichTimer);
    retention.stop();
    await pipeline.stop(); // drain: para de aceitar novos, stats finais
    await provider.close();
    await prisma.$disconnect();
    lock.release();
    logger.info('shutdown completo', { signal });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  logger.info('pipeline ativo');
}
