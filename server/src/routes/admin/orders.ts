import { Router } from 'express';
import { execute } from '../../db/index.js';
import { ApiError } from '../../lib/errors.js';
import { nowIso } from '../../lib/ids.js';
import { orderStatusUpdateSchema } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';
import { ORDER_STATUS_LABELS, adminGetOrder, adminListOrders, updateOrderStatus, type OrderStatus } from '../../services/orders.js';
import { buildOrderReceipt } from '../../services/documents.js';
import { ordersCsv, buildSalesReportPdf } from '../../services/reports.js';
import { audit } from './helpers.js';

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/orders', requirePermission('orders:read'), (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? (req.query.status as OrderStatus) : undefined;
  if (status && !(status in ORDER_STATUS_LABELS)) throw ApiError.badRequest('Statut invalide.');
  const result = adminListOrders({
    status,
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : undefined,
    page: Number.parseInt(String(req.query.page ?? '1'), 10) || 1,
    perPage: Number.parseInt(String(req.query.perPage ?? '20'), 10) || 20,
  });
  res.json(result);
});

adminOrdersRouter.get('/reports/orders.csv', requirePermission('orders:read'), (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
  if (status && !(status in ORDER_STATUS_LABELS)) throw ApiError.badRequest('Statut invalide.');
  const csv = ordersCsv({
    status,
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : undefined,
  });
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hp-collection-commandes-${date}.csv"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(csv);
});

adminOrdersRouter.get('/reports/sales.pdf', requirePermission('orders:read'), (_req, res) => {
  const pdf = buildSalesReportPdf();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="hp-collection-rapport-${date}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

adminOrdersRouter.get('/orders/:id', requirePermission('orders:read'), (req, res) => {
  const order = adminGetOrder(String(req.params.id));
  if (!order) throw ApiError.notFound('Commande introuvable.');
  res.json({ order });
});

adminOrdersRouter.get('/orders/:id/receipt.pdf', requirePermission('orders:read'), (req, res) => {
  const order = adminGetOrder(String(req.params.id));
  if (!order) throw ApiError.notFound('Commande introuvable.');
  const pdf = buildOrderReceipt(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recu-${order.reference}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

adminOrdersRouter.patch('/orders/:id/status', requirePermission('orders:write'), (req, res) => {
  const orderId = String(req.params.id);
  const input = orderStatusUpdateSchema.parse(req.body);
  const order = updateOrderStatus(orderId, input.status, input.note ?? '', {
    id: req.user!.id,
    label: req.user!.fullName || req.user!.email,
  });
  res.json({ order });
});

adminOrdersRouter.patch('/orders/:id/note', requirePermission('orders:write'), (req, res) => {
  const orderId = String(req.params.id);
  const note = typeof req.body?.internalNote === 'string' ? req.body.internalNote.trim().slice(0, 1000) : '';
  const updated = execute('UPDATE orders SET internal_note = ?, updated_at = ? WHERE id = ?', [note, nowIso(), orderId]);
  if (updated.changes !== 1) throw ApiError.notFound('Commande introuvable.');
  audit(req.user!.id, 'order.note', 'order', orderId, {});
  res.json({ order: adminGetOrder(orderId) });
});
