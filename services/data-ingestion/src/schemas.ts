/**
 * Schemas zod — validação de TUDO que entra/sai do pipeline (AGENTS.md §6:
 * dados on-chain e externos são hostis).
 *
 * Regras:
 * - Campos ausentes → aplicado default null no normalizador (nunca inventar).
 * - Dados malformados → safeParse falha → erro VALIDATION_ERROR, nunca crash.
 * - LIMITES EXPLÍCITOS (RT-004/RT-006): strings com .max() e allowlist base58
 *   para signature — proteção contra DoS de memória/DB e log injection.
 */

import { z } from 'zod';

/**
 * Base58 estrito (alphabet Solana/Bitcoin, sem 0, O, I, l).
 * Signature Solana: 87–88 chars (permitimos 64–88 para tolerância a variantes).
 */
export const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;
export const SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
export const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Notificação crua recebida do provider (wire).
 * `wallet` pode ser desconhecida neste estágio (UNKNOWN) — o enriquecimento é F1.5.
 *
 * RT-004: todos os campos string possuem .max(). Campos numéricos com teto.
 * RT-006: signature validada contra allowlist base58 (bloqueia \u0000, RTL
 * override, emoji — vetores de log injection via dedupKey/logs).
 */
export const rawNotificationSchema = z
  .object({
    signature: z.string().min(1).max(128).regex(SIGNATURE_REGEX, 'signature não é base58 válida'),
    slot: z.coerce.number().int().nonnegative().max(10_000_000_000),
    instruction_index: z.coerce.number().int().nonnegative().max(1024).default(0),
    // wallet pode ser 'UNKNOWN' nesta fase (logsNotification não a traz); por isso
    // aceitamos o literal 'UNKNOWN' OU base58 32–44. Verificado no enriquecimento (F1.5).
    wallet: z
      .string()
      .min(1)
      .max(64)
      .refine((w) => w === 'UNKNOWN' || WALLET_REGEX.test(w), 'wallet inválida')
      .default('UNKNOWN'),
    block_time: z.coerce.number().int().positive().max(4_102_444_800).nullish(), // até 2100-01-01
    // payload: tamanho controlado na camada de serialização (JSON.stringify com limite)
    // — ver normalizer.ts. Aqui apenas marcado como desconhecido/hostil.
    payload: z.unknown().optional(),
  })
  .strict();

export type RawNotification = z.infer<typeof rawNotificationSchema>;

/** Evento normalizado de saída — espelha NormalizedEvent de @ct/types. */
export const normalizedEventSchema = z
  .object({
    event_id: z.string().uuid(),
    correlation_id: z.string().min(1).max(64),
    source: z.string().min(1).max(64),
    wallet: z.string().min(1).max(64),
    signature: z.string().min(1).max(128).regex(SIGNATURE_REGEX),
    instruction_index: z.number().int().nonnegative().max(1024),
    slot: z.number().int().nonnegative().max(10_000_000_000),
    block_time: z.number().int().positive().max(4_102_444_800).nullable(),
    detected_at: z.number().int().positive(),
    processed_at: z.number().int().positive().nullable(),
    token_mint: z.string().min(1).max(64),
    action: z.enum(['BUY', 'SELL', 'TRANSFER', 'CREATE', 'UNKNOWN']),
    sol_amount: z.number().finite().nullable(),
    token_amount: z.number().finite().nullable(),
    price: z.number().finite().nullable(),
    market_cap: z.number().finite().nullable(),
    liquidity: z.number().finite().nullable(),
    latency_ms: z.number().nullable(),
  })
  .strict();

export function parseRawNotification(input: unknown) {
  return rawNotificationSchema.safeParse(input);
}

export function parseNormalizedEvent(input: unknown) {
  return normalizedEventSchema.safeParse(input);
}

/**
 * Serializa payload hostil com teto de tamanho (RT-004 defesa em profundidade).
 * Acima do limite → trunca para objeto marcador, NUNCA persiste o bruto gigante.
 */
export function boundedJson(value: unknown, maxBytes = 8_192): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? 'null';
  } catch {
    return JSON.stringify({ _unserializable: true });
  }
  if (text.length > maxBytes) {
    return JSON.stringify({
      _truncated: true,
      _originalBytes: text.length,
      preview: text.slice(0, 512),
    });
  }
  return text;
}
