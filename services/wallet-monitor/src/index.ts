import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'wallet-monitor';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting');
  logger.info('config validada', { mode: config.tradingMode });
}

// TODO(FASE-2): implementar monitoramento e classificação de wallets smart-money (Wallet Score, clusters)
