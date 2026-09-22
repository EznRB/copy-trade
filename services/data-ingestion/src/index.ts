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

const SERVICE_NAME = 'data-ingestion';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting', { tradingMode: config.tradingMode });

  const store = new DedupStore(prisma.observedEvent);
  const pipeline = new IngestionPipeline(store, logger);
  pipeline.start();

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

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutdown iniciado', { signal });
    await pipeline.stop(); // drain: para de aceitar novos, stats finais
    await provider.close();
    await prisma.$disconnect();
    logger.info('shutdown completo', { signal });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  logger.info('pipeline ativo');
}
