/**
 * Repository de AuditLog — trilha de auditoria APPEND-ONLY.
 * REGRA: este módulo nunca expõe update/delete. Mudanças de config de risco
 * exigem audit log (AGENTS.md §7).
 *
 * Mapeamento de campos do domínio para o schema:
 *   who  → actor
 *   what → action
 *   when → registrado em details (createdAt é autoridade do banco)
 *   why  → details.why
 */
import { RepositoryError } from './errors.js';

export interface AuditLogInput {
  /** Quem executou (identidade humana ou agente/serviço). */
  who: string;
  /** O que foi feito (ex.: 'config.update', 'risk.veto'). */
  what: string;
  /** Quando ocorreu (default: agora). O banco também grava createdAt. */
  when?: Date;
  /** Por que — motivo/decisão. Nunca omitir em mudanças de risco. */
  why?: string;
  /** Alvo afetado (ex.: nome da config). */
  target?: string;
  /** Dados extras (ex.: before/after). */
  details?: unknown;
}

export interface AuditLogDelegate {
  create(args: {
    data: { actor: string; action: string; target?: string; details?: unknown };
  }): Promise<unknown>;
}

/** Anexa uma entrada ao audit log. Append-only por construção. */
export async function appendAuditLog(
  client: { auditLog: AuditLogDelegate },
  input: AuditLogInput,
): Promise<{ id: string }> {
  if (!input.who || !input.what) {
    throw new RepositoryError(
      'VALIDATION_ERROR',
      'AuditLog exige who e what (nunca append anônimo)',
    );
  }
  try {
    const created = (await client.auditLog.create({
      data: {
        actor: input.who,
        action: input.what,
        ...(input.target !== undefined ? { target: input.target } : {}),
        details: {
          ...(input.details !== undefined ? { data: input.details } : {}),
          ...(input.why !== undefined ? { why: input.why } : {}),
          when: (input.when ?? new Date()).toISOString(),
        },
      },
    })) as { id: string };
    return { id: created.id };
  } catch (err) {
    throw new RepositoryError(
      'DATABASE_ERROR',
      `Falha ao anexar AuditLog (action=${input.what})`,
      err,
    );
  }
}
