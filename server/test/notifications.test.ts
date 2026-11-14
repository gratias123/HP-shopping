import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { execute, queryOne } from '../src/db/index.js';
import { createTestContext, TestClient, type ProductDetailResponse, type ShippingMethodsResponse, type TestContext } from './helpers.js';

interface NotificationsResponse {
  notifications: Array<{ id: string; type: string; title: string; link: string | null; read: boolean }>;
  unreadCount: number;
}

let ctx: TestContext;
let admin: TestClient;
let customer: TestClient;
let customerId = '';
let adminId = '';


const ADDRESS = {
  firstName: 'Cliente',
  lastName: 'Notifications',
  line1: '12 rue des Palmiers',
  line2: '',
  postalCode: 'Akpakpa',
  city: 'Cotonou',
  country: 'BJ',
  phone: '+229 01 97 00 00 00',
};

function orderBody(shippingMethodId: string, variantId: string) {
  return {
    items: [{ variantId, quantity: 1 }],
    shippingMethodId,
    country: 'BJ',
    email: 'cliente.notifications@example.com',
    paymentMethod: 'cod',
    address: ADDRESS,
    acceptTerms: true,
  };
}

async function newClient(): Promise<TestClient> {
  const client = new TestClient(ctx.baseUrl);
  await client.init();
  return client;
}

before(async () => {
  ctx = await createTestContext();
  admin = await newClient();
  const adminReg = await admin.request<{ user: { id: string } }>('POST', '/api/auth/register', {
    fullName: 'Admin Notifications',
    email: 'admin.notifications@example.com',
    password: 'MotDePasseAdmin123!',
    acceptTerms: true,
  });
  assert.equal(adminReg.status, 201);
  adminId = adminReg.data.user.id;
  execute("UPDATE users SET role_slug = 'admin', status = 'active' WHERE id = ?", [adminId]);

  customer = await newClient();
  const customerReg = await customer.request<{ user: { id: string } }>('POST', '/api/auth/register', {
    fullName: 'Cliente Notifications',
    email: 'cliente.notifications@example.com',
    password: 'MotDePasse123!',
    acceptTerms: true,
  });
  assert.equal(customerReg.status, 201);
  customerId = customerReg.data.user.id;
});

after(async () => {
  await ctx.stop();
});

test('les notifications exigent une session', async () => {
  const anonymous = await newClient();
  const response = await anonymous.request('GET', '/api/notifications');
  assert.equal(response.status, 401);
});

test('l’inscription d’un client notifie le personnel', async () => {
  const list = await admin.request<NotificationsResponse>('GET', '/api/notifications');
  assert.equal(list.status, 200);
  const entry = list.data.notifications.find((item) => item.type === 'customer_new');
  assert.ok(entry, 'une notification « nouvelle inscription » est attendue');
  assert.ok(list.data.unreadCount >= 1);
  // Le client ne reçoit pas les notifications du personnel.
  const own = await customer.request<NotificationsResponse>('GET', '/api/notifications');
  assert.equal(own.data.notifications.filter((item) => item.type === 'customer_new').length, 0);
});

test('un message de contact notifie le personnel', async () => {
  const response = await ctx.client.request('POST', '/api/contact', {
    name: 'Visiteur',
    email: 'visiteur@example.com',
    subject: 'Question sur une taille',
    message: 'Bonjour, avez-vous ce modèle en taille 42 ?',
  });
  assert.equal(response.status, 201);
  const list = await admin.request<NotificationsResponse>('GET', '/api/notifications');
  assert.ok(list.data.notifications.some((item) => item.type === 'request_new'));
});

test('une commande notifie le client et le personnel, puis chaque changement de statut le client', async () => {
  const products = await ctx.client.request<{ items: Array<{ slug: string }> }>('GET', '/api/products');
  const slug = products.data.items[0].slug;
  const detail = await ctx.client.request<ProductDetailResponse>('GET', `/api/products/${slug}`);
  const variant = detail.data.product.variants.find((item) => item.stock > 2 && item.isActive);
  assert.ok(variant, 'une variante en stock est nécessaire');
  const methods = await ctx.client.request<ShippingMethodsResponse>('GET', '/api/shipping/options?country=BJ&subtotal=0');
  const method = methods.data.methods[0];

  const order = await customer.request<{ order: { id: string; reference: string } }>('POST', '/api/orders', orderBody(method.id, variant.id));
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const orderId = order.data.order.id;

  const customerList = await customer.request<NotificationsResponse>('GET', '/api/notifications');
  const confirmation = customerList.data.notifications.find((item) => item.type === 'order_confirmation');
  assert.ok(confirmation);
  assert.equal(confirmation.link, `/compte/commandes/${orderId}`);

  const adminList = await admin.request<NotificationsResponse>('GET', '/api/notifications');
  const newOrder = adminList.data.notifications.find((item) => item.type === 'order_new');
  assert.ok(newOrder);
  assert.equal(newOrder.link, `/admin/commandes/${orderId}`);

  for (const status of ['confirmed', 'preparing', 'shipped', 'delivered']) {
    const update = await admin.request('PATCH', `/api/admin/orders/${orderId}/status`, { status, note: '' });
    assert.equal(update.status, 200, `${status}: ${JSON.stringify(update.data)}`);
  }
  const after = await customer.request<NotificationsResponse>('GET', '/api/notifications');
  const titles = after.data.notifications.filter((item) => item.type === 'order_status').map((item) => item.title);
  for (const expected of ['Commande confirmée', 'Commande en préparation', 'Commande expédiée', 'Commande livrée']) {
    assert.ok(titles.includes(expected), `notification manquante : ${expected}`);
  }
});

test('marquer comme lu fonctionne, avec isolation entre comptes', async () => {
  const before = await customer.request<NotificationsResponse>('GET', '/api/notifications');
  assert.ok(before.data.unreadCount > 0);
  const target = before.data.notifications[0];

  // Un autre compte ne peut pas toucher cette notification.
  const forbidden = await admin.request('POST', `/api/notifications/${target.id}/read`);
  assert.equal(forbidden.status, 404);

  const one = await customer.request<{ unreadCount: number }>('POST', `/api/notifications/${target.id}/read`);
  assert.equal(one.status, 200);
  assert.equal(one.data.unreadCount, before.data.unreadCount - 1);

  const all = await customer.request<{ unreadCount: number }>('POST', '/api/notifications/read-all');
  assert.equal(all.status, 200);
  assert.equal(all.data.unreadCount, 0);
  const persisted = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [customerId]);
  assert.equal(Number(persisted?.total), 0);
});

test('une vente qui fait passer une variante sous le seuil alerte le personnel une seule fois', async () => {
  const products = await ctx.client.request<{ items: Array<{ slug: string }> }>('GET', '/api/products');
  const detail = await ctx.client.request<ProductDetailResponse>('GET', `/api/products/${products.data.items[1].slug}`);
  const variant = detail.data.product.variants.find((item) => item.isActive && item.stock > 0);
  assert.ok(variant);
  execute('UPDATE product_variants SET stock = 2 WHERE id = ?', [variant.id]);
  const methods = await ctx.client.request<ShippingMethodsResponse>('GET', '/api/shipping/options?country=BJ&subtotal=0');
  const buy = async () => customer.request('POST', '/api/orders', orderBody(methods.data.methods[0].id, variant.id));
  assert.equal((await buy()).status, 201);
  assert.equal((await buy()).status, 201);

  const list = await admin.request<NotificationsResponse>('GET', '/api/notifications?limit=100');
  const productId = detail.data.product.id;
  const low = list.data.notifications.filter((item) => item.type === 'stock_low' && !item.read && item.link === `/admin/produits/${productId}`);
  const out = list.data.notifications.filter((item) => item.type === 'stock_out' && !item.read && item.link === `/admin/produits/${productId}`);
  assert.equal(low.length, 1, 'une seule alerte de stock faible non lue');
  assert.equal(out.length, 1, 'une alerte de rupture');
});
