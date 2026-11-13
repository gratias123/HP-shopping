import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestContext } from './helpers.js';

const ctx = await createTestContext();
test.after(async () => ctx.stop());

test('robots.txt interdit l’administration et indique le sitemap', async () => {
  const response = await ctx.client.request<string>('GET', '/robots.txt');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/plain/);
  assert.match(response.data, /Disallow: \/admin/);
  assert.match(response.data, /Sitemap: .*\/sitemap\.xml/);
});

test('le sitemap contient les pages publiques et les produits publiés', async () => {
  const response = await ctx.client.request<string>('GET', '/sitemap.xml');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/xml/);
  assert.match(response.data, /<urlset/);
  assert.match(response.data, /\/boutique<\/loc>/);
  assert.match(response.data, /\/produit\/hoodie-molleton-epais<\/loc>/);
  assert.doesNotMatch(response.data, /\/admin<\/loc>/);
});
