import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createTestContext, type TestContext } from './helpers.js';

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  productCount: number;
  published: boolean;
}
interface Card {
  slug: string;
  gender: string;
  collection: string | null;
  category: { slug: string };
}

let ctx: TestContext;

before(async () => {
  ctx = await createTestContext();
});

after(async () => {
  await ctx.stop();
});

test('les trois rayons et leurs sous-catégories existent', async () => {
  const response = await ctx.client.request<{ categories: CategoryRow[] }>('GET', '/api/categories');
  assert.equal(response.status, 200);
  const all = response.data.categories;
  const groups = all.filter((entry) => entry.parentId === null);
  assert.deepEqual(
    groups.map((entry) => entry.slug).sort(),
    ['mode-femme', 'mode-homme', 'sport-streetwear'],
  );
  const childrenOf = (slug: string) => {
    const group = groups.find((entry) => entry.slug === slug)!;
    return all.filter((entry) => entry.parentId === group.id).map((entry) => entry.name);
  };
  assert.equal(childrenOf('mode-homme').length, 13);
  assert.equal(childrenOf('mode-femme').length, 10);
  assert.equal(childrenOf('sport-streetwear').length, 6);
  assert.ok(childrenOf('mode-homme').includes('Chaussures de basketball'));
  assert.ok(childrenOf('sport-streetwear').includes('Tenues basketball'));
});

test('le compteur d’un rayon inclut ses sous-catégories', async () => {
  const { data } = await ctx.client.request<{ categories: CategoryRow[] }>('GET', '/api/categories');
  const homme = data.categories.find((entry) => entry.slug === 'mode-homme')!;
  const direct = data.categories.filter((entry) => entry.parentId === homme.id).reduce((sum, entry) => sum + entry.productCount, 0);
  assert.equal(homme.productCount, direct);
  assert.ok(homme.productCount > 0);
});

test('filtrer sur un rayon renvoie les produits de ses sous-catégories', async () => {
  const response = await ctx.client.request<{ items: Card[] }>('GET', '/api/products?category=mode-homme&perPage=50');
  assert.equal(response.status, 200);
  assert.ok(response.data.items.length > 0);
  assert.ok(response.data.items.every((item) => item.category.slug.startsWith('homme-')));
});

test('le filtre genre inclut les articles mixtes et exclut l’autre genre', async () => {
  const femme = await ctx.client.request<{ items: Card[] }>('GET', '/api/products?gender=femme&perPage=50');
  assert.equal(femme.status, 200);
  assert.ok(femme.data.items.every((item) => item.gender === 'femme' || item.gender === 'mixte'));
  const homme = await ctx.client.request<{ items: Card[] }>('GET', '/api/products?gender=homme&perPage=50');
  assert.ok(homme.data.items.some((item) => item.gender === 'homme'));
  assert.ok(homme.data.items.every((item) => item.gender !== 'femme'));
});

test('les collections viennent des produits publiés et filtrent le catalogue', async () => {
  const collections = await ctx.client.request<{ collections: Array<{ name: string; productCount: number }> }>('GET', '/api/collections');
  assert.equal(collections.status, 200);
  assert.ok(collections.data.collections.length > 0);
  const first = collections.data.collections[0];
  const filtered = await ctx.client.request<{ items: Card[]; total: number }>(
    'GET',
    `/api/products?collection=${encodeURIComponent(first.name.toUpperCase())}&perPage=50`,
  );
  assert.equal(filtered.data.total, first.productCount);
  assert.ok(filtered.data.items.every((item) => item.collection?.toLowerCase() === first.name.toLowerCase()));
});

test('la page d’accueil expose rayons, sections et collections', async () => {
  const { data } = await ctx.client.request<{
    groups: CategoryRow[];
    sections: { homme: Card[]; femme: Card[]; sneakers: Card[] };
    collections: Array<{ name: string }>;
  }>('GET', '/api/home');
  assert.equal(data.groups.length, 3);
  assert.ok(data.sections.homme.length > 0);
  assert.ok(data.sections.sneakers.length > 0);
  assert.ok(data.sections.femme.length > 0);
  assert.ok(data.collections.length > 0);
});
