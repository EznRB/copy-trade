/**
 * InstanceLock — garante instância única do serviço (ADR-024, débito F1).
 *
 * Dois processos de ingestão rodando simultaneamente (como ocorreu no smoke
 * da F1) duplicam trabalho e pressão no provider/DB. Implementação: lock file
 * com PID; na inicialização, se o lock existir E o PID estiver vivo → abortar
 * boot (falha fechada, CONFIG_ERROR). PID morto → lock stale, removido.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = processo existe mas sem permissão de sinal — considerar vivo.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class InstanceLock {
  private acquired = false;

  constructor(
    private readonly lockPath: string,
    private readonly now: () => number = Date.now,
  ) {}

  acquire(): void {
    if (existsSync(this.lockPath)) {
      const lines = readFileSync(this.lockPath, 'utf8').trim().split('\n');
      const pid = Number(lines[0]);
      const createdAt = Number(lines[1] ?? 0);
      // Stale por idade (review: PID reuse no Windows): lock mais velho que
      // LOCK_STALE_MS (default 24h) é considerado morto mesmo se o PID existir.
      const staleMs = Number(process.env['INGESTION_LOCK_STALE_MS'] ?? 86_400_000);
      const isStaleByAge = createdAt > 0 && this.now() - createdAt > staleMs;
      if (
        !isStaleByAge &&
        Number.isInteger(pid) &&
        pid > 0 &&
        pid !== process.pid &&
        isProcessAlive(pid)
      ) {
        throw new Error(
          `CONFIG_ERROR: já existe instância ativa (PID ${pid}) — lock em ${this.lockPath}. ` +
            'Encerre a instância anterior ou remova o lock se for stale.',
        );
      }
      // Lock stale (processo morreu sem cleanup OU idade superada) — remover e seguir.
      unlinkSync(this.lockPath);
    }
    mkdirSync(dirname(this.lockPath), { recursive: true });
    // Conteúdo: PID + timestamp (auditoria).
    writeFileSync(this.lockPath, `${process.pid}\n${this.now()}\n`, { flag: 'wx' });
    this.acquired = true;
  }

  release(): void {
    if (!this.acquired) return;
    this.acquired = false;
    try {
      const raw = readFileSync(this.lockPath, 'utf8').trim().split('\n')[0];
      // Só remove se o lock ainda é nosso (evita apagar lock de outra instância).
      if (raw === String(process.pid) && existsSync(this.lockPath)) unlinkSync(this.lockPath);
    } catch {
      // Lock file perdido/corrompido não deve impedir shutdown.
    }
  }
}
