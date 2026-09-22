import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'risk-engine';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting');
  logger.info('config validada', { mode: config.tradingMode });
}

// TODO(FASE-9): implementar Risk Engine com veto absoluto, circuit breakers e kill switch (TRADING_KILL_SWITCH)
