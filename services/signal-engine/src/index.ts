import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'signal-engine';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting');
  logger.info('config validada', { mode: config.tradingMode });
}

// TODO(FASE-4): implementar geração de sinais determinística (Consensus, Signal Score, regras com strategy_id/version)
