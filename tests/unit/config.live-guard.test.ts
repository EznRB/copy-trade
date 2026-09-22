import { describe, expect, it } from 'vitest';
import {
  loadConfig,
  isLiveExecutionEnabled,
  ConfigError,
} from '../../packages/config/src/index.js';

const baseEnv = {
  MAX_TRADE_SOL: '0.01',
  MAX_POSITION_SOL: '0.05',
  MAX_TOTAL_EXPOSURE_SOL: '0.1',
  MAX_DAILY_LOSS_SOL: '0.05',
  MAX_CONCURRENT_POSITIONS: '3',
  MAX_TRADES_PER_DAY: '10',
  SOLANA_RPC_HTTP: 'https://api.mainnet-beta.solana.com',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/copytrade',
};

describe('LIVE guard (dupla trava)', () => {
  it('default absoluto é PAPER', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.tradingMode).toBe('PAPER');
    expect(isLiveExecutionEnabled(cfg)).toBe(false);
  });

  it('LIVE sem LIVE_TRADING_ENABLED falha fechado', () => {
    expect(() => loadConfig({ ...baseEnv, TRADING_MODE: 'LIVE' })).toThrowError(ConfigError);
  });

  it('LIVE com LIVE_TRADING_ENABLED=false falha fechado', () => {
    expect(() =>
      loadConfig({ ...baseEnv, TRADING_MODE: 'LIVE', LIVE_TRADING_ENABLED: 'false' }),
    ).toThrowError(ConfigError);
  });

  it('LIVE exíge AMBAS as travas', () => {
    const cfg = loadConfig({ ...baseEnv, TRADING_MODE: 'LIVE', LIVE_TRADING_ENABLED: 'true' });
    expect(isLiveExecutionEnabled(cfg)).toBe(true);
  });

  it('kill switch não habilita/desabilita live execution por si só', () => {
    const cfg = loadConfig({ ...baseEnv, TRADING_KILL_SWITCH: 'true' });
    expect(cfg.TRADING_KILL_SWITCH).toBe(true);
    expect(isLiveExecutionEnabled(cfg)).toBe(false);
  });
});

describe('validação zod', () => {
  it('limite negativo rejeitado', () => {
    expect(() => loadConfig({ ...baseEnv, MAX_TRADE_SOL: '-1' })).toThrowError(ConfigError);
  });

  it('RPC inválida rejeitada', () => {
    expect(() => loadConfig({ ...baseEnv, SOLANA_RPC_HTTP: 'not-a-url' })).toThrowError(
      ConfigError,
    );
  });

  it('chave desconhecida é rejeitada (strict)', () => {
    expect(() => loadConfig({ ...baseEnv, SURPRISE: 'x' })).toThrowError(ConfigError);
  });
});
