import { loadConfig } from '@ct/config';
import { createLogger } from '@ct/logging';

const SERVICE_NAME = 'notification-service';

export async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(SERVICE_NAME);
  logger.info('service booting');
  logger.info('config validada', { mode: config.tradingMode });
}

// TODO(FASE-6): implementar notificações (Telegram) de sinais, trades e alertas de risco
