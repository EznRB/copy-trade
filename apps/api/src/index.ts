import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'api';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ service: SERVICE_NAME });
  logger.info({ service: SERVICE_NAME }, 'api booting');
  logger.info({ mode: config.tradingMode }, 'config validada');
}

// TODO: adicionar framework HTTP (fastify/express) e rota GET /health retornando { status: 'ok' }
