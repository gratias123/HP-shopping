/**
 * Notifications internes.
 *
 * Toutes les notifications sont créées par de vrais événements applicatifs
 * (commande, changement de statut, inscription, message de contact, stock).
 * Elles sont écrites dans la même transaction que l'événement lorsqu'il y en a
 * une : si l'événement est annulé, la notification l'est aussi.
 *
 * Évolution prévue : les canaux externes (push, WhatsApp Business) s'ajoutent
 * avec `registerNotificationChannel` sans toucher aux appelants.
 */
import { getDb, queryAll, queryOne } from '../db/index.js';
import { config } from '../config.js';
import { newId, nowIso } from '../lib/ids.js';

export type NotificationType =
  | 'order_confirmation'
  | 'order_status'
  | 'order_new'
  | 'order_updated'
  | 'customer_new'
  | 'request_new'
  | 'stock_low'
  | 'stock_out';

export interface NewNotification {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  entity?: string;
  entityId?: string;
  dedupeKey?: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  entity: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/** Canal de diffusion supplémentaire (push, WhatsApp…). Le canal « application » est la base. */
export interface NotificationChannel {
  name: string;
  deliver(userId: string, notification: NewNotification): void;
}

const channels: NotificationChannel[] = [];

export function registerNotificationChannel(channel: NotificationChannel): void {
  if (!channels.some((existing) => existing.name === channel.name)) channels.push(channel);
}

function dispatchToChannels(userId: string, notification: NewNotification): void {
  for (const channel of channels) {
    try {
      channel.deliver(userId, notification);
    } catch (error) {
      console.error(`[notifications] canal ${channel.name} en échec :`, (error as Error).message);
    }
  }
}

export function notifyUser(userId: string, notification: NewNotification): void {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, link, entity, entity_id, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      userId,
      notification.type,
      notification.title,
      notification.body ?? '',
      notification.link ?? null,
      notification.entity ?? null,
      notification.entityId ?? null,
      notification.dedupeKey ?? null,
      nowIso(),
    );
  if (Number(result.changes) === 1) dispatchToChannels(userId, notification);
}

export function staffUserIds(): string[] {
  return queryAll<{ id: string }>("SELECT id FROM users WHERE role_slug IN ('admin', 'staff') AND status = 'active'").map(
    (row) => row.id,
  );
}

export function notifyStaff(notification: NewNotification, options: { exceptUserId?: string | null } = {}): void {
  for (const userId of staffUserIds()) {
    if (options.exceptUserId && userId === options.exceptUserId) continue;
    notifyUser(userId, notification);
  }
}

// ---------------------------------------------------------------------------
// Événements de commande
// ---------------------------------------------------------------------------

const CUSTOMER_STATUS_MESSAGES: Record<string, { title: string; body: (reference: string) => string }> = {
  confirmed: {
    title: 'Commande confirmée',
    body: (reference) => `Votre commande ${reference} a été confirmée par la boutique.`,
  },
  preparing: {
    title: 'Commande en préparation',
    body: (reference) => `Votre commande ${reference} est en cours de préparation.`,
  },
  shipped: {
    title: 'Commande expédiée',
    body: (reference) => `Votre commande ${reference} a été expédiée.`,
  },
  delivered: {
    title: 'Commande livrée',
    body: (reference) => `Votre commande ${reference} a été livrée. Merci pour votre confiance.`,
  },
  cancelled: {
    title: 'Commande annulée',
    body: (reference) => `Votre commande ${reference} a été annulée.`,
  },
  refunded: {
    title: 'Commande remboursée',
    body: (reference) => `Votre commande ${reference} a été marquée comme remboursée.`,
  },
};

export function notifyOrderCreated(order: { id: string; reference: string; userId: string | null; totalLabel: string }): void {
  if (order.userId) {
    notifyUser(order.userId, {
      type: 'order_confirmation',
      title: 'Commande enregistrée',
      body: `Nous avons bien reçu votre commande ${order.reference} (${order.totalLabel}).`,
      link: `/compte/commandes/${order.id}`,
      entity: 'order',
      entityId: order.id,
    });
  }
  notifyStaff({
    type: 'order_new',
    title: 'Nouvelle commande',
    body: `Commande ${order.reference} — ${order.totalLabel}.`,
    link: `/admin/commandes/${order.id}`,
    entity: 'order',
    entityId: order.id,
  });
}

export function notifyOrderStatusChanged(
  order: { id: string; reference: string; userId: string | null },
  nextStatus: string,
  actorUserId: string | null,
): void {
  const message = CUSTOMER_STATUS_MESSAGES[nextStatus];
  if (order.userId && message) {
    notifyUser(order.userId, {
      type: 'order_status',
      title: message.title,
      body: message.body(order.reference),
      link: `/compte/commandes/${order.id}`,
      entity: 'order',
      entityId: order.id,
    });
  }
  if (nextStatus === 'cancelled' || nextStatus === 'refunded') {
    notifyStaff(
      {
        type: 'order_updated',
        title: nextStatus === 'cancelled' ? 'Commande annulée' : 'Commande remboursée',
        body: `La commande ${order.reference} est passée au statut « ${nextStatus === 'cancelled' ? 'annulée' : 'remboursée'} ».`,
        link: `/admin/commandes/${order.id}`,
        entity: 'order',
        entityId: order.id,
      },
      { exceptUserId: actorUserId },
    );
  }
}

// ---------------------------------------------------------------------------
// Autres événements
// ---------------------------------------------------------------------------

export function notifyCustomerRegistered(user: { id: string; fullName: string; email: string }): void {
  notifyStaff({
    type: 'customer_new',
    title: 'Nouvelle inscription',
    body: `${user.fullName || user.email} vient de créer un compte client.`,
    link: '/admin/utilisateurs',
    entity: 'user',
    entityId: user.id,
  });
}

export function notifyContactRequest(message: { id: string; name: string; subject: string }): void {
  notifyStaff({
    type: 'request_new',
    title: 'Nouvelle demande client',
    body: `${message.name} : ${message.subject}`,
    link: '/admin/messages',
    entity: 'contact_message',
    entityId: message.id,
  });
}

/**
 * Vérifie le niveau de stock d'une variante après une vente ou un ajustement
 * et alerte le personnel (une seule alerte non lue par variante et par niveau).
 */
export function checkVariantStock(variantId: string): void {
  const row = queryOne<{
    stock: number;
    is_active: number;
    sku: string;
    size: string;
    color: string;
    product_id: string;
    product_name: string;
    status: string;
    threshold: number | null;
  }>(
    `SELECT v.stock, v.is_active, v.sku, v.size, v.color, p.id AS product_id, p.name AS product_name,
            p.status, p.low_stock_alert AS threshold
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE v.id = ?`,
    [variantId],
  );
  if (!row || row.status === 'archived' || Number(row.is_active) !== 1) return;
  const threshold = row.threshold ?? config.lowStockThreshold;
  const stock = Number(row.stock);
  const label = `${row.product_name} (${row.size} / ${row.color})`;
  if (stock <= 0) {
    notifyStaff({
      type: 'stock_out',
      title: 'Rupture de stock',
      body: `${label} est en rupture de stock.`,
      link: `/admin/produits/${row.product_id}`,
      entity: 'product',
      entityId: row.product_id,
      dedupeKey: `stock_out:${variantId}`,
    });
  } else if (stock <= threshold) {
    notifyStaff({
      type: 'stock_low',
      title: 'Stock faible',
      body: `${label} : il reste ${stock} article${stock > 1 ? 's' : ''}.`,
      link: `/admin/produits/${row.product_id}`,
      entity: 'product',
      entityId: row.product_id,
      dedupeKey: `stock_low:${variantId}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

function toDto(row: Record<string, unknown>): NotificationDto {
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    title: String(row.title),
    body: String(row.body ?? ''),
    link: (row.link as string | null) ?? null,
    entity: (row.entity as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    read: row.read_at !== null && row.read_at !== undefined,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function listNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}): NotificationDto[] {
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 30)));
  return queryAll<Record<string, unknown>>(
    `SELECT * FROM notifications WHERE user_id = ? ${options.unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    [userId, limit],
  ).map(toDto);
}

export function unreadCount(userId: string): number {
  const row = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return Number(row?.total ?? 0);
}

export function notificationBelongsTo(userId: string, id: string): boolean {
  return queryOne('SELECT 1 AS ok FROM notifications WHERE id = ? AND user_id = ?', [id, userId]) !== null;
}

export function markNotificationRead(userId: string, id: string): boolean {
  const result = getDb()
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL')
    .run(nowIso(), id, userId);
  return Number(result.changes) === 1;
}

export function markAllNotificationsRead(userId: string): number {
  const result = getDb().prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(nowIso(), userId);
  return Number(result.changes);
}
