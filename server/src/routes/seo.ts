import { Router } from 'express';
import { config } from '../config.js';
import { queryAll } from '../db/index.js';

export const seoRouter = Router();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(path: string): string {
  return `${config.appUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

seoRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api',
      'Disallow: /panier',
      'Disallow: /commander',
      'Disallow: /compte',
      `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
      '',
    ].join('\n'),
  );
});

seoRouter.get('/sitemap.xml', (_req, res) => {
  const products = queryAll<{ slug: string; updated_at: string }>(
    "SELECT slug, updated_at FROM products WHERE status = 'published' ORDER BY updated_at DESC",
  );
  const categories = queryAll<{ slug: string; updated_at: string }>(
    "SELECT slug, updated_at FROM categories WHERE published = 1 ORDER BY sort_order, name",
  );

  const staticPaths = [
    '/',
    '/boutique',
    '/favoris',
    '/suivi',
    '/contact',
    '/faq',
    '/livraison',
    '/cgv',
    '/confidentialite',
    '/mentions-legales',
  ];

  const urlEntries = [
    ...staticPaths.map((path) => ({ loc: absoluteUrl(path), lastmod: null as string | null })),
    ...categories.map((category) => ({
      loc: absoluteUrl(`/categories/${category.slug}`),
      lastmod: category.updated_at,
    })),
    ...products.map((product) => ({
      loc: absoluteUrl(`/produit/${product.slug}`),
      lastmod: product.updated_at,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries.map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
  ].join('\n');

  res.type('application/xml').send(body);
});
