import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { getDb, queryAll, queryOne, transaction, type SqlPrimitive } from '../db/index.js';
import { checkVariantStock, notifyOrderCreated, notifyOrderStatusChanged } from './notifications.js';
import { formatMoney } from '../lib/money.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso, orderReference } from '../lib/ids.js';
import { getSettings } from './settings.js';
import { evaluatePromo } from './promos.js';
import { resolveShipping } from './shipping.js';
import { recordStockMovement } from './inventory.js';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cod' | 'mobile_money';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

/** Transitions autorisées — toute autre transition est refusée côté serveur. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

interface LineRow {
  variant_id: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  is_active: number;
  product_id: string;
  name: string;
  reference: string;
  slug: string;
  status: string;
  effective_price_cents: number;
  category_published: number;
  image_url: string | null;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  reference: string;
  size: string;
  color: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  availableStock: number;
}

export interface Quote {
  lines: QuoteLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number | null;
  totalCents: number | null;
  promo: { code: string; description: string; discountCents: number } | null;
  shipping: { methodId: string; label: string; priceCents: number } | null;
  currency: string;
}

function mergeItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  return [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

function loadLines(db: DatabaseSync, items: CartItemInput[]): QuoteLine[] {
  const merged = mergeItems(items);
  if (!merged.length) throw new ApiError(422, 'cart_empty', 'Votre panier est vide.');
  const placeholders = merged.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT v.id AS variant_id, v.size, v.color, v.sku, v.stock, v.is_active,
              p.id AS product_id, p.name, p.reference, p.slug, p.status,
              (CASE WHEN p.sale_price_cents IS NOT NULL
                 AND (p.sale_starts_at IS NULL OR p.sale_starts_at <= ?)
                 AND (p.sale_ends_at IS NULL OR p.sale_ends_at >= ?)
                THEN p.sale_price_cents ELSE p.price_cents END) AS effective_price_cents,
              c.published AS category_published,
              (SELECT i.url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.created_at LIMIT 1) AS image_url
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         JOIN categories c ON c.id = p.category_id
        WHERE v.id IN (${placeholders})`,
    )
    .all(...([nowIso(), nowIso(), ...merged.map((item) => item.variantId)] as string[])) as unknown as LineRow[];

  if (rows.length !== merged.length) {
    throw new ApiError(422, 'variant_missing', "Un article de votre panier n'est plus disponible.", {});
  }

  return merged.map((item) => {
    const row = rows.find((candidate) => candidate.variant_id === item.variantId);
    if (!row) throw new ApiError(422, 'variant_missing', "Un article de votre panier n'est plus disponible.");
    if (row.status !== 'published' || Number(row.category_published) !== 1) {
      throw new ApiError(422, 'product_unavailable', `« ${row.name} » n'est plus disponible à la vente.`);
    }
    if (Number(row.is_active) !== 1) {
      throw new ApiError(422, 'variant_unavailable', `La variante ${row.size} / ${row.color} n'est plus proposée.`);
    }
    if (item.quantity > row.stock) {
      throw new ApiError(422, 'insufficient_stock', `Stock insuffisant pour « ${row.name} » (${row.size} / ${row.color}).`, {
        variantId: row.variant_id,
        available: row.stock,
      });
    }
    return {
      variantId: row.variant_id,
      productId: row.product_id,
      slug: row.slug,
      name: row.name,
      reference: row.reference,
      size: row.size,
      color: row.color,
      sku: row.sku,
      imageUrl: row.image_url,
      unitPriceCents: Number(row.effective_price_cents),
      quantity: item.quantity,
      lineTotalCents: Number(row.effective_price_cents) * item.quantity,
      availableStock: row.stock,
    };
  });
}

export function quoteCart(input: {
  items: CartItemInput[];
  promoCode?: string;
  shippingMethodId?: string | null;
  country?: string;
  email?: string;
  userId?: string | null;
}): Quote {
  const db = getDb();
  const lines = loadLines(db, input.items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const promo = input.promoCode?.trim()
    ? evaluatePromo(db, {
        code: input.promoCode,
        subtotalCents,
        email: input.email ?? '',
        userId: input.userId ?? null,
      })
    : null;
  const discountCents = promo?.discountCents ?? 0;
  const netSubtotal = subtotalCents - discountCents;

  let shipping: Quote['shipping'] = null;
  if (input.shippingMethodId) {
    const resolved = resolveShipping(input.shippingMethodId, input.country ?? config.defaultCountry, netSubtotal);
    shipping = { methodId: resolved.methodId, label: resolved.label, priceCents: resolved.priceCents };
  }

  const shippingCents = shipping ? shipping.priceCents : null;
  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: shippingCents === null ? null : netSubtotal + shippingCents,
    promo: promo ? { code: promo.code, description: promo.description, discountCents: promo.discountCents } : null,
    shipping,
    currency: config.currency,
  };
}

export interface CreateOrderInput {
  items: CartItemInput[];
  promoCode?: string;
  shippingMethodId: string;
  country: string;
  paymentMethod: PaymentMethod;
  email: string;
  userId: string | null;
  address: {
    firstName: string;
    lastName: string;
    line1: string;
    line2: string;
    postalCode: string;
    city: string;
    country: string;
    phone: string;
  };
  customerNote?: string;
}

export interface OrderDto {
  id: string;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  allowedTransitions: OrderStatus[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  promoCode: string | null;
  email: string;
  phone: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  shippingMethodLabel: string;
  customerNote: string;
  internalNote?: string;
  stockReleased: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  items: Array<{
    id: string;
    productName: string;
    productReference: string;
    variantSize: string;
    variantColor: string;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
    productSlug?: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string;
    actorLabel: string;
    createdAt: string;
  }>;
  payments: Array<{ id: string; provider: string; status: string; amountCents: number; createdAt: string }>;
}

export function createOrder(input: CreateOrderInput): OrderDto {
  const settings = getSettings();
  if (input.paymentMethod === 'cod' && !settings.codEnabled) {
    throw new ApiError(422, 'payment_unavailable', 'Le paiement à la livraison est actuellement désactivé.');
  }
  if (input.paymentMethod === 'mobile_money') {
    throw new ApiError(
      503,
      'payment_not_configured',
      "Le paiement Mobile Money n'est pas encore configuré. Choisissez le paiement à la réception ou contactez-nous.",
    );
  }

  const orderId = newId();
  return transaction((db) => {
    const lines = loadLines(db, input.items);
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

    const promo = input.promoCode?.trim()
      ? evaluatePromo(db, { code: input.promoCode, subtotalCents, email: input.email, userId: input.userId })
      : null;
    const discountCents = promo?.discountCents ?? 0;
    const netSubtotal = subtotalCents - discountCents;

    const shipping = resolveShipping(input.shippingMethodId, input.country, netSubtotal);
    const totalCents = netSubtotal + shipping.priceCents;
    if (totalCents < 0) throw ApiError.badRequest('Montant de commande invalide.');

    let reference = orderReference();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const exists = db.prepare('SELECT 1 FROM orders WHERE reference = ?').get(reference);
      if (!exists) break;
      reference = orderReference();
    }

    const now = nowIso();
    db.prepare(
      `INSERT INTO orders (
        id, reference, user_id, email, phone, status, payment_method, payment_status,
        subtotal_cents, discount_cents, shipping_cents, total_cents, currency, promo_code, promo_id,
        shipping_first_name, shipping_last_name, shipping_line1, shipping_line2, shipping_postal_code,
        shipping_city, shipping_country, shipping_zone_id, shipping_method_id, shipping_method_label,
        customer_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      orderId,
      reference,
      input.userId,
      input.email.trim().toLowerCase(),
      input.address.phone,
      input.paymentMethod,
      subtotalCents,
      discountCents,
      shipping.priceCents,
      totalCents,
      config.currency,
      promo?.code ?? null,
      promo?.id ?? null,
      input.address.firstName,
      input.address.lastName,
      input.address.line1,
      input.address.line2,
      input.address.postalCode,
      input.address.city,
      input.address.country.toUpperCase(),
      shipping.zoneId,
      shipping.methodId,
      shipping.label,
      input.customerNote ?? '',
      now,
      now,
    );

    for (const line of lines) {
      const updated = db
        .prepare('UPDATE product_variants SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ? AND is_active = 1')
        .run(line.quantity, now, line.variantId, line.quantity);
      if (Number(updated.changes) !== 1) {
        throw new ApiError(409, 'stock_conflict', `« ${line.name} » vient d'être vendu. Votre panier a été actualisé, vérifiez les quantités.`, {
          variantId: line.variantId,
        });
      }
      recordStockMovement(db, {
        productId: line.productId,
        variantId: line.variantId,
        sku: line.sku,
        size: line.size,
        color: line.color,
        delta: -line.quantity,
        stockBefore: line.availableStock,
        stockAfter: line.availableStock - line.quantity,
        reason: 'order',
        reference,
        note: `Commande ${reference}`,
        actorLabel: 'Boutique',
      });
      checkVariantStock(line.variantId);
      db.prepare(
        `INSERT INTO order_items (
          id, order_id, product_id, variant_id, product_name, product_reference,
          variant_size, variant_color, image_url, unit_price_cents, quantity, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        orderId,
        line.productId,
        line.variantId,
        line.name,
        line.reference,
        line.size,
        line.color,
        line.imageUrl,
        line.unitPriceCents,
        line.quantity,
        line.lineTotalCents,
      );
    }

    db.prepare(
      `INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor_label, created_at)
       VALUES (?, ?, NULL, 'pending', 'Commande enregistrée', 'Boutique', ?)`,
    ).run(newId(), orderId, now);

    db.prepare(
      `INSERT INTO payments (id, order_id, provider, provider_reference, amount_cents, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?, ?)`,
    ).run(newId(), orderId, input.paymentMethod === 'cod' ? 'cash_on_delivery' : 'mobile_money', totalCents, config.currency, now, now);

    if (promo) {
      db.prepare('UPDATE promo_codes SET used_count = used_count + 1, updated_at = ? WHERE id = ?').run(now, promo.id);
      db.prepare(
        'INSERT INTO promo_redemptions (id, promo_id, order_id, user_id, email, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(newId(), promo.id, orderId, input.userId, input.email.toLowerCase(), now);
    }

    const created = readOrder(db, orderId);
    if (!created) throw new Error('Commande créée mais introuvable.');
    notifyOrderCreated({
      id: orderId,
      reference,
      userId: input.userId ?? null,
      totalLabel: formatMoney(totalCents, config.currency),
    });
    return created;
  });
}

function readOrder(db: DatabaseSync, orderId: string): OrderDto | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return hydrate(db, row);
}

function hydrate(db: DatabaseSync, row: Record<string, unknown>, includeInternal = false): OrderDto {
  const items = (
    db
      .prepare(
        `SELECT oi.*, p.slug AS product_slug FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.rowid`,
      )
      .all(String(row.id)) as Array<Record<string, unknown>>
  ).map((item) => ({
    id: String(item.id),
    productName: String(item.product_name),
    productReference: String(item.product_reference),
    variantSize: String(item.variant_size ?? ''),
    variantColor: String(item.variant_color ?? ''),
    imageUrl: (item.image_url as string | null) ?? null,
    unitPriceCents: Number(item.unit_price_cents),
    quantity: Number(item.quantity),
    lineTotalCents: Number(item.line_total_cents),
    ...(item.product_slug ? { productSlug: String(item.product_slug) } : {}),
  }));

  const history = (
    db
      .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at, rowid')
      .all(String(row.id)) as Array<Record<string, unknown>>
  ).map((entry) => ({
    id: String(entry.id),
    fromStatus: (entry.from_status as OrderStatus | null) ?? null,
    toStatus: entry.to_status as OrderStatus,
    note: String(entry.note ?? ''),
    actorLabel: String(entry.actor_label ?? ''),
    createdAt: String(entry.created_at),
  }));

  const payments = (
    db
      .prepare('SELECT id, provider, status, amount_cents, created_at FROM payments WHERE order_id = ? ORDER BY created_at')
      .all(String(row.id)) as Array<Record<string, unknown>>
  ).map((payment) => ({
    id: String(payment.id),
    provider: String(payment.provider),
    status: String(payment.status),
    amountCents: Number(payment.amount_cents),
    createdAt: String(payment.created_at),
  }));

  const status = row.status as OrderStatus;
  return {
    id: String(row.id),
    reference: String(row.reference),
    status,
    statusLabel: ORDER_STATUS_LABELS[status] ?? status,
    allowedTransitions: ORDER_TRANSITIONS[status] ?? [],
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    subtotalCents: Number(row.subtotal_cents),
    discountCents: Number(row.discount_cents),
    shippingCents: Number(row.shipping_cents),
    totalCents: Number(row.total_cents),
    currency: String(row.currency),
    promoCode: (row.promo_code as string | null) ?? null,
    email: String(row.email),
    phone: String(row.phone ?? ''),
    shippingFirstName: String(row.shipping_first_name),
    shippingLastName: String(row.shipping_last_name),
    shippingLine1: String(row.shipping_line1),
    shippingLine2: String(row.shipping_line2 ?? ''),
    shippingPostalCode: String(row.shipping_postal_code),
    shippingCity: String(row.shipping_city),
    shippingCountry: String(row.shipping_country),
    shippingMethodLabel: String(row.shipping_method_label ?? ''),
    customerNote: String(row.customer_note ?? ''),
    ...(includeInternal ? { internalNote: String(row.internal_note ?? '') } : {}),
    stockReleased: Number(row.stock_released) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    userId: (row.user_id as string | null) ?? null,
    items,
    history,
    payments,
  };
}

export function getOrderForUser(orderId: string, userId: string): OrderDto | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
  return row ? hydrate(getDb(), row) : null;
}

export function getOrderByReference(reference: string, email: string): OrderDto | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE reference = ? AND lower(email) = ?', [
    reference.trim().toUpperCase(),
    email.trim().toLowerCase(),
  ]);
  return row ? hydrate(getDb(), row) : null;
}

export function listOrdersForUser(userId: string): OrderDto[] {
  return queryAll<Record<string, unknown>>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]).map(
    (row) => hydrate(getDb(), row),
  );
}

export interface AdminOrderFilters {
  status?: OrderStatus;
  q?: string;
  page?: number;
  perPage?: number;
}

export function adminListOrders(filters: AdminOrderFilters = {}) {
  const where: string[] = [];
  const params: SqlPrimitive[] = [];
  if (filters.status) {
    where.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      `(o.reference LIKE ? ESCAPE '\\' OR o.email LIKE ? ESCAPE '\\' OR o.shipping_last_name LIKE ? ESCAPE '\\' OR o.shipping_first_name LIKE ? ESCAPE '\\')`,
    );
    params.push(term, term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const perPage = Math.min(Math.max(filters.perPage ?? 20, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const total = Number(
    (queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM orders o ${whereSql}`, params)?.total ?? 0) as number,
  );
  const rows = queryAll<Record<string, unknown>>(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o ${whereSql}
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      email: String(row.email),
      customerName: `${row.shipping_first_name} ${row.shipping_last_name}`.trim(),
      status: row.status as OrderStatus,
      statusLabel: ORDER_STATUS_LABELS[row.status as OrderStatus],
      paymentStatus: String(row.payment_status),
      totalCents: Number(row.total_cents),
      itemCount: Number(row.item_count),
      createdAt: String(row.created_at),
    })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export function adminGetOrder(orderId: string): OrderDto | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ?', [orderId]);
  return row ? hydrate(getDb(), row, true) : null;
}

export function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  note: string,
  actor: { id: string | null; label: string },
): OrderDto {
  return transaction((db) => {
    const row = db.prepare('SELECT status, reference, user_id FROM orders WHERE id = ?').get(orderId) as
      | { status: OrderStatus; reference: string; user_id: string | null }
      | undefined;
    if (!row) throw ApiError.notFound('Commande introuvable.');
    const current = row.status;
    if (current === nextStatus) {
      throw new ApiError(409, 'status_unchanged', 'La commande est déjà à ce statut.');
    }
    if (!ORDER_TRANSITIONS[current]?.includes(nextStatus)) {
      throw new ApiError(
        409,
        'invalid_transition',
        `Transition impossible : ${ORDER_STATUS_LABELS[current]} → ${ORDER_STATUS_LABELS[nextStatus]}.`,
      );
    }

    const now = nowIso();
    const paymentStatus =
      nextStatus === 'refunded' ? 'refunded' : nextStatus === 'delivered' ? 'paid' : undefined;

    const updated = db
      .prepare(
        `UPDATE orders SET status = ?, updated_at = ?${paymentStatus ? ', payment_status = ?' : ''}
          WHERE id = ? AND status = ?`,
      )
      .run(...([...(paymentStatus ? [nextStatus, now, paymentStatus] : [nextStatus, now]), orderId, current] as string[]));
    if (Number(updated.changes) !== 1) {
      throw new ApiError(409, 'order_locked', 'Cette commande a été modifiée entre-temps. Rechargez la page.');
    }

    if (nextStatus === 'cancelled') {
      const order = db.prepare('SELECT reference, stock_released FROM orders WHERE id = ?').get(orderId) as {
        reference: string;
        stock_released: number;
      };
      if (Number(order.stock_released) !== 1) {
        const items = db
          .prepare(
            `SELECT oi.variant_id, oi.quantity, oi.product_id, oi.variant_size, oi.variant_color,
                    v.sku, v.stock
               FROM order_items oi
               JOIN product_variants v ON v.id = oi.variant_id
              WHERE oi.order_id = ? AND oi.variant_id IS NOT NULL`,
          )
          .all(orderId) as Array<{
          variant_id: string;
          quantity: number;
          product_id: string;
          variant_size: string;
          variant_color: string;
          sku: string;
          stock: number;
        }>;
        for (const item of items) {
          db.prepare('UPDATE product_variants SET stock = stock + ?, updated_at = ? WHERE id = ?').run(item.quantity, now, item.variant_id);
          recordStockMovement(db, {
            productId: item.product_id,
            variantId: item.variant_id,
            sku: item.sku,
            size: item.variant_size,
            color: item.variant_color,
            delta: item.quantity,
            stockBefore: Number(item.stock),
            stockAfter: Number(item.stock) + item.quantity,
            reason: 'cancellation',
            reference: order.reference,
            note: `Annulation de la commande ${order.reference}`,
            actorLabel: actor.label,
          });
        }
        db.prepare('UPDATE orders SET stock_released = 1 WHERE id = ?').run(orderId);
      }
    }

    if (paymentStatus) {
      db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE order_id = ?').run(paymentStatus, now, orderId);
    }

    db.prepare(
      `INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor_user_id, actor_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), orderId, current, nextStatus, note, actor.id, actor.label, now);

    db.prepare('INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      actor.id,
      'order.status.update',
      'order',
      orderId,
      JSON.stringify({ from: current, to: nextStatus, note }),
      now,
    );

    notifyOrderStatusChanged({ id: orderId, reference: row.reference, userId: row.user_id }, nextStatus, actor.id);

    const updatedRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
    return hydrate(db, updatedRow, true);
  });
}

export function dashboardStats() {
  const relevant = `status NOT IN ('cancelled', 'refunded')`;
  const revenue = queryOne<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total_cents), 0) AS total, COUNT(*) AS count FROM orders WHERE ${relevant}`,
  );
  const revenue30 = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders
      WHERE ${relevant} AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')`,
  );
  const byStatus = queryAll<{ status: string; total: number }>(
    'SELECT status, COUNT(*) AS total FROM orders GROUP BY status',
  );
  const recent = adminListOrders({ perPage: 6 }).items;
  const topProducts = queryAll<Record<string, unknown>>(
    `SELECT oi.product_name AS name, oi.product_reference AS reference, SUM(oi.quantity) AS units,
            SUM(oi.line_total_cents) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled', 'refunded')
      GROUP BY oi.product_name, oi.product_reference
      ORDER BY units DESC LIMIT 5`,
  ).map((row) => ({
    name: String(row.name),
    reference: String(row.reference),
    units: Number(row.units),
    revenueCents: Number(row.revenue),
  }));
  const threshold = config.lowStockThreshold;
  const lowStock = queryAll<Record<string, unknown>>(
    `SELECT v.id, v.sku, v.size, v.color, v.stock, p.name AS product_name, p.id AS product_id, p.slug,
            COALESCE(p.low_stock_alert, ?) AS threshold
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.status != 'archived' AND v.is_active = 1 AND v.stock <= COALESCE(p.low_stock_alert, ?)
      ORDER BY v.stock ASC, p.name ASC LIMIT 10`,
    [threshold, threshold],
  ).map((row) => ({
    id: String(row.id),
    sku: String(row.sku),
    size: String(row.size),
    color: String(row.color),
    stock: Number(row.stock),
    productName: String(row.product_name),
    productId: String(row.product_id),
    productSlug: String(row.slug),
    threshold: Number(row.threshold),
  }));
  const customers = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role_slug = 'customer'");
  const messages = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM contact_messages WHERE status = 'new'");
  const lowStockTotal = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.status != 'archived' AND v.is_active = 1 AND v.stock <= COALESCE(p.low_stock_alert, ?)`,
    [threshold],
  );
  const statusCounts: Record<string, number> = {};
  for (const entry of byStatus) statusCounts[entry.status] = Number(entry.total);

  return {
    revenueCents: Number(revenue?.total ?? 0),
    orderCount: Number(revenue?.count ?? 0),
    revenue30dCents: Number(revenue30?.total ?? 0),
    statusCounts,
    recentOrders: recent,
    topProducts,
    lowStock,
    lowStockTotal: Number(lowStockTotal?.total ?? 0),
    customerCount: Number(customers?.total ?? 0),
    newMessages: Number(messages?.total ?? 0),
    currency: config.currency,
  };
}
