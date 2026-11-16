import crypto from 'node:crypto';
import { execute, queryAll, queryOne, type SqlPrimitive } from '../db/index.js';
import { nowIso } from '../lib/ids.js';
import { getSettings } from './settings.js';

const NOW = () => `'${nowIso()}'`;

/** Prix effectif : prix promo si la fenêtre de promotion est active, sinon prix de vente. */
export const priceExpr = (alias = 'p') => `(CASE
  WHEN ${alias}.sale_price_cents IS NOT NULL
   AND (${alias}.sale_starts_at IS NULL OR ${alias}.sale_starts_at <= ${NOW()})
   AND (${alias}.sale_ends_at IS NULL OR ${alias}.sale_ends_at >= ${NOW()})
  THEN ${alias}.sale_price_cents
  ELSE ${alias}.price_cents END)`;

const CARD_COLUMNS = `
  p.id, p.reference, p.slug, p.name, p.short_description, p.price_cents, p.sale_price_cents,
  p.sale_starts_at, p.sale_ends_at, p.status, p.is_featured, p.gender, p.collection, p.created_at, p.low_stock_alert,
  ${priceExpr('p')} AS effective_price_cents,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
  (SELECT i.url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.created_at LIMIT 1) AS image_url,
  (SELECT i.alt FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.created_at LIMIT 1) AS image_alt,
  (SELECT COALESCE(SUM(v.stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS stock_total,
  (SELECT group_concat(DISTINCT v.size) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS sizes,
  (SELECT group_concat(DISTINCT v.color) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS colors,
  (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'refunded')) AS units_sold
`;

interface CardRow {
  id: string;
  reference: string;
  slug: string;
  name: string;
  short_description: string;
  price_cents: number;
  sale_price_cents: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  status: string;
  is_featured: number;
  created_at: string;
  low_stock_alert: number | null;
  effective_price_cents: number;
  category_id: string;
  category_name: string;
  category_slug: string;
  image_url: string | null;
  image_alt: string | null;
  stock_total: number;
  sizes: string | null;
  colors: string | null;
  units_sold: number;
  gender: string;
  collection: string | null;
}

export interface ProductCard {
  id: string;
  reference: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceCents: number;
  effectivePriceCents: number;
  compareAtCents: number | null;
  onSale: boolean;
  saleEndsAt: string | null;
  status: string;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  image: { url: string; alt: string } | null;
  stockTotal: number;
  sizes: string[];
  colors: string[];
  unitsSold: number;
  gender: 'homme' | 'femme' | 'mixte';
  collection: string | null;
  createdAt: string;
}

function mapCard(row: CardRow): ProductCard {
  const onSale = row.effective_price_cents < row.price_cents;
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    priceCents: row.price_cents,
    effectivePriceCents: row.effective_price_cents,
    compareAtCents: onSale ? row.price_cents : null,
    onSale,
    saleEndsAt: onSale ? row.sale_ends_at : null,
    status: row.status,
    isFeatured: row.is_featured === 1,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    image: row.image_url ? { url: row.image_url, alt: row.image_alt ?? row.name } : null,
    stockTotal: Number(row.stock_total ?? 0),
    sizes: row.sizes ? row.sizes.split(',') : [],
    colors: row.colors ? row.colors.split(',') : [],
    unitsSold: Number(row.units_sold ?? 0),
    gender: (['homme', 'femme', 'mixte'].includes(row.gender) ? row.gender : 'mixte') as 'homme' | 'femme' | 'mixte',
    collection: row.collection ?? null,
    createdAt: row.created_at,
  };
}

export interface ProductQuery {
  q?: string;
  category?: string;
  /** Plusieurs catégories (slugs) : utile pour les sections d'accueil transversales. */
  categories?: string[];
  /** Public : « homme » ou « femme » incluent aussi les articles mixtes. */
  gender?: 'homme' | 'femme' | 'mixte';
  collection?: string;
  sizes?: string[];
  colors?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  featuredOnly?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'name' | 'bestsellers';
  page?: number;
  perPage?: number;
  includeUnpublished?: boolean;
  /** Filtre de statut réservé à l'administration ('all' inclut les archives). */
  adminStatus?: string;
}

const SORTS: Record<string, string> = {
  newest: 'p.created_at DESC',
  'price-asc': 'effective_price_cents ASC, p.name ASC',
  'price-desc': 'effective_price_cents DESC, p.name ASC',
  name: 'p.name ASC',
  bestsellers: 'units_sold DESC, p.created_at DESC',
};

export function listProducts(query: ProductQuery = {}): { items: ProductCard[]; total: number; page: number; perPage: number; pages: number } {
  const where: string[] = [];
  const params: SqlPrimitive[] = [];

  if (!query.includeUnpublished) {
    where.push(`p.status = 'published'`, `c.published = 1`);
  } else if (query.adminStatus && query.adminStatus !== 'all') {
    where.push('p.status = ?');
    params.push(query.adminStatus);
  } else if (query.adminStatus !== 'all') {
    where.push(`p.status != 'archived'`);
  }

  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\' OR p.short_description LIKE ? ESCAPE '\\')`);
    params.push(term, term, term);
  }
  if (query.category) {
    where.push(`(c.slug = ? OR c.parent_id = (SELECT id FROM categories WHERE slug = ?))`);
    params.push(query.category, query.category);
  }
  if (query.categories?.length) {
    where.push(`c.slug IN (${query.categories.map(() => '?').join(',')})`);
    params.push(...query.categories);
  }
  if (query.gender) {
    if (query.gender === 'mixte') where.push(`p.gender = 'mixte'`);
    else {
      where.push(`(p.gender = ? OR p.gender = 'mixte')`);
      params.push(query.gender);
    }
  }
  if (query.collection) {
    // SQLite ne met en minuscules que l'ASCII : on retrouve le nom exact en JS (accents compris).
    const wanted = query.collection.trim().toLocaleLowerCase('fr');
    const canonical =
      queryAll<{ name: string }>('SELECT DISTINCT collection AS name FROM products WHERE collection IS NOT NULL')
        .map((row) => row.name)
        .find((name) => name.trim().toLocaleLowerCase('fr') === wanted) ?? query.collection;
    where.push('p.collection = ?');
    params.push(canonical);
  }
  if (query.sizes?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1 AND v.stock > 0 AND v.size IN (${query.sizes.map(() => '?').join(',')}))`,
    );
    params.push(...query.sizes);
  }
  if (query.colors?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1 AND v.stock > 0 AND lower(v.color) IN (${query.colors.map(() => '?').join(',')}))`,
    );
    params.push(...query.colors.map((c) => c.toLowerCase()));
  }
  if (query.minPriceCents !== undefined) {
    where.push(`${priceExpr('p')} >= ?`);
    params.push(query.minPriceCents);
  }
  if (query.maxPriceCents !== undefined) {
    where.push(`${priceExpr('p')} <= ?`);
    params.push(query.maxPriceCents);
  }
  if (query.inStockOnly) {
    where.push(`(SELECT COALESCE(SUM(v.stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) > 0`);
  }
  if (query.onSaleOnly) {
    where.push(`(${priceExpr('p')} < p.price_cents)`);
  }
  if (query.featuredOnly) {
    where.push('p.is_featured = 1');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRow = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`,
    params,
  );

  const perPage = Math.min(Math.max(query.perPage ?? 12, 1), 48);
  const page = Math.max(query.page ?? 1, 1);
  const offset = (page - 1) * perPage;
  const orderBy = SORTS[query.sort ?? 'newest'] ?? SORTS.newest;

  const items = queryAll<CardRow>(
    `SELECT ${CARD_COLUMNS}
       FROM products p JOIN categories c ON c.id = p.category_id
       ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [...params, perPage, offset],
  ).map(mapCard);

  const total = Number(countRow?.total ?? 0);
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  stock: number;
  isActive: boolean;
}

export interface ProductDetail extends ProductCard {
  description: string;
  composition: string | null;
  care: string | null;
  salePriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAtRaw: string | null;
  lowStockAlert: number | null;
  images: Array<{ id: string; url: string; alt: string; sortOrder: number }>;
  variants: ProductVariant[];
  categoryPublished: boolean;
}

export function getProductBySlug(slug: string, options: { includeUnpublished?: boolean } = {}): ProductDetail | null {
  const row = queryOne<CardRow & Record<string, unknown>>(
    `SELECT ${CARD_COLUMNS}, p.description, p.composition, p.care, c.published AS category_published
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ?`,
    [slug],
  );
  if (!row) return null;
  if (!options.includeUnpublished && (row.status !== 'published' || Number(row.category_published) !== 1)) return null;
  return buildDetail(row);
}

export function getProductById(id: string): ProductDetail | null {
  const row = queryOne<CardRow & Record<string, unknown>>(
    `SELECT ${CARD_COLUMNS}, p.description, p.composition, p.care, c.published AS category_published
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?`,
    [id],
  );
  return row ? buildDetail(row) : null;
}

function buildDetail(row: CardRow & Record<string, unknown>): ProductDetail {
  const images = queryAll<{ id: string; url: string; alt: string; sort_order: number }>(
    'SELECT id, url, alt, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, created_at',
    [row.id],
  ).map((image) => ({ id: image.id, url: image.url, alt: image.alt, sortOrder: image.sort_order }));
  const variants = queryAll<{
    id: string;
    sku: string;
    size: string;
    color: string;
    color_hex: string | null;
    stock: number;
    is_active: number;
  }>('SELECT id, sku, size, color, color_hex, stock, is_active FROM product_variants WHERE product_id = ? ORDER BY size, color', [
    row.id,
  ]).map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    colorHex: variant.color_hex,
    stock: variant.stock,
    isActive: variant.is_active === 1,
  }));
  return {
    ...mapCard(row),
    description: String(row.description ?? ''),
    composition: (row.composition as string | null) ?? null,
    care: (row.care as string | null) ?? null,
    salePriceCents: (row.sale_price_cents as number | null) ?? null,
    saleStartsAt: (row.sale_starts_at as string | null) ?? null,
    saleEndsAtRaw: (row.sale_ends_at as string | null) ?? null,
    lowStockAlert: (row.low_stock_alert as number | null) ?? null,
    images,
    variants,
    categoryPublished: Number(row.category_published) === 1,
  };
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  parentId: string | null;
  sortOrder: number;
  published: boolean;
  productCount: number;
}

export function listCategories(options: { includeUnpublished?: boolean } = {}): CategoryDto[] {
  const rows = queryAll<Record<string, SqlPrimitive>>(
    `SELECT c.id, c.slug, c.name, c.description, c.image_url, c.image_alt, c.parent_id, c.sort_order, c.published,
       (SELECT COUNT(*) FROM products p
         WHERE (p.category_id = c.id OR p.category_id IN (SELECT sc.id FROM categories sc WHERE sc.parent_id = c.id))
           AND p.status = 'published') AS product_count,
       (SELECT i.url FROM products p JOIN product_images i ON i.product_id = p.id
         WHERE (p.category_id = c.id OR p.category_id IN (SELECT sc.id FROM categories sc WHERE sc.parent_id = c.id))
           AND p.status = 'published'
         ORDER BY p.created_at DESC, i.sort_order LIMIT 1) AS fallback_image
     FROM categories c
     ${options.includeUnpublished ? '' : 'WHERE c.published = 1'}
     ORDER BY c.sort_order, c.name`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ''),
    imageUrl: (row.image_url as string | null) ?? (row.fallback_image as string | null) ?? null,
    imageAlt: (row.image_alt as string | null) ?? null,
    parentId: (row.parent_id as string | null) ?? null,
    sortOrder: Number(row.sort_order),
    published: Number(row.published) === 1,
    productCount: Number(row.product_count ?? 0),
  }));
}

export interface CollectionDto {
  name: string;
  productCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
}

/** Collections réellement renseignées sur des produits publiés (aucune donnée fictive). */
export function listCollections(): CollectionDto[] {
  const rows = queryAll<Record<string, SqlPrimitive>>(
    `SELECT p.collection AS name, COUNT(*) AS product_count,
       (SELECT i.url FROM products p2 JOIN product_images i ON i.product_id = p2.id
         WHERE p2.collection = p.collection COLLATE NOCASE AND p2.status = 'published'
         ORDER BY p2.created_at DESC, i.sort_order LIMIT 1) AS image_url,
       (SELECT i.alt FROM products p2 JOIN product_images i ON i.product_id = p2.id
         WHERE p2.collection = p.collection COLLATE NOCASE AND p2.status = 'published'
         ORDER BY p2.created_at DESC, i.sort_order LIMIT 1) AS image_alt
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.published = 1 AND p.collection IS NOT NULL AND trim(p.collection) != ''
      GROUP BY p.collection COLLATE NOCASE
      ORDER BY MAX(p.created_at) DESC`,
  );
  return rows.map((row) => ({
    name: String(row.name),
    productCount: Number(row.product_count),
    imageUrl: (row.image_url as string | null) ?? null,
    imageAlt: (row.image_alt as string | null) ?? null,
  }));
}

export function getCategoryBySlug(slug: string): CategoryDto | null {
  return listCategories({ includeUnpublished: true }).find((category) => category.slug === slug) ?? null;
}

export function listFacets() {
  const sizes = queryAll<{ size: string }>(
    `SELECT DISTINCT v.size FROM product_variants v
       JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.published = 1 AND v.is_active = 1 AND v.stock > 0
      ORDER BY v.size`,
  ).map((row) => row.size);
  const colors = queryAll<{ color: string; color_hex: string | null }>(
    `SELECT v.color, MAX(v.color_hex) AS color_hex FROM product_variants v
       JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.published = 1 AND v.is_active = 1 AND v.stock > 0
      GROUP BY v.color ORDER BY v.color`,
  ).map((row) => ({ name: row.color, hex: row.color_hex }));
  const bounds = queryOne<{ min_price: number | null; max_price: number | null }>(
    `SELECT MIN(${priceExpr('p')}) AS min_price, MAX(${priceExpr('p')}) AS max_price
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.published = 1`,
  );
  return {
    sizes,
    colors,
    priceMinCents: Number(bounds?.min_price ?? 0),
    priceMaxCents: Number(bounds?.max_price ?? 0),
  };
}

export function listBestSellers(limit = 4): ProductCard[] {
  const rows = queryAll<CardRow>(
    `SELECT ${CARD_COLUMNS}
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND c.published = 1
        AND (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
              WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'refunded')) > 0
      ORDER BY units_sold DESC, p.name ASC
      LIMIT ?`,
    [limit],
  );
  return rows.map(mapCard);
}

export function hasSalesData(): boolean {
  const row = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled', 'refunded')`,
  );
  return Number(row?.total ?? 0) > 0;
}

export function homePayload() {
  const settings = getSettings();
  const newArrivals = listProducts({ perPage: 4, sort: 'newest' }).items;
  const featured = listProducts({ perPage: 7, featuredOnly: true, sort: 'newest' }).items;
  const sale = listProducts({ perPage: 4, onSaleOnly: true, sort: 'newest' }).items;
  const allCategories = listCategories();
  const hasChildren = (id: string) => allCategories.some((entry) => entry.parentId === id);
  const groups = allCategories.filter((entry) => entry.parentId === null && hasChildren(entry.id));
  const categories = allCategories.filter((entry) => entry.parentId !== null || !hasChildren(entry.id)).slice(0, 8);
  const sections = {
    homme: listProducts({ category: 'mode-homme', perPage: 4, sort: 'newest' }).items,
    femme: listProducts({ category: 'mode-femme', perPage: 4, sort: 'newest' }).items,
    sneakers: listProducts({
      categories: [
        'homme-sneakers',
        'femme-sneakers',
        'homme-chaussures-basketball',
        'sport-chaussures-sportives',
        'sport-tenues-basketball',
      ],
      perPage: 4,
      sort: 'newest',
    }).items,
  };
  const bestSellers = hasSalesData() ? listBestSellers(4) : [];
  return {
    settings,
    newArrivals,
    featured: featured.length ? featured : newArrivals,
    sale,
    categories,
    groups,
    sections,
    collections: listCollections().slice(0, 4),
    bestSellers,
  };
}

/** Incrémente le compteur d'utilisation d'un code promo (appelé dans la transaction commande). */
export function incrementPromoUsage(id: string, email: string, orderId: string, userId: string | null): void {
  execute('UPDATE promo_codes SET used_count = used_count + 1, updated_at = ? WHERE id = ?', [nowIso(), id]);
  execute('INSERT INTO promo_redemptions (id, promo_id, order_id, user_id, email) VALUES (?, ?, ?, ?, ?)', [
    crypto.randomUUID(),
    id,
    orderId,
    userId,
    email,
  ]);
}
