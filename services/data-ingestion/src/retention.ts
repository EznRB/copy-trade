/**
 * Retention — política de retenção da camada RAW (ADR-024, documento fonte §63).
 *
 * FACT medido no smoke F1: ~568 MB/40min no fixture Pump.fun. Sem retenção,
 * o disco esgota em dias. Política inicial: apagar ObservedEvent mais velhos
 * que RETENTION_RAW_DAYS (default 3 dias), em lotes, fora do caminho quente.
 *
 * Fases futuras compactam RAW → NORMALIZED → FEATURES → AGGREGATES; aqui é
 * apenas o alívio bruto. NUNCA apagar dados necessários ao replay/backtest
 * sem uma camada agregada persistida antes (débito documentado em F5).
 */
import { setInterval, clearInterval } from 'node:timers';

export interface RetentionRepo {
  deleteMany(args: { where: { receivedAt: { lt: Date } } }): Promise<{ count: number }>;
}

export interface LoggerLike {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export class RetentionJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repo: RetentionRepo,
    private readonly logger: LoggerLike,
    private readonly retentionDays = Number(process.env['RETENTION_RAW_DAYS'] ?? 3),
    private readonly intervalMs = Number(process.env['RETENTION_INTERVAL_MS'] ?? 3_600_000),
    // ADR-024 + gate F1.5: purge de RAW NUNCA é default-on. Ligar só de forma
    // explícita (RETENTION_RAW_ENABLED=true) — F1.5 aumenta volume e apagar
    // RAW sem agregados persistidos destrói o material de replay/fixtures.
    private readonly enabled = (process.env['RETENTION_RAW_ENABLED'] ?? 'false') === 'true',
  ) {}

  start(): void {
    if (this.timer !== null) return;
    if (!this.enabled) {
      this.logger.info(
        'retention DESLIGADA por padrão (ADR-024 — F1.5 aumenta volume; ligar via RETENTION_RAW_ENABLED=true)',
      );
      return;
    }
    if (this.retentionDays <= 0) {
      this.logger.warn('retenção DESLIGADA (RETENTION_RAW_DAYS <= 0) — risco de disco', {
        errorClass: 'CONFIG_ERROR',
      });
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    this.logger.info('retention job ativo', {
      retentionDays: this.retentionDays,
      intervalMs: this.intervalMs,
    });
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0; // sobreposição defensiva
    this.running = true;
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
      const { count } = await this.repo.deleteMany({ where: { receivedAt: { lt: cutoff } } });
      if (count > 0) {
        this.logger.info('retention: RAW antigos removidos', { deleted: count, cutoff });
      }
      return count;
    } catch (err) {
      this.logger.error('retention falhou — DATABASE_ERROR', {
        errorClass: 'DATABASE_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
