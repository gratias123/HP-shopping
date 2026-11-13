import type { DatabaseSync } from 'node:sqlite';
import { queryAll } from '../db/index.js';
import { newId, nowIso } from '../lib/ids.js';

export type StockMovementReason = 'initial' | 'order' | 'cancellation' | 'adjustment' | 'restock' | 'return';

export interface NewStockMovement {
  productId: string;
  variantId: string | null;
  sku: string;
  size: string;
  color: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: StockMovementReason;
  reference?: string;
  note?: string;
  actorLabel?: string;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  variantId: string | null;
  sku: string;
  size: string;
  color: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: StockMovementReason;
  reference: string;
  note: string;
  actorLabel: string;
  createdAt: string;
}

export function recordStockMovement(db: DatabaseSync, input: NewStockMovement): void {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error('Un mouvement de stock doit avoir un delta entier non nul.');
  }
  if (input.stockBefore < 0 || input.stockAfter < 0) {
    throw new Error('Le stock ne peut pas devenir négatif.');
  }
  if (input.stockBefore + input.delta !== input.stockAfter) {
    throw new Error('Incohérence entre le stock avant, le delta et le stock après.');
  }
  db.prepare(
    `INSERT INTO stock_movements (
      id, product_id, variant_id, sku, size, color, delta, stock_before, stock_after,
      reason, reference, note, actor_label, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    input.productId,
    input.variantId,
    input.sku,
    input.size,
    input.color,
    input.delta,
    input.stockBefore,
    input.stockAfter,
    input.reason,
    input.reference ?? '',
    input.note ?? '',
    input.actorLabel ?? 'Système',
    nowIso(),
  );
}

export function listStockMovements(productId: string, limit = 100): StockMovementDto[] {
  const safeLimit = Math.min(300, Math.max(1, Math.trunc(limit)));
  return queryAll<Record<string, unknown>>(
    `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    [productId, safeLimit],
  ).map((row) => ({
    id: String(row.id),
    productId: String(row.product_id),
    variantId: (row.variant_id as string | null) ?? null,
    sku: String(row.sku ?? ''),
    size: String(row.size ?? ''),
    color: String(row.color ?? ''),
    delta: Number(row.delta),
    stockBefore: Number(row.stock_before),
    stockAfter: Number(row.stock_after),
    reason: row.reason as StockMovementReason,
    reference: String(row.reference ?? ''),
    note: String(row.note ?? ''),
    actorLabel: String(row.actor_label ?? ''),
    createdAt: String(row.created_at),
  }));
}
