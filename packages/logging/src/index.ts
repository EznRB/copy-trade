/**
 * @ct/logging — logger JSON estruturado.
 *
 * Regras:
 * - Nunca usar console.* (eslint no-console é erro). Saída via process.stdout/stderr.write.
 * - Redaction obrigatória: chaves sensíveis e strings que pareçam base58 longas
 *   são mascaradas com ***REDACTED*** ANTES de serializar.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /key|secret|token|password|seed|private/i;

/**
 * Heurística: string base58 "longa" (sem 0/O/I/l, >32 chars) provavelmente é
 * chave/assinatura/seed. Melhor falso positivo do que vazamento (ver AGENTS.md §2).
 */
const BASE58_LONG_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{33,}$/;

const REDACTED = '***REDACTED***';

function redactValue(key: string | undefined, value: unknown, depth: number): unknown {
  if (depth > 8) return '[MaxDepth]';
  if (key !== undefined && SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;

  if (typeof value === 'string') {
    if (BASE58_LONG_PATTERN.test(value)) return REDACTED;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(undefined, item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v, depth + 1);
    }
    return out;
  }
  return value;
}

function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = redactValue(k, v, 0);
  }
  return out;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

class StructuredLogger implements Logger {
  constructor(
    private readonly service: string,
    private readonly bindings: Record<string, unknown> = {},
    private readonly minLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel | undefined) ??
      'info',
  ) {}

  private write(level: LogLevel, message: string, fields: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      msg: message,
      ...redactFields({ ...this.bindings, ...fields }),
    };
    const line = JSON.stringify(entry) + '\n';
    if (level === 'warn' || level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  debug(message: string, fields: Record<string, unknown> = {}): void {
    this.write('debug', message, fields);
  }
  info(message: string, fields: Record<string, unknown> = {}): void {
    this.write('info', message, fields);
  }
  warn(message: string, fields: Record<string, unknown> = {}): void {
    this.write('warn', message, fields);
  }
  error(message: string, fields: Record<string, unknown> = {}): void {
    this.write('error', message, fields);
  }

  child(fields: Record<string, unknown>): Logger {
    return new StructuredLogger(this.service, { ...this.bindings, ...fields }, this.minLevel);
  }
}

export function createLogger(service: string): Logger {
  return new StructuredLogger(service);
}
