/**
 * @ct/config — carregamento e validação de configuração com zod.
 *
 * REGRAS DE SEGURANÇA (falham fechado — config inválida impede o boot):
 *  - Guard LIVE: TRADING_MODE=LIVE exige LIVE_TRADING_ENABLED=true (dupla trava).
 *  - Nenhum valor de risco possui default implícito além dos placeholders do .env.example.
 */

import { z } from 'zod';
import type { TradingMode } from '@ct/types';

const tradingModeSchema = z.enum(['PAPER', 'SHADOW', 'LIVE']);

const boolFromEnv = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false']))
  .transform((v) => v === 'true');

const positiveNumber = z.coerce.number().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();

export const envSchema = z
  .object({
    TRADING_MODE: tradingModeSchema.default('PAPER'),
    LIVE_TRADING_ENABLED: boolFromEnv.default('false'),
    TRADING_KILL_SWITCH: boolFromEnv.default('false'),

    MAX_TRADE_SOL: positiveNumber,
    MAX_POSITION_SOL: positiveNumber,
    MAX_TOTAL_EXPOSURE_SOL: positiveNumber,
    MAX_DAILY_LOSS_SOL: positiveNumber,
    MAX_CONCURRENT_POSITIONS: nonNegativeInt,
    MAX_TRADES_PER_DAY: nonNegativeInt,

    SOLANA_RPC_HTTP: z.string().url(),
    SOLANA_RPC_WSS: z.string().url().optional(),
    HELIUS_API_KEY: z.string().min(1).optional(),

    BOT_WALLET_PUBLIC_KEY: z.string().min(32).optional(),

    DATABASE_URL: z.string().min(1),

    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    API_PORT: z.coerce.number().int().positive().default(3001),
  })
  .strict();

export type AppConfig = z.infer<typeof envSchema> & { tradingMode: TradingMode };

/**
 * Carrega e valida a configuração a partir de `process.env` (ou fonte injetada).
 * Lança `ConfigError` em qualquer violação — incluindo a violação da dupla trava LIVE.
 */
export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(`Configuração inválida: ${parsed.error.message}`);
  }
  const cfg = parsed.data;

  // Guard LIVE — dupla trava (falha fechada).
  if (cfg.TRADING_MODE === 'LIVE' && !cfg.LIVE_TRADING_ENABLED) {
    throw new ConfigError(
      'TRADING_MODE=LIVE exige LIVE_TRADING_ENABLED=true (dupla trava). Boot abortado.',
    );
  }
  // LIVE nunca deve nascer de default — modo precisa estar explícito no env.
  if (cfg.TRADING_MODE === 'LIVE' && source.TRADING_MODE === undefined) {
    throw new ConfigError('TRADING_MODE=LIVE não pode ser default. Boot abortado.');
  }

  return { ...cfg, tradingMode: cfg.TRADING_MODE };
}

/** True somente quando a execução real de transações está plenamente habilitada. */
export function isLiveExecutionEnabled(cfg: AppConfig): boolean {
  return cfg.tradingMode === 'LIVE' && cfg.LIVE_TRADING_ENABLED === true;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}
