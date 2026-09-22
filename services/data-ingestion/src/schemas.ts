/**
 * Schemas zod — validação de TUDO que entra/sai do pipeline (AGENTS.md §6:
 * dados on-chain e externos são hostis).
 *
 * Regras:
 * - Campos ausentes → aplicado default null no normalizador (nunca inventar).
 * - Dados malformados → safeParse falha → erro VALIDATION_ERROR, nunca crash.
 */

import { z } from 'zod';

/**
 * Notificação crua recebida do provider (wire).
 * O formato real varia por provider; aqui validamos apenas o que é necessário
 * para identificar a transação de forma idempotente. `wallet` pode ser
 * desconhecida neste estágio (UNKNOWN) — o enriquecimento é F1.5.
 */
export const rawNotificationSchema = z
  .object({
    signature: z.string().min(1),
    slot: z.coerce.number().int().nonnegative(),
    instruction_index: z.coerce.number().int().nonnegative().default(0),
    wallet: z.string().min(1).default('UNKNOWN'),
    block_time: z.coerce.number().int().positive().nullish(),
    payload: z.unknown().optional(),
  })
  .strict();

export type RawNotification = z.infer<typeof rawNotificationSchema>;

/** Evento normalizado de saída — espelha NormalizedEvent de @ct/types. */
export const normalizedEventSchema = z
  .object({
    event_id: z.string().uuid(),
    correlation_id: z.string().min(1),
    source: z.string().min(1),
    wallet: z.string().min(1),
    signature: z.string().min(1),
    instruction_index: z.number().int().nonnegative(),
    slot: z.number().int().nonnegative(),
    block_time: z.number().int().positive().nullable(),
    detected_at: z.number().int().positive(),
    processed_at: z.number().int().positive().nullable(),
    token_mint: z.string().min(1),
    action: z.enum(['BUY', 'SELL', 'TRANSFER', 'CREATE', 'UNKNOWN']),
    sol_amount: z.number().nullable(),
    token_amount: z.number().nullable(),
    price: z.number().nullable(),
    market_cap: z.number().nullable(),
    liquidity: z.number().nullable(),
    latency_ms: z.number().nullable(),
  })
  .strict();

export function parseRawNotification(input: unknown) {
  return rawNotificationSchema.safeParse(input);
}

export function parseNormalizedEvent(input: unknown) {
  return normalizedEventSchema.safeParse(input);
}
