import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/lib/errors.js';
import { getOrderByReference, updateOrderStatus } from '../src/services/orders.js';
import { listStockMovements } from '../src/services/inventory.js';
import {
  createTestContext,
  type ProductDetailResponse,
  type ShippingMethodsResponse,
} from './helpers.js';

const ctx = await createTestContext();
test.after(async () => ctx.stop());

const productResponse = await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais');
const product = productResponse.data.product;
const variant = product.variants.find((entry) => entry.isActive && entry.stock >= 2)!;
const lowStockVariant = [...product.variants].sort((a, b) => a.stock - b.stock)[0];

const shippingResponse = await ctx.client.request<ShippingMethodsResponse>(
  'GET',
  '/api/shipping/options?country=BJ&subtotal=0',
);
const standard = shippingResponse.data.methods.find((method) => method.name === 'Livraison Cotonou')!;

const address = {
  firstName: 'Camille',
  lastName: 'Martin',
  line1: '12 rue de la Paix',
  line2: 'Quartier Akpakpa',
  postalCode: 'Akpakpa',
  city: 'Cotonou',
  country: 'BJ',
  phone: '+229 01 23 45 67 89',
};

test('le devis recalcule les prix depuis la base et applique le code promo', async () => {
  const response = await ctx.client.request<{
    quote: {
      subtotalCents: number;
      discountCents: number;
      shippingCents: number;
      totalCents: number;
      promo: { code: string } | null;
      lines: Array<{ unitPriceCents: number; quantity: number; availableStock: number }>;
    };
  }>('POST', '/api/cart/quote', {
    // Un prix client falsifié est ignoré : seul le prix serveur compte.
    items: [{ variantId: variant.id, quantity: 1, unitPriceCents: 1 }],
    promoCode: 'BIENVENUE10',
    shippingMethodId: standard.id,
    country: 'BJ',
    email: 'camille@example.com',
  });
  assert.equal(response.status, 200);
  const quote = response.data.quote;
  assert.equal(quote.lines[0].unitPriceCents, product.priceCents);
  assert.equal(quote.subtotalCents, product.priceCents);
  assert.equal(quote.discountCents, Math.floor(product.priceCents * 0.1));
  assert.equal(quote.shippingCents, standard.priceCents);
  assert.equal(quote.totalCents, quote.subtotalCents - quote.discountCents + standard.priceCents);
  assert.equal(quote.promo?.code, 'BIENVENUE10');
});

test('un stock insuffisant est refusé dès le devis', async () => {
  const response = await ctx.client.request<{ error: { code: string; details?: unknown } }>('POST', '/api/cart/quote', {
    items: [{ variantId: lowStockVariant.id, quantity: 10 }],
    country: 'BJ',
  });
  assert.equal(response.status, 422);
  assert.equal(response.data.error.code, 'insufficient_stock');
});

test('un code promo inconnu est refusé', async () => {
  const response = await ctx.client.request<{ error: { code: string } }>('POST', '/api/cart/quote', {
    items: [{ variantId: variant.id, quantity: 1 }],
    promoCode: 'CODEQUINEXISTEPAS',
    country: 'BJ',
  });
  assert.equal(response.status, 422);
  assert.equal(response.data.error.code, 'promo_invalid');
});

test('la commande décrémente le stock, fige les lignes et reste traçable', async () => {
  const before = await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais');
  const stockBefore = before.data.product.variants.find((entry) => entry.id === variant.id)!.stock;

  const response = await ctx.client.request<{
    order: {
      id: string;
      reference: string;
      status: string;
      paymentMethod: string;
      paymentStatus: string;
      subtotalCents: number;
      totalCents: number;
      email: string;
      items: Array<{ productName: string; variantSize: string; variantColor: string; quantity: number }>;
      history: Array<{ toStatus: string; note: string }>;
      allowedTransitions: string[];
    };
  }>('POST', '/api/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    promoCode: 'BIENVENUE10',
    shippingMethodId: standard.id,
    country: 'BJ',
    email: 'camille@example.com',
    paymentMethod: 'cod',
    address,
    acceptTerms: true,
    customerNote: 'Livraison en point relais si possible.',
  });
  assert.equal(response.status, 201);
  const order = response.data.order;
  assert.match(order.reference, /^HP-[A-Z0-9]{6}$/);
  assert.equal(order.status, 'pending');
  assert.equal(order.paymentMethod, 'cod');
  assert.equal(order.paymentStatus, 'pending');
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productName, product.name);
  assert.equal(order.items[0].variantSize, variant.size);
  assert.equal(order.items[0].variantColor, variant.color);
  assert.equal(order.items[0].quantity, 1);
  assert.equal(order.history.length, 1);
  assert.equal(order.history[0].toStatus, 'pending');
  assert.deepEqual(order.allowedTransitions, ['confirmed', 'cancelled']);

  const after = await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais');
  const stockAfter = after.data.product.variants.find((entry) => entry.id === variant.id)!.stock;
  assert.equal(stockAfter, stockBefore - 1);

  const saleMovement = listStockMovements(product.id).find(
    (movement) => movement.reason === 'order' && movement.reference === order.reference,
  );
  assert.ok(saleMovement, 'la vente doit créer un mouvement de stock');
  assert.equal(saleMovement.delta, -1);
  assert.equal(saleMovement.stockBefore, stockBefore);
  assert.equal(saleMovement.stockAfter, stockAfter);

  const tracked = await ctx.client.request<{
    order: { reference: string; internalNote?: string; items: unknown[] };
  }>('POST', '/api/orders/track', { reference: order.reference, email: 'camille@example.com' });
  assert.equal(tracked.status, 200);
  assert.equal(tracked.data.order.reference, order.reference);
  assert.equal(tracked.data.order.internalNote, undefined);
  assert.equal(tracked.data.order.items.length, 1);

  const wrongEmail = await ctx.client.request<{ error: { code: string } }>('POST', '/api/orders/track', {
    reference: order.reference,
    email: 'autre@example.com',
  });
  assert.equal(wrongEmail.status, 404);
  assert.equal(wrongEmail.data.error.code, 'order_not_found');

  const direct = getOrderByReference(order.reference, 'camille@example.com');
  assert.equal(direct?.reference, order.reference);
});

test('le paiement Mobile Money est refusé tant que le prestataire n’est pas configuré', async () => {
  const response = await ctx.client.request<{ error: { code: string } }>('POST', '/api/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    shippingMethodId: standard.id,
    country: 'BJ',
    email: 'camille@example.com',
    paymentMethod: 'mobile_money',
    address,
    acceptTerms: true,
  });
  assert.equal(response.status, 503);
  assert.equal(response.data.error.code, 'payment_not_configured');
});

test('le client authentifié télécharge un reçu PDF non fiscal', async () => {
  const registration = await ctx.client.request<{ user: { id: string; email: string } }>('POST', '/api/auth/register', {
    email: 'recu@example.com',
    password: 'MotDePasseRecu2026!',
    fullName: 'Client Reçu',
    phone: '+229 01 98 76 54 32',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);

  const created = await ctx.client.request<{ order: { id: string; reference: string } }>('POST', '/api/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    shippingMethodId: standard.id,
    country: 'BJ',
    email: 'recu@example.com',
    paymentMethod: 'cod',
    address: { ...address, firstName: 'Client', lastName: 'Reçu' },
    acceptTerms: true,
  });
  assert.equal(created.status, 201);

  const receipt = await ctx.client.request<string>('GET', `/api/orders/${created.data.order.id}/receipt.pdf`);
  assert.equal(receipt.status, 200);
  assert.match(receipt.headers.get('content-type') ?? '', /application\/pdf/);
  assert.match(receipt.headers.get('content-disposition') ?? '', /recu-HP-/);
  assert.ok(receipt.data.startsWith('%PDF-1.4'));
  assert.match(receipt.data, /commande - document non fiscal/);
  assert.match(receipt.data, /Document non fiscal/);
});

test('les transitions invalides sont refusées et l’annulation restaure le stock une seule fois', async () => {
  const created = await ctx.client.request<{ order: { id: string; reference: string } }>('POST', '/api/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    shippingMethodId: standard.id,
    country: 'BJ',
    email: 'annulation@example.com',
    paymentMethod: 'cod',
    address,
    acceptTerms: true,
  });
  assert.equal(created.status, 201);
  const orderId = created.data.order.id;

  await assert.rejects(
    async () => {
      updateOrderStatus(orderId, 'shipped', 'Tentative invalide', { id: null, label: 'Test' });
    },
    (error: unknown) => error instanceof ApiError && error.code === 'invalid_transition',
  );

  const stockBeforeCancel = (
    await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais')
  ).data.product.variants.find((entry) => entry.id === variant.id)!.stock;

  const cancelled = updateOrderStatus(orderId, 'cancelled', 'Client demande l’annulation', {
    id: null,
    label: 'Test automatisé',
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.stockReleased, true);
  assert.equal(cancelled.history.length, 2);
  assert.equal(cancelled.history[1].fromStatus, 'pending');
  assert.equal(cancelled.history[1].toStatus, 'cancelled');

  const stockAfterCancel = (
    await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais')
  ).data.product.variants.find((entry) => entry.id === variant.id)!.stock;
  assert.equal(stockAfterCancel, stockBeforeCancel + 1);

  const cancellationMovement = listStockMovements(product.id).find(
    (movement) => movement.reason === 'cancellation' && movement.reference === created.data.order.reference,
  );
  assert.ok(cancellationMovement, 'l’annulation doit créer un mouvement de stock');
  assert.equal(cancellationMovement.delta, 1);
  assert.equal(cancellationMovement.stockBefore, stockBeforeCancel);
  assert.equal(cancellationMovement.stockAfter, stockAfterCancel);

  await assert.rejects(
    async () => {
      updateOrderStatus(orderId, 'cancelled', 'Deuxième annulation', { id: null, label: 'Test' });
    },
    (error: unknown) => error instanceof ApiError && error.code === 'status_unchanged',
  );

  const stockAfterDoubleCancel = (
    await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais')
  ).data.product.variants.find((entry) => entry.id === variant.id)!.stock;
  assert.equal(stockAfterDoubleCancel, stockAfterCancel);
});
