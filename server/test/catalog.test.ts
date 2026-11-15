import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestContext, type ProductDetailResponse, type ShippingMethodsResponse } from './helpers.js';

const ctx = await createTestContext();
test.after(async () => ctx.stop());

interface ProductListResponse {
  items: Array<{
    reference: string;
    name: string;
    slug: string;
    priceCents: number;
    effectivePriceCents: number;
    onSale: boolean;
    category: { slug: string };
    image: { url: string } | null;
    stockTotal: number;
  }>;
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

test('le catalogue public expose uniquement les articles publiés de démonstration', async () => {
  const response = await ctx.client.request<ProductListResponse>('GET', '/api/products?perPage=50');
  assert.equal(response.status, 200);
  assert.equal(response.data.total, 49);
  assert.ok(response.data.items.length >= 8);
  for (const item of response.data.items) {
    assert.match(item.reference, /^DEMO-/);
    assert.ok((item.image?.url.startsWith('/media/') || item.image?.url.startsWith('https://images.pexels.com/')));
    assert.ok(item.priceCents > 0);
  }
});

test('les filtres catégorie, prix et tri sont appliqués côté serveur', async () => {
  const category = await ctx.client.request<ProductListResponse>(
    'GET',
    '/api/products?category=homme-sneakers&perPage=50',
  );
  assert.equal(category.status, 200);
  assert.ok(category.data.items.length > 0);
  assert.ok(category.data.items.every((item) => item.category.slug === 'homme-sneakers'));

  const sorted = await ctx.client.request<ProductListResponse>('GET', '/api/products?sort=price-asc&perPage=50');
  const prices = sorted.data.items.map((item) => item.effectivePriceCents);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

  const bounded = await ctx.client.request<ProductListResponse>('GET', '/api/products?maxPrice=1500000&perPage=50');
  assert.ok(bounded.data.items.length > 0);
  assert.ok(bounded.data.items.every((item) => item.effectivePriceCents <= 1_500_000));
});

test('la recherche texte et le filtre promo fonctionnent', async () => {
  const search = await ctx.client.request<ProductListResponse>('GET', '/api/products?q=hoodie&perPage=50');
  assert.equal(search.status, 200);
  assert.ok(search.data.total >= 1);
  assert.ok(search.data.items.some((item) => item.slug === 'hoodie-molleton-epais'));

  const sale = await ctx.client.request<ProductListResponse>('GET', '/api/products?onSale=true&perPage=50');
  assert.ok(sale.data.items.length > 0);
  assert.ok(sale.data.items.every((item) => item.onSale));
});

test('la fiche produit expose variantes, images et prix effectif', async () => {
  const response = await ctx.client.request<ProductDetailResponse>('GET', '/api/products/hoodie-molleton-epais');
  assert.equal(response.status, 200);
  const product = response.data.product;
  assert.equal(product.reference, 'DEMO-HD01');
  assert.equal(product.effectivePriceCents, product.priceCents);
  assert.ok(product.images.length >= 1);
  assert.ok(product.variants.length >= 4);
  assert.ok(product.variants.some((variant) => variant.stock === 0));
  assert.ok(product.variants.every((variant) => typeof variant.id === 'string'));
});

test('un produit inconnu renvoie 404 sans fuite technique', async () => {
  const response = await ctx.client.request<{ error: { code: string; message: string } }>(
    'GET',
    '/api/products/produit-inexistant',
  );
  assert.equal(response.status, 404);
  assert.equal(response.data.error.code, 'not_found');
  assert.ok(!response.data.error.message.includes('SQLITE'));
});

test('les facettes sont calculées sur les stocks réels', async () => {
  const response = await ctx.client.request<{
    sizes: string[];
    colors: Array<{ name: string; hex: string | null }>;
    priceMinCents: number;
    priceMaxCents: number;
  }>('GET', '/api/facets');
  assert.equal(response.status, 200);
  assert.ok(response.data.sizes.includes('M'));
  assert.ok(response.data.colors.some((color) => color.name === 'Noir'));
  assert.ok(response.data.priceMinCents > 0);
  assert.ok(response.data.priceMaxCents >= response.data.priceMinCents);
});

test('les pays desservis proviennent des zones actives', async () => {
  const response = await ctx.client.request<{ countries: string[]; defaultCountry: string }>(
    'GET',
    '/api/shipping/countries',
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.countries, ['BJ']);
  assert.equal(response.data.defaultCountry, 'BJ');
});

test('la livraison offerte est calculée côté serveur selon le sous-total', async () => {
  const below = await ctx.client.request<ShippingMethodsResponse>('GET', '/api/shipping/options?country=BJ&subtotal=1000000');
  assert.equal(below.status, 200);
  const cotonouBelow = below.data.methods.find((method) => method.name === 'Livraison Cotonou');
  assert.equal(cotonouBelow?.priceCents, 150_000);

  const above = await ctx.client.request<ShippingMethodsResponse>('GET', '/api/shipping/options?country=BJ&subtotal=6000000');
  const cotonouAbove = above.data.methods.find((method) => method.name === 'Livraison Cotonou');
  assert.equal(cotonouAbove?.priceCents, 0);

  const national = above.data.methods.find((method) => method.name === 'Livraison nationale');
  assert.equal(national?.priceCents, 250_000);
});

test('un pays sans zone active ne propose aucun mode', async () => {
  const response = await ctx.client.request<ShippingMethodsResponse>('GET', '/api/shipping/options?country=US');
  assert.equal(response.status, 200);
  assert.equal(response.data.methods.length, 0);
});

test('la configuration publique signale la devise XOF et le Mobile Money non configuré', async () => {
  const response = await ctx.client.request<{
    settings: { demoNotice: string; codEnabled: boolean; contactEmail: string };
    store: { currency: string; mobileMoneyEnabled: boolean };
  }>('GET', '/api/store');
  assert.equal(response.status, 200);
  assert.match(response.data.settings.demoNotice, /démonstration/i);
  assert.equal(response.data.settings.codEnabled, true);
  assert.equal(response.data.store.currency, 'XOF');
  assert.equal(response.data.store.mobileMoneyEnabled, false);
  assert.equal(response.data.store.mobileMoneyEnabled, false);
});

test('la page d’accueil agrège nouveautés, catégories et sélection', async () => {
  const response = await ctx.client.request<{
    newArrivals: unknown[];
    featured: unknown[];
    categories: unknown[];
    settings: { heroTitle: string };
  }>('GET', '/api/home');
  assert.equal(response.status, 200);
  assert.ok(response.data.newArrivals.length > 0);
  assert.ok(response.data.featured.length > 0);
  assert.equal(response.data.categories.length, 8);
  assert.ok(response.data.settings.heroTitle.length > 0);
});
