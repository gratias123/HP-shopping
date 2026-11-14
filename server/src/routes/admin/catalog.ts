import crypto from 'node:crypto';
import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { execute, getDb, queryAll, queryOne, transaction } from '../../db/index.js';
import { ApiError } from '../../lib/errors.js';
import { nowIso, productReference } from '../../lib/ids.js';
import { categorySchema, productSchema, type ProductInput } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';
import { getProductById, listCategories, listProducts } from '../../services/catalog.js';
import { listStockMovements, recordStockMovement } from '../../services/inventory.js';
import { checkVariantStock } from '../../services/notifications.js';
import { audit, uniqueSlug } from './helpers.js';

export const adminCatalogRouter = Router();

function validateProductBusiness(input: ProductInput): void {
  if (input.salePriceCents && input.salePriceCents >= input.priceCents) {
    throw new ApiError(422, 'invalid_sale_price', 'Le prix promotionnel doit être inférieur au prix de vente.');
  }
  if (input.saleStartsAt && input.saleEndsAt && input.saleStartsAt >= input.saleEndsAt) {
    throw new ApiError(422, 'invalid_sale_window', 'La date de fin de promotion doit être postérieure à la date de début.');
  }
  const combos = new Set<string>();
  for (const variant of input.variants) {
    const key = `${variant.size.toLowerCase()}|${variant.color.toLowerCase()}`;
    if (combos.has(key)) {
      throw new ApiError(422, 'duplicate_variant', `La variante ${variant.size} / ${variant.color} est en double.`);
    }
    combos.add(key);
  }
}

function assertSkusAvailable(db: DatabaseSync, variants: ProductInput['variants'], productId: string): void {
  for (const variant of variants) {
    const row = db.prepare('SELECT id, product_id FROM product_variants WHERE sku = ?').get(variant.sku) as
      | { id: string; product_id: string }
      | undefined;
    if (row && row.product_id !== productId) {
      throw new ApiError(422, 'sku_taken', `La référence ${variant.sku} est déjà utilisée par un autre produit.`);
    }
  }
}

function insertImages(db: DatabaseSync, productId: string, images: ProductInput['images']): void {
  images.forEach((image, index) => {
    db.prepare(
      'INSERT INTO product_images (id, product_id, url, alt, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), productId, image.url, image.alt, image.sortOrder ?? index, nowIso());
  });
}

function insertVariants(
  db: DatabaseSync,
  productId: string,
  reference: string,
  variants: ProductInput['variants'],
  actorLabel: string,
): void {
  const now = nowIso();
  for (const variant of variants) {
    const variantId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, stock, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      variantId,
      productId,
      variant.sku,
      variant.size,
      variant.color,
      variant.colorHex || null,
      variant.stock,
      variant.isActive ? 1 : 0,
      now,
      now,
    );
    if (variant.stock > 0) {
      recordStockMovement(db, {
        productId,
        variantId,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        delta: variant.stock,
        stockBefore: 0,
        stockAfter: variant.stock,
        reason: 'initial',
        reference,
        note: 'Création du produit',
        actorLabel,
      });
      checkVariantStock(variantId);
    }
  }
}

adminCatalogRouter.get('/products', requirePermission('catalog:read'), (req, res) => {
  const result = listProducts({
    includeUnpublished: true,
    adminStatus: typeof req.query.status === 'string' ? req.query.status : 'all',
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    page: Number.parseInt(String(req.query.page ?? '1'), 10) || 1,
    perPage: Number.parseInt(String(req.query.perPage ?? '20'), 10) || 20,
    sort: 'newest',
  });
  const counts = queryAll<{ status: string; total: number }>('SELECT status, COUNT(*) AS total FROM products GROUP BY status');
  const statusCounts: Record<string, number> = { draft: 0, published: 0, archived: 0 };
  for (const row of counts) statusCounts[row.status] = Number(row.total);
  res.json({ ...result, statusCounts });
});

adminCatalogRouter.get('/products/:id', requirePermission('catalog:read'), (req, res) => {
  const product = getProductById(String(req.params.id));
  if (!product) throw ApiError.notFound('Produit introuvable.');
  res.json({ product });
});

adminCatalogRouter.get('/products/:id/stock-movements', requirePermission('catalog:read'), (req, res) => {
  const id = String(req.params.id);
  const product = queryOne<{ id: string }>('SELECT id FROM products WHERE id = ?', [id]);
  if (!product) throw ApiError.notFound('Produit introuvable.');
  const limit = Number.parseInt(String(req.query.limit ?? '100'), 10) || 100;
  res.json({ movements: listStockMovements(id, limit) });
});

adminCatalogRouter.post('/products', requirePermission('catalog:write'), (req, res) => {
  const input = productSchema.parse(req.body);
  validateProductBusiness(input);
  const id = crypto.randomUUID();
  const actorLabel = req.user!.fullName || req.user!.email;
  transaction((db) => {
    const category = db.prepare('SELECT published FROM categories WHERE id = ?').get(input.categoryId) as
      | { published: number }
      | undefined;
    if (!category) throw new ApiError(422, 'category_missing', 'Catégorie introuvable.');
    if (input.status === 'published' && Number(category.published) !== 1) {
      throw new ApiError(422, 'category_unpublished', 'Publiez la catégorie avant de publier ce produit.');
    }
    const reference = input.reference?.trim() || productReference();
    if (db.prepare('SELECT 1 FROM products WHERE reference = ?').get(reference)) {
      throw new ApiError(422, 'reference_taken', 'Cette référence produit est déjà utilisée.');
    }
    assertSkusAvailable(db, input.variants, id);
    const now = nowIso();
    db.prepare(
      `INSERT INTO products (id, reference, slug, name, short_description, description, composition, care, category_id,
        price_cents, sale_price_cents, sale_starts_at, sale_ends_at, status, is_featured, gender, collection, low_stock_alert, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      reference,
      uniqueSlug('products', input.slug || input.name),
      input.name,
      input.shortDescription,
      input.description,
      input.composition || null,
      input.care || null,
      input.categoryId,
      input.priceCents,
      input.salePriceCents ?? null,
      input.saleStartsAt ?? null,
      input.saleEndsAt ?? null,
      input.status,
      input.isFeatured ? 1 : 0,
      input.gender,
      input.collection || null,
      input.lowStockAlert ?? null,
      now,
      now,
    );
    insertImages(db, id, input.images);
    insertVariants(db, id, reference, input.variants, actorLabel);
  });
  audit(req.user!.id, 'product.create', 'product', id, { name: input.name });
  res.status(201).json({ product: getProductById(id) });
});

adminCatalogRouter.put('/products/:id', requirePermission('catalog:write'), (req, res) => {
  const id = String(req.params.id);
  const input = productSchema.parse(req.body);
  validateProductBusiness(input);
  const actorLabel = req.user!.fullName || req.user!.email;
  transaction((db) => {
    const existing = db.prepare('SELECT id, reference FROM products WHERE id = ?').get(id) as
      | { id: string; reference: string }
      | undefined;
    if (!existing) throw ApiError.notFound('Produit introuvable.');
    const category = db.prepare('SELECT published FROM categories WHERE id = ?').get(input.categoryId) as
      | { published: number }
      | undefined;
    if (!category) throw new ApiError(422, 'category_missing', 'Catégorie introuvable.');
    if (input.status === 'published' && Number(category.published) !== 1) {
      throw new ApiError(422, 'category_unpublished', 'Publiez la catégorie avant de publier ce produit.');
    }
    const reference = input.reference?.trim() || existing.reference;
    const refOwner = db.prepare('SELECT id FROM products WHERE reference = ?').get(reference) as { id: string } | undefined;
    if (refOwner && refOwner.id !== id) {
      throw new ApiError(422, 'reference_taken', 'Cette référence produit est déjà utilisée.');
    }
    assertSkusAvailable(db, input.variants, id);

    const slug = uniqueSlug('products', input.slug || input.name, id);
    db.prepare(
      `UPDATE products SET reference = ?, slug = ?, name = ?, short_description = ?, description = ?, composition = ?,
        care = ?, category_id = ?, price_cents = ?, sale_price_cents = ?, sale_starts_at = ?, sale_ends_at = ?,
        status = ?, is_featured = ?, gender = ?, collection = ?, low_stock_alert = ?, updated_at = ? WHERE id = ?`,
    ).run(
      reference,
      slug,
      input.name,
      input.shortDescription,
      input.description,
      input.composition || null,
      input.care || null,
      input.categoryId,
      input.priceCents,
      input.salePriceCents ?? null,
      input.saleStartsAt ?? null,
      input.saleEndsAt ?? null,
      input.status,
      input.isFeatured ? 1 : 0,
      input.gender,
      input.collection || null,
      input.lowStockAlert ?? null,
      nowIso(),
      id,
    );

    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
    insertImages(db, id, input.images);

    const existingVariants = db
      .prepare('SELECT id, sku, size, color, stock FROM product_variants WHERE product_id = ?')
      .all(id) as Array<{ id: string; sku: string; size: string; color: string; stock: number }>;
    const existingById = new Map(existingVariants.map((row) => [row.id, row]));
    const existingIds = new Set(existingVariants.map((row) => row.id));
    const keepIds = new Set(input.variants.map((variant) => variant.id).filter((value): value is string => Boolean(value)));
    for (const variantId of keepIds) {
      if (!existingIds.has(variantId)) {
        throw new ApiError(422, 'variant_unknown', 'Une variante transmise n’appartient pas à ce produit.');
      }
    }
    for (const variantId of existingIds) {
      if (!keepIds.has(variantId)) {
        const previous = existingById.get(variantId);
        if (previous && previous.stock > 0) {
          recordStockMovement(db, {
            productId: id,
            variantId,
            sku: previous.sku,
            size: previous.size,
            color: previous.color,
            delta: -previous.stock,
            stockBefore: previous.stock,
            stockAfter: 0,
            reason: 'adjustment',
            reference,
            note: 'Variante supprimée depuis la fiche produit',
            actorLabel,
          });
        }
        db.prepare('DELETE FROM product_variants WHERE id = ?').run(variantId);
      }
    }
    const now = nowIso();
    for (const variant of input.variants) {
      if (variant.id) {
        const previous = existingById.get(variant.id);
        db.prepare(
          `UPDATE product_variants SET sku = ?, size = ?, color = ?, color_hex = ?, stock = ?, is_active = ?, updated_at = ?
            WHERE id = ? AND product_id = ?`,
        ).run(
          variant.sku,
          variant.size,
          variant.color,
          variant.colorHex || null,
          variant.stock,
          variant.isActive ? 1 : 0,
          now,
          variant.id,
          id,
        );
        if (previous && previous.stock !== variant.stock) {
          recordStockMovement(db, {
            productId: id,
            variantId: variant.id,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            delta: variant.stock - previous.stock,
            stockBefore: previous.stock,
            stockAfter: variant.stock,
            reason: 'adjustment',
            reference,
            note: 'Modification manuelle depuis la fiche produit',
            actorLabel,
          });
          checkVariantStock(variant.id);
        }
      } else {
        const variantId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, stock, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          variantId,
          id,
          variant.sku,
          variant.size,
          variant.color,
          variant.colorHex || null,
          variant.stock,
          variant.isActive ? 1 : 0,
          now,
          now,
        );
        if (variant.stock > 0) {
          recordStockMovement(db, {
            productId: id,
            variantId,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            delta: variant.stock,
            stockBefore: 0,
            stockAfter: variant.stock,
            reason: 'initial',
            reference,
            note: 'Création de la variante',
            actorLabel,
          });
          checkVariantStock(variantId);
        }
      }
    }
  });
  audit(req.user!.id, 'product.update', 'product', id, { name: input.name, status: input.status });
  res.json({ product: getProductById(id) });
});

adminCatalogRouter.patch('/products/:id/status', requirePermission('catalog:write'), (req, res) => {
  const id = String(req.params.id);
  const status = String(req.body?.status ?? '');
  if (!['draft', 'published', 'archived'].includes(status)) {
    throw ApiError.badRequest('Statut invalide.');
  }
  const product = queryOne<{ category_published: number }>(
    'SELECT c.published AS category_published FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?',
    [id],
  );
  if (!product) throw ApiError.notFound('Produit introuvable.');
  if (status === 'published' && Number(product.category_published) !== 1) {
    throw new ApiError(422, 'category_unpublished', 'Publiez d’abord la catégorie de ce produit.');
  }
  execute('UPDATE products SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), id]);
  audit(req.user!.id, 'product.status', 'product', id, { status });
  res.json({ product: getProductById(id) });
});

adminCatalogRouter.delete('/products/:id', requirePermission('catalog:write'), (req, res) => {
  const id = String(req.params.id);
  const exists = queryOne<{ id: string }>('SELECT id FROM products WHERE id = ?', [id]);
  if (!exists) throw ApiError.notFound('Produit introuvable.');
  execute("UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?", [nowIso(), id]);
  audit(req.user!.id, 'product.archive', 'product', id, {});
  res.json({ ok: true, archived: true });
});

// --- Catégories -------------------------------------------------------------

adminCatalogRouter.get('/categories', requirePermission('catalog:read'), (_req, res) => {
  res.json({ categories: listCategories({ includeUnpublished: true }) });
});

adminCatalogRouter.post('/categories', requirePermission('catalog:write'), (req, res) => {
  const input = categorySchema.parse(req.body);
  const id = crypto.randomUUID();
  const slug = uniqueSlug('categories', input.slug || input.name);
  execute(
    `INSERT INTO categories (id, slug, name, description, image_url, image_alt, parent_id, sort_order, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      input.name,
      input.description,
      input.imageUrl || null,
      input.imageAlt || null,
      input.parentId ?? null,
      input.sortOrder,
      input.published ? 1 : 0,
    ],
  );
  audit(req.user!.id, 'category.create', 'category', id, { name: input.name });
  res.status(201).json({ categories: listCategories({ includeUnpublished: true }) });
});

adminCatalogRouter.put('/categories/:id', requirePermission('catalog:write'), (req, res) => {
  const id = String(req.params.id);
  const input = categorySchema.parse(req.body);
  const exists = queryOne<{ id: string }>('SELECT id FROM categories WHERE id = ?', [id]);
  if (!exists) throw ApiError.notFound('Catégorie introuvable.');
  if (input.parentId === id) throw ApiError.badRequest('Une catégorie ne peut pas être son propre parent.');
  const slug = uniqueSlug('categories', input.slug || input.name, id);
  execute(
    `UPDATE categories SET slug = ?, name = ?, description = ?, image_url = ?, image_alt = ?, parent_id = ?, sort_order = ?,
      published = ?, updated_at = ? WHERE id = ?`,
    [
      slug,
      input.name,
      input.description,
      input.imageUrl || null,
      input.imageAlt || null,
      input.parentId ?? null,
      input.sortOrder,
      input.published ? 1 : 0,
      nowIso(),
      id,
    ],
  );
  audit(req.user!.id, 'category.update', 'category', id, { name: input.name });
  res.json({ categories: listCategories({ includeUnpublished: true }) });
});

adminCatalogRouter.delete('/categories/:id', requirePermission('catalog:write'), (req, res) => {
  const id = String(req.params.id);
  const usage = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [id]);
  if (Number(usage?.total ?? 0) > 0) {
    throw ApiError.conflict('Cette catégorie contient des produits. Déplacez-les avant de la supprimer.');
  }
  const children = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM categories WHERE parent_id = ?', [id]);
  if (Number(children?.total ?? 0) > 0) {
    throw ApiError.conflict('Cette catégorie a des sous-catégories. Supprimez-les ou rattachez-les d’abord.');
  }
  execute('DELETE FROM categories WHERE id = ?', [id]);
  audit(req.user!.id, 'category.delete', 'category', id, {});
  res.json({ ok: true });
});
