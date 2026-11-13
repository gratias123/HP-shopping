import { Router } from 'express';
import { execute, getDb, queryAll, queryOne } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import { nowIso } from '../lib/ids.js';
import { requireAuth } from '../middleware/auth.js';
import { priceExpr } from '../services/catalog.js';

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get('/', (req, res) => {
  const rows = queryAll<Record<string, unknown>>(
    `SELECT p.id, p.slug, p.name, p.reference, p.price_cents, ${priceExpr('p')} AS effective_price_cents,
            p.sale_price_cents, p.sale_ends_at,
            c.name AS category_name, c.slug AS category_slug,
            (SELECT i.url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_url,
            (SELECT i.alt FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_alt,
            (SELECT COALESCE(SUM(v.stock),0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS stock_total
       FROM wishlists w JOIN products p ON p.id = w.product_id JOIN categories c ON c.id = p.category_id
      WHERE w.user_id = ? AND p.status = 'published' AND c.published = 1
      ORDER BY w.created_at DESC`,
    [req.user!.id],
  );
  res.json({
    items: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      reference: String(row.reference),
      priceCents: Number(row.price_cents),
      effectivePriceCents: Number(row.effective_price_cents),
      compareAtCents: Number(row.effective_price_cents) < Number(row.price_cents) ? Number(row.price_cents) : null,
      onSale: Number(row.effective_price_cents) < Number(row.price_cents),
      saleEndsAt: (row.sale_ends_at as string | null) ?? null,
      category: { name: String(row.category_name), slug: String(row.category_slug) },
      image: row.image_url ? { url: String(row.image_url), alt: String(row.image_alt ?? row.name) } : null,
      stockTotal: Number(row.stock_total ?? 0),
    })),
  });
});

favoritesRouter.post('/merge', (req, res) => {
  const ids = Array.isArray(req.body?.productIds) ? req.body.productIds.slice(0, 100) : [];
  const db = getDb();
  let added = 0;
  for (const raw of ids) {
    const id = String(raw);
    const exists = queryOne<{ id: string }>(
      `SELECT p.id FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = ? AND p.status = 'published' AND c.published = 1`,
      [id],
    );
    if (!exists) continue;
    const result = db
      .prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)')
      .run(req.user!.id, id, nowIso());
    added += Number(result.changes);
  }
  res.json({ ok: true, added });
});

favoritesRouter.post('/:productId', (req, res) => {
  const productId = String(req.params.productId);
  const exists = queryOne<{ id: string }>(
    `SELECT p.id FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? AND p.status = 'published' AND c.published = 1`,
    [productId],
  );
  if (!exists) throw ApiError.notFound('Produit introuvable.');
  execute('INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)', [
    req.user!.id,
    productId,
    nowIso(),
  ]);
  res.status(201).json({ ok: true });
});

favoritesRouter.delete('/:productId', (req, res) => {
  execute('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?', [req.user!.id, String(req.params.productId)]);
  res.json({ ok: true });
});
