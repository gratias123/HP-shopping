import type { DatabaseSync } from 'node:sqlite';
import { queryAll } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import { nowIso } from '../lib/ids.js';
import { formatMoney } from '../lib/money.js';

export interface PromoRow {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  used_count: number;
  active: number;
}

export interface PromoEvaluation {
  id: string;
  code: string;
  description: string;
  discountCents: number;
}

export function listPromoCodes() {
  return queryAll<Record<string, unknown>>(
    `SELECT id, code, description, type, value, min_subtotal_cents, starts_at, ends_at, max_uses,
            max_uses_per_customer, used_count, active, created_at, updated_at
       FROM promo_codes ORDER BY active DESC, created_at DESC`,
  ).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    description: String(row.description ?? ''),
    type: row.type as 'percent' | 'fixed',
    value: Number(row.value),
    minSubtotalCents: Number(row.min_subtotal_cents),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    maxUses: (row.max_uses as number | null) ?? null,
    maxUsesPerCustomer: (row.max_uses_per_customer as number | null) ?? null,
    usedCount: Number(row.used_count),
    active: Number(row.active) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

/**
 * Valide un code promo et calcule la remise. Lève une ApiError 422 explicite
 * lorsqu'il n'est pas applicable. Toujours appelé côté serveur, y compris
 * pendant la création de commande (dans la transaction).
 */
export function evaluatePromo(
  db: DatabaseSync,
  input: { code: string; subtotalCents: number; email: string; userId: string | null },
): PromoEvaluation {
  const code = input.code.trim().toUpperCase();
  const row = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code) as PromoRow | undefined;
  if (!row) throw new ApiError(422, 'promo_invalid', "Ce code promotionnel n'existe pas.");

  const now = nowIso();
  if (!row.active) throw new ApiError(422, 'promo_inactive', "Ce code promotionnel n'est plus actif.");
  if (row.starts_at && row.starts_at > now) {
    throw new ApiError(422, 'promo_not_started', "Ce code promotionnel n'est pas encore valable.");
  }
  if (row.ends_at && row.ends_at < now) {
    throw new ApiError(422, 'promo_expired', 'Ce code promotionnel a expiré.');
  }
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    throw new ApiError(422, 'promo_exhausted', "Ce code promotionnel a atteint sa limite d'utilisation.");
  }
  if (input.subtotalCents < row.min_subtotal_cents) {
    throw new ApiError(422, 'promo_min_subtotal', `Ce code nécessite un sous-total minimum de ${formatMoney(row.min_subtotal_cents)}.`);
  }
  if (row.max_uses_per_customer !== null) {
    const email = input.email.trim().toLowerCase();
    const usage = db
      .prepare(
        `SELECT COUNT(*) AS total FROM promo_redemptions
          WHERE promo_id = ? AND (lower(email) = ? ${input.userId ? 'OR user_id = ?' : ''})`,
      )
      .get(...([row.id, email, ...(input.userId ? [input.userId] : [])] as string[])) as { total: number } | undefined;
    if (Number(usage?.total ?? 0) >= row.max_uses_per_customer) {
      throw new ApiError(422, 'promo_customer_limit', 'Vous avez déjà utilisé ce code promotionnel.');
    }
  }

  const rawDiscount = row.type === 'percent' ? Math.floor((input.subtotalCents * row.value) / 10000) : row.value;
  const discountCents = Math.min(rawDiscount, input.subtotalCents);
  if (discountCents <= 0) throw new ApiError(422, 'promo_zero', 'Ce code ne génère aucune remise sur ce panier.');

  return { id: row.id, code: row.code, description: row.description, discountCents };
}
