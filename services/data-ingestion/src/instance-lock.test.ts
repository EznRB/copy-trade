import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InstanceLock, isProcessAlive } from './instance-lock.js';

let dir: string;
let lockPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ct-lock-'));
  lockPath = join(dir, 'test.lock');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('InstanceLock', () => {
  it('adquire e libera o lock', () => {
    const lock = new InstanceLock(lockPath);
    lock.acquire();
    expect(existsSync(lockPath)).toBe(true);
    lock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it('rejeita segunda aquisição quando o PID do lock está vivo', () => {
    // Spawna um processo real e vivo para garantir o caminho de rejeição.
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stdio: 'ignore',
    });
    try {
      child.unref();
      expect(child.pid).toBeDefined();
      writeFileSync(lockPath, `${child.pid}\n`);
      const lock = new InstanceLock(lockPath);
      expect(() => lock.acquire()).toThrowError(/CONFIG_ERROR/);
    } finally {
      if (child.pid) {
        try {
          process.kill(child.pid);
        } catch {
          /* processo já morto — ok no teardown */
        }
      }
    }
  });

  it('lock stale (PID morto) é substituído', () => {
    // 4194303 é quase certamente inexistente
    writeFileSync(lockPath, '4194303\n');
    const lock = new InstanceLock(lockPath);
    lock.acquire();
    expect(existsSync(lockPath)).toBe(true);
    lock.release();
  });

  it('lock velho (timestamp ultrapassado) é tratado como stale', () => {
    const stale = Date.now() - 25 * 3_600_000; // 25h atras
    writeFileSync(lockPath, `${process.ppid || process.pid}\n${stale}\n`);
    // Mesmo que o PID do lock esteja "vivo" (ppid), a idade > 24h vence => substitui.
    const lock = new InstanceLock(lockPath);
    // ppid vivo + lock VELHO => stale, substitui (caminho da idade vence PID).
    lock.acquire();
    expect(existsSync(lockPath)).toBe(true);
    lock.release();
  });

  it('lock recente com PID vivo rejeita (nao stale)');

  it('lock corrompido (não-número) é substituído', () => {
    writeFileSync(lockPath, 'garbage\n');
    const lock = new InstanceLock(lockPath);
    lock.acquire();
    lock.release();
  });

  it('release não remove lock de outro PID (segurança contra corrida)', () => {
    const lock = new InstanceLock(lockPath);
    lock.acquire();
    writeFileSync(lockPath, '99999\n'); // outro processo "roubou" o lock
    lock.release();
    expect(existsSync(lockPath)).toBe(true);
  });
});

describe('isProcessAlive', () => {
  it('nosso próprio PID está vivo', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });
  it('PID inexistente está morto', () => {
    expect(isProcessAlive(4_194_303)).toBe(false);
  });
});
