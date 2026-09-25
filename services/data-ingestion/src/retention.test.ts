import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetentionJob, type RetentionRepo } from './retention.js';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeRepo(initial: Array<{ receivedAt: Date }>) {
  const rows = [...initial];
  const repo: RetentionRepo = {
    async deleteMany({ where }) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i]!.receivedAt < where.receivedAt.lt) rows.splice(i, 1);
      }
      return { count: before - rows.length };
    },
  };
  return { repo, rows };
}

describe('RetentionJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T20:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('remove apenas registros mais antigos que o cutoff', async () => {
    const { repo, rows } = makeRepo([
      { receivedAt: new Date('2026-09-22T19:00:00Z') }, // recente: mantém
      { receivedAt: new Date('2026-09-15T00:00:00Z') }, // antigo: remove
      { receivedAt: new Date('2026-09-10T00:00:00Z') }, // antigo: remove
    ]);
    const job = new RetentionJob(repo, silentLogger, 3);
    const deleted = await job.runOnce();
    expect(deleted).toBe(2);
    expect(rows).toHaveLength(1);
  });

  it('retentionDays <= 0 desliga com warn, sem timer', () => {
    const { repo } = makeRepo([]);
    const job = new RetentionJob(repo, silentLogger, 0, 3_600_000, true);
    job.start();
    expect(silentLogger.warn).toHaveBeenCalledOnce();
    job.stop();
  });

  it('default é DESLIGADO (ADR-024: purge de RAW nunca default-on)', () => {
    const { repo } = makeRepo([]);
    // Sem o 5o argumento (enabled) → desligado.
    const job = new RetentionJob(repo, silentLogger, 3, 1_000);
    job.start();
    expect(silentLogger.info).toHaveBeenCalledWith(expect.stringContaining('DESLIGADA'));
    job.stop();
  });

  it('erros do repo viram DATABASE_ERROR sem crash', async () => {
    const repo: RetentionRepo = {
      async deleteMany() {
        throw new Error('db down');
      },
    };
    const job = new RetentionJob(repo, silentLogger, 3);
    const deleted = await job.runOnce();
    expect(deleted).toBe(0);
    expect(silentLogger.error).toHaveBeenCalledOnce();
  });

  it('não executa passadas sobrepostas', async () => {
    let resolveBlock!: () => void;
    const blocker = new Promise<{ count: number }>((res) => (resolveBlock = () => res({ count: 0 })));
    const repo: RetentionRepo = { deleteMany: () => blocker };
    const job = new RetentionJob(repo, silentLogger, 3);
    const p1 = job.runOnce(); // fica pendente
    const p2 = await job.runOnce(); // deve retornar 0 imediatamente
    expect(p2).toBe(0);
    resolveBlock();
    await p1;
  });
});
