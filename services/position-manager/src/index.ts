import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'position-manager';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting');
  logger.info('config validada', { mode: config.tradingMode });
}

// TODO(FASE-6): implementar gerenciamento de posições (paper trading) com PnL decomposto (gross - fees - slippage - priority - tips)
