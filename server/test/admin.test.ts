import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createTestContext, TestClient, type TestContext } from './helpers.js';
import { execute } from '../src/db/index.js';

let ctx: TestContext;
let adminId = '';

before(async () => {
  ctx = await createTestContext();
  const registration = await ctx.client.request<{ user: { id: string } }>('POST', '/api/auth/register', {
    fullName: 'Admin Catalogue',
    email: 'admin.catalogue@example.com',
    password: 'MotDePasseAdmin123!',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);
  adminId = registration.data.user.id;
  execute("UPDATE users SET role_slug = 'admin', status = 'active' WHERE id = ?", [adminId]);
});

after(async () => {
  await ctx.stop();
});

test('un administrateur crée une catégorie et un produit, puis l’archive', async () => {
  const categoryResponse = await ctx.client.request<{
    categories: Array<{ id: string; slug: string; published: boolean }>;
  }>('POST', '/api/admin/categories', {
    name: 'Catégorie test admin',
    slug: 'categorie-test-admin',
    description: 'Catégorie créée par le test d’administration.',
    sortOrder: 90,
    published: true,
  });
  assert.equal(categoryResponse.status, 201);
  const category = categoryResponse.data.categories.find((item) => item.slug === 'categorie-test-admin');
  assert.ok(category, 'la catégorie créée doit être retournée');

  const productResponse = await ctx.client.request<{
    product: { id: string; slug: string; status: string; variants: Array<{ id: string; sku: string; stock: number }> };
  }>('POST', '/api/admin/products', {
    reference: 'TEST-ADMIN-001',
    name: 'Pièce test administration',
    slug: 'piece-test-administration',
    categoryId: category.id,
    shortDescription: 'Produit créé par un test automatisé.',
    description: 'Ce produit sert uniquement à vérifier les routes d’administration.',
    priceCents: 5900,
    status: 'published',
    isFeatured: false,
    images: [{ url: '/media/product-hoodie.svg', alt: 'Visuel de test', sortOrder: 0 }],
    variants: [
      {
        sku: 'TEST-ADMIN-001-M',
        size: 'M',
        color: 'Noir',
        colorHex: '#171717',
        stock: 4,
        isActive: true,
      },
    ],
  });
  assert.equal(productResponse.status, 201);
  assert.equal(productResponse.data.product.status, 'published');
  assert.equal(productResponse.data.product.variants[0]?.stock, 4);
  const createdProductId = productResponse.data.product.id;
  const createdVariant = productResponse.data.product.variants[0]!;

  const initialMovements = await ctx.client.request<{
    movements: Array<{ reason: string; delta: number; stockBefore: number; stockAfter: number }>;
  }>('GET', `/api/admin/products/${createdProductId}/stock-movements`);
  assert.equal(initialMovements.status, 200);
  const initial = initialMovements.data.movements.find((movement) => movement.reason === 'initial');
  assert.ok(initial, 'la création doit enregistrer le stock initial');
  assert.equal(initial.delta, 4);
  assert.equal(initial.stockBefore, 0);
  assert.equal(initial.stockAfter, 4);

  const adjusted = await ctx.client.request('PUT', `/api/admin/products/${createdProductId}`, {
    reference: 'TEST-ADMIN-001',
    name: 'Pièce test administration',
    slug: 'piece-test-administration',
    categoryId: category.id,
    shortDescription: 'Produit créé par un test automatisé.',
    description: 'Ce produit sert uniquement à vérifier les routes d’administration.',
    priceCents: 5900,
    status: 'published',
    isFeatured: false,
    images: [{ url: '/media/product-hoodie.svg', alt: 'Visuel de test', sortOrder: 0 }],
    variants: [
      {
        id: createdVariant.id,
        sku: 'TEST-ADMIN-001-M',
        size: 'M',
        color: 'Noir',
        colorHex: '#171717',
        stock: 6,
        isActive: true,
      },
    ],
  });
  assert.equal(adjusted.status, 200);

  const adjustedMovements = await ctx.client.request<{
    movements: Array<{ reason: string; delta: number; stockBefore: number; stockAfter: number; actorLabel: string }>;
  }>('GET', `/api/admin/products/${createdProductId}/stock-movements`);
  const adjustment = adjustedMovements.data.movements.find((movement) => movement.reason === 'adjustment');
  assert.ok(adjustment, 'la modification manuelle doit créer un mouvement');
  assert.equal(adjustment.delta, 2);
  assert.equal(adjustment.stockBefore, 4);
  assert.equal(adjustment.stockAfter, 6);
  assert.ok(adjustment.actorLabel);

  const publicProduct = await ctx.client.request('GET', '/api/products/piece-test-administration');
  assert.equal(publicProduct.status, 200);

  const archiveResponse = await ctx.client.request<{ product: { status: string } }>(
    'PATCH',
    `/api/admin/products/${productResponse.data.product.id}/status`,
    { status: 'archived' },
  );
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.data.product.status, 'archived');

  const hiddenProduct = await ctx.client.request('GET', '/api/products/piece-test-administration');
  assert.equal(hiddenProduct.status, 404);

  const badSale = await ctx.client.request('POST', '/api/admin/products', {
    name: 'Produit promo invalide',
    categoryId: category.id,
    priceCents: 5000,
    salePriceCents: 5000,
    status: 'draft',
    images: [],
    variants: [{ sku: 'TEST-BAD-SALE', size: 'M', color: 'Noir', stock: 1, isActive: true }],
  });
  assert.equal(badSale.status, 422);
});

test('un administrateur exporte les commandes filtrées en CSV', async () => {
  const productResponse = await ctx.client.request<{
    product: { variants: Array<{ id: string; stock: number; isActive: boolean }> };
  }>('GET', '/api/products/hoodie-molleton-epais');
  const variant = productResponse.data.product.variants.find((entry) => entry.isActive && entry.stock > 0)!;
  const shippingResponse = await ctx.client.request<{ methods: Array<{ id: string }> }>(
    'GET',
    '/api/shipping/options?country=BJ&subtotal=0',
  );
  const created = await ctx.client.request<{ order: { reference: string } }>('POST', '/api/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    shippingMethodId: shippingResponse.data.methods[0]!.id,
    country: 'BJ',
    email: 'admin.catalogue@example.com',
    paymentMethod: 'cod',
    address: {
      firstName: 'Admin',
      lastName: 'Catalogue',
      line1: '1 rue du Test',
      line2: '',
      postalCode: 'Cotonou',
      city: 'Cotonou',
      country: 'BJ',
      phone: '+229 01 00 00 00 00',
    },
    acceptTerms: true,
  });
  assert.equal(created.status, 201);

  const csv = await ctx.client.request<string>('GET', '/api/admin/reports/orders.csv?status=pending');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
  assert.match(csv.headers.get('content-disposition') ?? '', /hp-collection-commandes-/);
  assert.match(csv.data, /reference;date;statut/);
  assert.match(csv.data, new RegExp(created.data.order.reference));

  const report = await ctx.client.request<string>('GET', '/api/admin/reports/sales.pdf');
  assert.equal(report.status, 200);
  assert.match(report.headers.get('content-type') ?? '', /application\/pdf/);
  assert.match(report.headers.get('content-disposition') ?? '', /hp-collection-rapport-/);
  assert.ok(report.data.startsWith('%PDF-1.4'));
  assert.match(report.data, /Rapport de synth/);
});

test('un administrateur gère promotions, livraison et réglages', async () => {
  const promoResponse = await ctx.client.request<{ promos: Array<{ code: string }> }>('POST', '/api/admin/promos', {
    code: 'TESTADMIN10',
    description: 'Remise de test',
    type: 'percent',
    value: 1000,
    minSubtotalCents: 0,
    active: true,
  });
  assert.equal(promoResponse.status, 201);
  assert.ok(promoResponse.data.promos.some((promo) => promo.code === 'TESTADMIN10'));

  const invalidPromo = await ctx.client.request('POST', '/api/admin/promos', {
    code: 'TESTADMIN200',
    description: 'Remise impossible',
    type: 'percent',
    value: 20000,
    minSubtotalCents: 0,
    active: true,
  });
  assert.equal(invalidPromo.status, 422);

  const zoneResponse = await ctx.client.request<{
    zones: Array<{ id: string; name: string; countries: string[] }>;
  }>('POST', '/api/admin/shipping/zones', {
    name: 'Zone test',
    countries: ['ZZ'],
    active: true,
    sortOrder: 90,
  });
  assert.equal(zoneResponse.status, 201);
  const zone = zoneResponse.data.zones.find((item) => item.name === 'Zone test');
  assert.ok(zone);

  const methodResponse = await ctx.client.request('POST', '/api/admin/shipping/methods', {
    zoneId: zone.id,
    name: 'Livraison test',
    description: 'Mode créé par les tests.',
    priceCents: 500,
    freeOverCents: 5000,
    minDays: 1,
    maxDays: 3,
    active: true,
    sortOrder: 90,
  });
  assert.equal(methodResponse.status, 201);

  const options = await ctx.client.request<{
    methods: Array<{ name: string; priceCents: number }>;
  }>('GET', '/api/shipping/options?country=ZZ&subtotal=1000');
  assert.equal(options.status, 200);
  assert.ok(options.data.methods.some((method) => method.name === 'Livraison test' && method.priceCents === 500));

  const settingsResponse = await ctx.client.request<{ settings: Record<string, unknown> }>('GET', '/api/admin/settings');
  assert.equal(settingsResponse.status, 200);
  const settings = settingsResponse.data.settings;
  const saveResponse = await ctx.client.request<{ settings: { announcement: string } }>('PUT', '/api/admin/settings', {
    ...settings,
    announcement: 'Annonce test administration',
  });
  assert.equal(saveResponse.status, 200);
  assert.equal(saveResponse.data.settings.announcement, 'Annonce test administration');

  const store = await ctx.client.request<{ settings: { announcement: string } }>('GET', '/api/store');
  assert.equal(store.data.settings.announcement, 'Annonce test administration');
});

test('un administrateur gère les rôles et les messages de contact', async () => {
  // Client séparé : le client principal doit rester connecté en administrateur.
  const staffClient = new TestClient(ctx.baseUrl);
  await staffClient.init();
  const registration = await staffClient.request<{ user: { id: string } }>('POST', '/api/auth/register', {
    fullName: 'Membre Staff',
    email: 'staff.candidate@example.com',
    password: 'MotDePasseStaff123!',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);

  const roleResponse = await ctx.client.request('PATCH', `/api/admin/users/${registration.data.user.id}`, {
    role: 'staff',
  });
  assert.equal(roleResponse.status, 200);

  const users = await ctx.client.request<{ users: Array<{ email: string; role: string }> }>('GET', '/api/admin/users');
  assert.equal(users.status, 200);
  assert.ok(users.data.users.some((user) => user.email === 'staff.candidate@example.com' && user.role === 'staff'));

  const contactResponse = await ctx.client.request('POST', '/api/contact', {
    name: 'Client Test Admin',
    email: 'client.test.admin@example.com',
    subject: 'Message test administration',
    message: 'Ce message vérifie la boîte de réception administrateur.',
  });
  assert.equal(contactResponse.status, 201);

  const messages = await ctx.client.request<{
    messages: Array<{ id: string; subject: string; status: string }>;
  }>('GET', '/api/admin/messages');
  assert.equal(messages.status, 200);
  const message = messages.data.messages.find((item) => item.subject === 'Message test administration');
  assert.ok(message);
  assert.equal(message.status, 'new');

  const update = await ctx.client.request('PATCH', `/api/admin/messages/${message.id}`, { status: 'read' });
  assert.equal(update.status, 200);

  const afterUpdate = await ctx.client.request<{ messages: Array<{ id: string; status: string }> }>(
    'GET',
    '/api/admin/messages',
  );
  assert.equal(afterUpdate.data.messages.find((item) => item.id === message.id)?.status, 'read');
});

test('le journal d’audit et le diagnostic de production sont protégés', async () => {
  const audit = await ctx.client.request<{
    entries: Array<{ action: string; entity: string; actorEmail: string }>;
  }>('GET', '/api/admin/audit?limit=50');
  assert.equal(audit.status, 200);
  assert.ok(audit.data.entries.some((entry) => entry.action === 'settings.update'));
  assert.ok(audit.data.entries.every((entry) => typeof entry.actorEmail === 'string'));

  const readiness = await ctx.client.request<{
    status: string;
    checks: Array<{ id: string; status: string }>;
  }>('GET', '/api/admin/readiness');
  assert.equal(readiness.status, 200);
  assert.ok(['ok', 'warning', 'blocking'].includes(readiness.data.status));
  assert.ok(readiness.data.checks.some((check) => check.id === 'legal_identity'));
  assert.ok(readiness.data.checks.some((check) => check.id === 'backup'));

  const customer = new TestClient(ctx.baseUrl);
  await customer.init();
  const registration = await customer.request('POST', '/api/auth/register', {
    fullName: 'Client Audit Refusé',
    email: 'client.audit.refuse@example.com',
    password: 'MotDePasseClient123!',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);

  const forbidden = await customer.request('GET', '/api/admin/audit');
  assert.equal(forbidden.status, 403);
  const forbiddenReadiness = await customer.request('GET', '/api/admin/readiness');
  assert.equal(forbiddenReadiness.status, 403);
});
