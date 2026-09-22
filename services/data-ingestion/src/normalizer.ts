/**
 * Normalizer — converte notificações cruas (wire) em NormalizedEvent parcial.
 *
 * IMPORTANTE: o ENRIQUECIMENTO (parse de instruções para classificar
 * BUY/SELL/TRANSFER, extrair token_mint real, amounts, price etc.) é
 * responsabilidade de F1.5 / fases posteriores. Nesta fase, todo campo que
 * não está diretamente disponível na notificação crua fica `null` e
 * `action` fica 'UNKNOWN' — nunca estimar silenciosamente (AGENTS.md §2).
 */
import { randomUUID } from 'node:crypto';
import type { NormalizedEvent } from '@ct/types';
import { parseRawNotification } from './schemas.js';

export type NormalizeResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: Error };

export function normalizeRawNotification(
  input: unknown,
  source: string,
  detectedAt: number = Date.now(),
): NormalizeResult {
  const parsed = parseRawNotification(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: new Error(
        `VALIDATION_ERROR: notificação crua inválida — ${parsed.error.message}`,
      ),
    };
  }
  const raw = parsed.data;

  // Enriquecimento (BUY/SELL, token_mint real, amounts) é F1.5+.
  // Campos indisponíveis permanecem null; action permanece UNKNOWN.
  const event: NormalizedEvent = {
    event_id: randomUUID(),
    correlation_id: randomUUID(), // propagação cross-stack refinada em F1.5
    source,
    wallet: raw.wallet,
    signature: raw.signature,
    instruction_index: raw.instruction_index,
    slot: raw.slot,
    block_time: raw.block_time ?? null,
    detected_at: detectedAt,
    processed_at: null,
    token_mint: 'UNKNOWN',
    action: 'UNKNOWN',
    sol_amount: null,
    token_amount: null,
    price: null,
    market_cap: null,
    liquidity: null,
    latency_ms: null,
  };
  return { ok: true, event };
}
