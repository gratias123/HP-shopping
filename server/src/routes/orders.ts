import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../lib/http.js';
import { createOrderSchema, quoteSchema, trackingSchema } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/security.js';
import { createOrder, getOrderByReference, getOrderForUser, listOrdersForUser, quoteCart } from '../services/orders.js';
import { buildOrderReceipt } from '../services/documents.js';

export const ordersRouter = Router();

ordersRouter.post(
  '/cart/quote',
  rateLimit({ windowMs: 5 * 60 * 1000, max: 120, scope: 'quote' }),
  (req, res) => {
    const input = quoteSchema.parse(req.body);
    const quote = quoteCart({
      items: input.items,
      promoCode: input.promoCode || undefined,
      shippingMethodId: input.shippingMethodId ?? null,
      country: input.country ?? undefined,
      email: input.email ?? req.user?.email ?? '',
      userId: req.user?.id ?? null,
    });
    res.json({ quote });
  },
);

const createOrderLimiter = rateLimit({ windowMs: 30 * 60 * 1000, max: 12, scope: 'order-create' });

ordersRouter.post(
  '/orders',
  createOrderLimiter,
  asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    const email = req.user?.email ?? input.email;
    if (!email) {
      throw new ApiError(
        422,
        'email_required',
        'Indiquez une adresse e-mail pour identifier votre commande et permettre son suivi.',
      );
    }
    if (!input.shippingMethodId) {
      throw new ApiError(422, 'shipping_required', 'Sélectionnez un mode de livraison.');
    }
    const order = createOrder({
      items: input.items,
      promoCode: input.promoCode || undefined,
      shippingMethodId: input.shippingMethodId,
      country: input.address.country,
      paymentMethod: input.paymentMethod,
      email,
      userId: req.user?.id ?? null,
      address: input.address,
      customerNote: input.customerNote || '',
    });
    res.status(201).json({ order });
  }),
);

ordersRouter.get('/orders', requireAuth, (req, res) => {
  res.json({ orders: listOrdersForUser(req.user!.id) });
});

ordersRouter.get('/orders/:id', requireAuth, (req, res) => {
  const order = getOrderForUser(String(req.params.id), req.user!.id);
  if (!order) throw ApiError.notFound('Commande introuvable.');
  res.json({ order });
});

ordersRouter.get('/orders/:id/receipt.pdf', requireAuth, (req, res) => {
  const order = getOrderForUser(String(req.params.id), req.user!.id);
  if (!order) throw ApiError.notFound('Commande introuvable.');
  const pdf = buildOrderReceipt(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recu-${order.reference}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

ordersRouter.post(
  '/orders/track',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, scope: 'track' }),
  (req, res) => {
    const input = trackingSchema.parse(req.body);
    const order = getOrderByReference(input.reference, input.email);
    if (!order) {
      throw new ApiError(
        404,
        'order_not_found',
        'Aucune commande ne correspond à cette référence et à cette adresse e-mail.',
      );
    }
    // Le suivi public ne divulgue ni les notes internes ni les identifiants techniques.
    const { internalNote: _internalNote, userId: _userId, ...publicOrder } = order;
    res.json({ order: publicOrder });
  },
);
