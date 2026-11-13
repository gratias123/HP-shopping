import crypto from 'node:crypto';
import { Router } from 'express';
import { execute, queryAll, queryOne } from '../../db/index.js';
import { ApiError } from '../../lib/errors.js';
import { nowIso } from '../../lib/ids.js';
import {
  promoCodeSchema,
  settingsSchema,
  shippingMethodSchema,
  shippingZoneSchema,
} from '../../lib/validation.js';
import { requireAdmin, requirePermission } from '../../middleware/auth.js';
import { listPromoCodes } from '../../services/promos.js';
import { listZonesWithMethods } from '../../services/shipping.js';
import { getSettings, saveSettings } from '../../services/settings.js';
import { audit } from './helpers.js';

export const adminCommerceRouter = Router();

// --- Paramètres de la boutique ---------------------------------------------

adminCommerceRouter.get('/settings', requirePermission('settings:write'), (_req, res) => {
  res.json({ settings: getSettings() });
});

const LEGAL_DATE_KEYS = [
  'legalName',
  'legalForm',
  'legalRccm',
  'legalIfu',
  'legalVatNumber',
  'legalAddress',
  'legalPublisher',
  'legalComplaintAuthority',
  'hostName',
  'hostAddress',
  'hostPhone',
  'hostEmail',
  'contactEmail',
  'contactPhone',
  'storeAddress',
] as const;

adminCommerceRouter.put('/settings', requirePermission('settings:write'), (req, res) => {
  const input = settingsSchema.parse(req.body);
  const current = getSettings();
  const legalChanged = LEGAL_DATE_KEYS.some((key) => input[key] !== current[key]);
  const settings = saveSettings({
    ...input,
    // La date est calculée côté serveur : elle ne peut pas être antidatée depuis l’interface.
    legalUpdatedAt: legalChanged ? nowIso() : current.legalUpdatedAt,
  });
  audit(req.user!.id, 'settings.update', 'settings', null, { keys: Object.keys(input) });
  res.json({ settings });
});

// --- Codes promotionnels ----------------------------------------------------

adminCommerceRouter.get('/promos', requirePermission('promos:write'), (_req, res) => {
  res.json({ promos: listPromoCodes() });
});

function validatePromo(input: ReturnType<typeof promoCodeSchema.parse>): void {
  if (input.type === 'percent' && input.value > 10000) {
    throw new ApiError(422, 'invalid_promo_value', 'Une remise en pourcentage ne peut pas dépasser 100 %.');
  }
  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    throw new ApiError(422, 'invalid_promo_window', 'La date de fin doit être postérieure à la date de début.');
  }
}

adminCommerceRouter.post('/promos', requirePermission('promos:write'), (req, res) => {
  const input = promoCodeSchema.parse(req.body);
  validatePromo(input);
  if (queryOne('SELECT 1 FROM promo_codes WHERE code = ?', [input.code])) {
    throw new ApiError(409, 'promo_exists', 'Un code promotionnel identique existe déjà.');
  }
  execute(
    `INSERT INTO promo_codes (id, code, description, type, value, min_subtotal_cents, starts_at, ends_at, max_uses,
      max_uses_per_customer, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.code,
      input.description,
      input.type,
      input.value,
      input.minSubtotalCents,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.maxUses ?? null,
      input.maxUsesPerCustomer ?? null,
      input.active ? 1 : 0,
      nowIso(),
      nowIso(),
    ],
  );
  audit(req.user!.id, 'promo.create', 'promo', input.code, {});
  res.status(201).json({ promos: listPromoCodes() });
});

adminCommerceRouter.put('/promos/:id', requirePermission('promos:write'), (req, res) => {
  const id = String(req.params.id);
  const input = promoCodeSchema.parse(req.body);
  validatePromo(input);
  const exists = queryOne<{ id: string }>('SELECT id FROM promo_codes WHERE id = ?', [id]);
  if (!exists) throw ApiError.notFound('Code promotionnel introuvable.');
  const owner = queryOne<{ id: string }>('SELECT id FROM promo_codes WHERE code = ?', [input.code]);
  if (owner && owner.id !== id) throw new ApiError(409, 'promo_exists', 'Un code promotionnel identique existe déjà.');
  execute(
    `UPDATE promo_codes SET code = ?, description = ?, type = ?, value = ?, min_subtotal_cents = ?, starts_at = ?,
      ends_at = ?, max_uses = ?, max_uses_per_customer = ?, active = ?, updated_at = ? WHERE id = ?`,
    [
      input.code,
      input.description,
      input.type,
      input.value,
      input.minSubtotalCents,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.maxUses ?? null,
      input.maxUsesPerCustomer ?? null,
      input.active ? 1 : 0,
      nowIso(),
      id,
    ],
  );
  audit(req.user!.id, 'promo.update', 'promo', id, {});
  res.json({ promos: listPromoCodes() });
});

adminCommerceRouter.delete('/promos/:id', requirePermission('promos:write'), (req, res) => {
  const id = String(req.params.id);
  const updated = execute('UPDATE promo_codes SET active = 0, updated_at = ? WHERE id = ?', [nowIso(), id]);
  if (updated.changes !== 1) throw ApiError.notFound('Code promotionnel introuvable.');
  audit(req.user!.id, 'promo.deactivate', 'promo', id, {});
  res.json({ promos: listPromoCodes() });
});

// --- Livraison --------------------------------------------------------------

adminCommerceRouter.get('/shipping', requirePermission('shipping:write'), (_req, res) => {
  res.json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.post('/shipping/zones', requirePermission('shipping:write'), (req, res) => {
  const input = shippingZoneSchema.parse(req.body);
  const countries = [...new Set(input.countries.map((code) => code.trim().toUpperCase()))].join(',');
  execute(
    'INSERT INTO shipping_zones (id, name, countries, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), input.name, countries, input.active ? 1 : 0, input.sortOrder, nowIso(), nowIso()],
  );
  audit(req.user!.id, 'shipping.zone.create', 'shipping_zone', null, { name: input.name });
  res.status(201).json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.put('/shipping/zones/:id', requirePermission('shipping:write'), (req, res) => {
  const id = String(req.params.id);
  const input = shippingZoneSchema.parse(req.body);
  const countries = [...new Set(input.countries.map((code) => code.trim().toUpperCase()))].join(',');
  const updated = execute(
    'UPDATE shipping_zones SET name = ?, countries = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    [input.name, countries, input.active ? 1 : 0, input.sortOrder, nowIso(), id],
  );
  if (updated.changes !== 1) throw ApiError.notFound('Zone de livraison introuvable.');
  res.json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.delete('/shipping/zones/:id', requirePermission('shipping:write'), (req, res) => {
  const id = String(req.params.id);
  const updated = execute('DELETE FROM shipping_zones WHERE id = ?', [id]);
  if (updated.changes !== 1) throw ApiError.notFound('Zone de livraison introuvable.');
  audit(req.user!.id, 'shipping.zone.delete', 'shipping_zone', id, {});
  res.json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.post('/shipping/methods', requirePermission('shipping:write'), (req, res) => {
  const input = shippingMethodSchema.parse(req.body);
  const zone = queryOne<{ id: string }>('SELECT id FROM shipping_zones WHERE id = ?', [input.zoneId]);
  if (!zone) throw new ApiError(422, 'zone_missing', 'Zone de livraison introuvable.');
  if (input.minDays != null && input.maxDays != null && input.minDays > input.maxDays) {
    throw new ApiError(422, 'invalid_delay', 'Le délai minimum doit être inférieur ou égal au délai maximum.');
  }
  execute(
    `INSERT INTO shipping_methods (id, zone_id, name, description, price_cents, free_over_cents, min_days, max_days, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.zoneId,
      input.name,
      input.description,
      input.priceCents,
      input.freeOverCents ?? null,
      input.minDays ?? null,
      input.maxDays ?? null,
      input.active ? 1 : 0,
      input.sortOrder,
      nowIso(),
      nowIso(),
    ],
  );
  audit(req.user!.id, 'shipping.method.create', 'shipping_method', null, { name: input.name });
  res.status(201).json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.put('/shipping/methods/:id', requirePermission('shipping:write'), (req, res) => {
  const id = String(req.params.id);
  const input = shippingMethodSchema.parse(req.body);
  if (input.minDays != null && input.maxDays != null && input.minDays > input.maxDays) {
    throw new ApiError(422, 'invalid_delay', 'Le délai minimum doit être inférieur ou égal au délai maximum.');
  }
  const updated = execute(
    `UPDATE shipping_methods SET zone_id = ?, name = ?, description = ?, price_cents = ?, free_over_cents = ?,
      min_days = ?, max_days = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
    [
      input.zoneId,
      input.name,
      input.description,
      input.priceCents,
      input.freeOverCents ?? null,
      input.minDays ?? null,
      input.maxDays ?? null,
      input.active ? 1 : 0,
      input.sortOrder,
      nowIso(),
      id,
    ],
  );
  if (updated.changes !== 1) throw ApiError.notFound('Mode de livraison introuvable.');
  res.json({ zones: listZonesWithMethods() });
});

adminCommerceRouter.delete('/shipping/methods/:id', requirePermission('shipping:write'), (req, res) => {
  const id = String(req.params.id);
  const updated = execute('DELETE FROM shipping_methods WHERE id = ?', [id]);
  if (updated.changes !== 1) throw ApiError.notFound('Mode de livraison introuvable.');
  res.json({ zones: listZonesWithMethods() });
});

// --- Messages de contact ----------------------------------------------------

adminCommerceRouter.get('/messages', requirePermission('messages:read'), (_req, res) => {
  const messages = queryAll<Record<string, unknown>>(
    'SELECT * FROM contact_messages ORDER BY CASE status WHEN \'new\' THEN 0 ELSE 1 END, created_at DESC LIMIT 200',
  ).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    subject: String(row.subject),
    message: String(row.message),
    status: String(row.status),
    createdAt: String(row.created_at),
  }));
  res.json({ messages });
});

adminCommerceRouter.patch('/messages/:id', requirePermission('messages:read'), (req, res) => {
  const id = String(req.params.id);
  const status = String(req.body?.status ?? '');
  if (!['new', 'read', 'archived'].includes(status)) throw ApiError.badRequest('Statut invalide.');
  const updated = execute('UPDATE contact_messages SET status = ? WHERE id = ?', [status, id]);
  if (updated.changes !== 1) throw ApiError.notFound('Message introuvable.');
  res.json({ ok: true });
});

// --- Comptes et rôles (administrateurs uniquement) --------------------------

adminCommerceRouter.get('/users', requirePermission('users:read'), (_req, res) => {
  const users = queryAll<Record<string, unknown>>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role_slug, u.status, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
  ).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    phone: String(row.phone ?? ''),
    role: String(row.role_slug),
    status: String(row.status),
    orderCount: Number(row.order_count ?? 0),
    createdAt: String(row.created_at),
  }));
  res.json({ users });
});

adminCommerceRouter.patch('/users/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const role = req.body?.role;
  const status = req.body?.status;
  const target = queryOne<{ id: string; role_slug: string }>('SELECT id, role_slug FROM users WHERE id = ?', [id]);
  if (!target) throw ApiError.notFound('Utilisateur introuvable.');

  if (role !== undefined) {
    if (!['customer', 'staff', 'admin'].includes(String(role))) throw ApiError.badRequest('Rôle invalide.');
    if (id === req.user!.id) {
      throw new ApiError(409, 'self_role', 'Vous ne pouvez pas modifier votre propre rôle.');
    }
    if (target.role_slug === 'admin' && role !== 'admin') {
      const admins = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role_slug = 'admin' AND status = 'active'");
      if (Number(admins?.total ?? 0) <= 1) {
        throw new ApiError(409, 'last_admin', 'Impossible de retirer le dernier administrateur actif.');
      }
    }
    execute('UPDATE users SET role_slug = ?, updated_at = ? WHERE id = ?', [String(role), nowIso(), id]);
    execute('DELETE FROM sessions WHERE user_id = ?', [id]);
    audit(req.user!.id, 'user.role', 'user', id, { role });
  }
  if (status !== undefined) {
    if (!['active', 'disabled'].includes(String(status))) throw ApiError.badRequest('Statut invalide.');
    if (id === req.user!.id && status === 'disabled') {
      throw ApiError.badRequest('Vous ne pouvez pas désactiver votre propre compte.');
    }
    execute('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [String(status), nowIso(), id]);
    if (status === 'disabled') execute('DELETE FROM sessions WHERE user_id = ?', [id]);
    audit(req.user!.id, 'user.status', 'user', id, { status });
  }
  res.json({ ok: true });
});
