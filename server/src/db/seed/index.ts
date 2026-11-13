import crypto from 'node:crypto';
import { execute, queryOne } from '../index.js';
import { nowIso } from '../../lib/ids.js';

interface DemoVariant {
  size: string;
  color: string;
  colorHex: string;
  stock: number;
}

interface DemoProduct {
  name: string;
  slug: string;
  reference: string;
  category: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  salePriceCents?: number;
  isFeatured?: boolean;
  image: string;
  imageAlt: string;
  composition: string;
  care: string;
  variants: DemoVariant[];
}

const CATEGORIES = [
  {
    slug: 'ensembles-jogging',
    name: 'Ensembles & survêtements',
    description: 'Ensembles coordonnés, joggings et survêtements pensés pour le quotidien urbain.',
    image: '/media/product-ensemble.jpg',
  },
  {
    slug: 'sneakers',
    name: 'Sneakers lifestyle',
    description: 'Silhouettes basses et montantes pour accompagner le quotidien, du matin au soir.',
    image: '/media/product-sneaker.jpg',
  },
  {
    slug: 'basketball',
    name: 'Chaussures de basketball',
    description: 'Chaussures montantes, maintien renforcé et semelles conçues pour le parquet.',
    image: '/media/product-basket.jpg',
  },
  {
    slug: 'tshirts',
    name: 'T-shirts, polos & chemises',
    description: 'Coupes droites, matières épaisses et finitions nettes pour superposer sans effort.',
    image: '/media/product-tee.jpg',
  },
  {
    slug: 'jeans-pantalons',
    name: 'Jeans, pantalons & shorts',
    description: 'Denim, cargos et shorts : des basiques structurés qui tiennent la silhouette.',
    image: '/media/product-cargo.jpg',
  },
  {
    slug: 'sweats-hoodies',
    name: 'Sweats & hoodies',
    description: 'Molletons épais, coupes amples et détails discrets pour les journées fraîches.',
    image: '/media/product-hoodie.jpg',
  },
  {
    slug: 'vestes-streetwear',
    name: 'Vestes & varsity',
    description: 'Vestes bombers, varsity et couches intermédiaires au caractère affirmé.',
    image: '/media/product-veste.jpg',
  },
  {
    slug: 'accessoires',
    name: 'Sacs, casquettes & accessoires',
    description: 'Casquettes, ceintures et sacs pour compléter le look sans surcharger.',
    image: '/media/product-cap.jpg',
  },
];

const CLOTHING = (stock = 8): DemoVariant[] => [
  { size: 'S', color: 'Noir', colorHex: '#171717', stock },
  { size: 'M', color: 'Noir', colorHex: '#171717', stock: stock + 4 },
  { size: 'L', color: 'Noir', colorHex: '#171717', stock: 3 },
  { size: 'XL', color: 'Noir', colorHex: '#171717', stock: 0 },
  { size: 'M', color: 'Écru', colorHex: '#F4F1E9', stock: 5 },
  { size: 'L', color: 'Écru', colorHex: '#F4F1E9', stock: 2 },
];

const PRODUCTS: DemoProduct[] = [
  {
    name: 'Hoodie molleton épais',
    slug: 'hoodie-molleton-epais',
    reference: 'DEMO-HD01',
    category: 'sweats-hoodies',
    shortDescription: 'Molleton gratté 420 g, coupe ample, poche kangourou.',
    description:
      "Hoodie à capuche en molleton gratté épais, coupe ample et épaules tombantes. Bord-côtes aux poignets et à la taille, cordon de capuche ton sur ton.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.",
    priceCents: 2_290_000,
    isFeatured: true,
    image: '/media/product-hoodie.jpg',
    imageAlt: 'Photo d’illustration : hoodie noir à capuche porté',
    composition: '80 % coton, 20 % polyester recyclé (exemple de démonstration).',
    care: 'Lavage à 30 °C, séchage à plat.',
    variants: CLOTHING(9),
  },
  {
    name: 'Jogging carotte côtelé',
    slug: 'jogging-carotte-cotele',
    reference: 'DEMO-JG02',
    category: 'ensembles-jogging',
    shortDescription: 'Coupe carotte, taille élastiquée, bas resserrés.',
    description:
      'Jogging à coupe carotte en jersey côtelé, taille élastiquée avec cordon, deux poches latérales et bas resserrés.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 1_890_000,
    salePriceCents: 1_490_000,
    image: '/media/product-jogging.jpg',
    imageAlt: 'Photo d’illustration : tenue de jogging sombre portée',
    composition: '95 % coton, 5 % élasthanne (exemple de démonstration).',
    care: 'Lavage à 30 °C.',
    variants: CLOTHING(7),
  },
  {
    name: 'Sneakers basses signature',
    slug: 'sneakers-basses-signature',
    reference: 'DEMO-SN03',
    category: 'sneakers',
    shortDescription: 'Tige en cuir grainé, semelle vulcanisée, doublure textile.',
    description:
      'Sneakers basses à tige en cuir grainé et semelle vulcanisée. Languette rembourrée, œillets métalliques et semelle intérieure amovible.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 3_490_000,
    isFeatured: true,
    image: '/media/product-sneaker.jpg',
    imageAlt: 'Photo d’illustration : paire de sneakers basses blanches',
    composition: 'Cuir, textile, caoutchouc (exemple de démonstration).',
    care: 'Nettoyage à sec recommandé.',
    variants: [
      { size: '40', color: 'Blanc cassé', colorHex: '#F4F1E9', stock: 4 },
      { size: '41', color: 'Blanc cassé', colorHex: '#F4F1E9', stock: 6 },
      { size: '42', color: 'Blanc cassé', colorHex: '#F4F1E9', stock: 2 },
      { size: '43', color: 'Blanc cassé', colorHex: '#F4F1E9', stock: 5 },
      { size: '44', color: 'Blanc cassé', colorHex: '#F4F1E9', stock: 0 },
      { size: '42', color: 'Noir', colorHex: '#171717', stock: 3 },
      { size: '43', color: 'Noir', colorHex: '#171717', stock: 4 },
    ],
  },
  {
    name: 'Basket montante terrain',
    slug: 'basket-montante-terrain',
    reference: 'DEMO-BK04',
    category: 'basketball',
    shortDescription: 'Maintien cheville, amorti réactif, semelle adhérente.',
    description:
      'Chaussure de basketball montante avec maintien de cheville renforcé, amorti réactif et semelle extérieure à motif adhérent.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 4_490_000,
    image: '/media/product-basket.jpg',
    imageAlt: 'Photo d’illustration : chaussure de basketball montante',
    composition: 'Synthétique, textile, caoutchouc (exemple de démonstration).',
    care: 'Nettoyage à la main.',
    variants: [
      { size: '41', color: 'Noir / Or', colorHex: '#171717', stock: 2 },
      { size: '42', color: 'Noir / Or', colorHex: '#171717', stock: 3 },
      { size: '43', color: 'Noir / Or', colorHex: '#171717', stock: 1 },
      { size: '44', color: 'Noir / Or', colorHex: '#171717', stock: 2 },
    ],
  },
  {
    name: 'T-shirt épais col rond',
    slug: 'tshirt-epais-col-rond',
    reference: 'DEMO-TS05',
    category: 'tshirts',
    shortDescription: 'Coton épais 240 g, coupe droite, col renforcé.',
    description:
      'T-shirt en coton épais 240 g, coupe droite légèrement boxy, col rond renforcé et coutures latérales.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 990_000,
    image: '/media/product-tee.jpg',
    imageAlt: 'Photo d’illustration : t-shirt blanc à col rond porté',
    composition: '100 % coton (exemple de démonstration).',
    care: 'Lavage à 30 °C.',
    variants: [
      { size: 'S', color: 'Écru', colorHex: '#F4F1E9', stock: 12 },
      { size: 'M', color: 'Écru', colorHex: '#F4F1E9', stock: 8 },
      { size: 'L', color: 'Écru', colorHex: '#F4F1E9', stock: 6 },
      { size: 'M', color: 'Noir', colorHex: '#171717', stock: 9 },
      { size: 'L', color: 'Noir', colorHex: '#171717', stock: 4 },
    ],
  },
  {
    name: 'Veste varsity bicolore',
    slug: 'veste-varsity-bicolore',
    reference: 'DEMO-VS06',
    category: 'vestes-streetwear',
    shortDescription: 'Silhouette bomber, empiècements contrastés, doublure satinée.',
    description:
      'Veste varsity à silhouette bomber, empiècements contrastés sur les manches, doublure satinée et boutons pression.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 4_990_000,
    salePriceCents: 3_990_000,
    isFeatured: true,
    image: '/media/product-veste.jpg',
    imageAlt: 'Photo d’illustration : veste noire façon varsity portée',
    composition: 'Mélange laine et polyester, doublure polyester (exemple de démonstration).',
    care: 'Nettoyage à sec.',
    variants: [
      { size: 'S', color: 'Noir / Écru', colorHex: '#171717', stock: 3 },
      { size: 'M', color: 'Noir / Écru', colorHex: '#171717', stock: 4 },
      { size: 'L', color: 'Noir / Écru', colorHex: '#171717', stock: 2 },
      { size: 'XL', color: 'Noir / Écru', colorHex: '#171717', stock: 1 },
    ],
  },
  {
    name: 'Casquette six pans',
    slug: 'casquette-six-pans',
    reference: 'DEMO-CP07',
    category: 'accessoires',
    shortDescription: 'Cotton twill, visière préformée, fermeture réglable.',
    description:
      'Casquette six pans en coton twill, visière préformée, œillets brodés et fermeture réglable à boucle métallique.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 790_000,
    image: '/media/product-cap.jpg',
    imageAlt: 'Photo d’illustration : casquette grise à visière',
    composition: '100 % coton (exemple de démonstration).',
    care: 'Lavage à la main.',
    variants: [
      { size: 'TU', color: 'Noir', colorHex: '#171717', stock: 10 },
      { size: 'TU', color: 'Sable', colorHex: '#B8A472', stock: 3 },
    ],
  },
  {
    name: 'Cargo droit ripstop',
    slug: 'cargo-droit-ripstop',
    reference: 'DEMO-CG08',
    category: 'jeans-pantalons',
    shortDescription: 'Toile ripstop, poches cargo, taille ajustable.',
    description:
      'Pantalon cargo droit en toile ripstop légère, poches latérales à rabat, taille ajustable par pattes et bas resserrables.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 2_490_000,
    image: '/media/product-cargo.jpg',
    imageAlt: 'Photo d’illustration : pantalon sombre à poches',
    composition: '65 % coton, 35 % polyamide (exemple de démonstration).',
    care: 'Lavage à 30 °C.',
    variants: [
      { size: '28', color: 'Gris acier', colorHex: '#777D86', stock: 2 },
      { size: '30', color: 'Gris acier', colorHex: '#777D86', stock: 5 },
      { size: '32', color: 'Gris acier', colorHex: '#777D86', stock: 4 },
      { size: '34', color: 'Gris acier', colorHex: '#777D86', stock: 0 },
      { size: '30', color: 'Noir', colorHex: '#171717', stock: 3 },
    ],
  },
  {
    name: 'Ensemble sweat & short',
    slug: 'ensemble-sweat-short',
    reference: 'DEMO-EN09',
    category: 'ensembles-jogging',
    shortDescription: 'Deux pièces coordonnées, jersey bouclette, coupe décontractée.',
    description:
      'Ensemble deux pièces en jersey bouclette : sweat col rond à coupe décontractée et short assorti avec cordon de serrage.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 2_990_000,
    image: '/media/product-ensemble.jpg',
    imageAlt: 'Photo d’illustration : ensemble deux pièces porté',
    composition: '85 % coton, 15 % polyester (exemple de démonstration).',
    care: 'Lavage à 30 °C.',
    variants: CLOTHING(6),
  },
  {
    name: 'Sac banane technique',
    slug: 'sac-banane-technique',
    reference: 'DEMO-SB10',
    category: 'accessoires',
    shortDescription: 'Nylon déperlant, sangle réglable, poche arrière zippée.',
    description:
      'Sac banane en nylon déperlant avec sangle réglable, fermeture zippée principale et poche arrière discrète.\n\nArticle de démonstration : visuel et caractéristiques fictifs, à remplacer par les informations réelles du produit.',
    priceCents: 1_290_000,
    image: '/media/product-sac.jpg',
    imageAlt: 'Photo d’illustration : sac banane zippé',
    composition: '100 % polyamide recyclé (exemple de démonstration).',
    care: 'Nettoyage à la main.',
    variants: [
      { size: 'TU', color: 'Noir', colorHex: '#171717', stock: 7 },
      { size: 'TU', color: 'Gris acier', colorHex: '#777D86', stock: 2 },
    ],
  },
];

const SETTINGS: Record<string, string> = {
  storeName: 'HP COLLECTION',
  storeTagline: 'Ton style. Tes règles.',
  storeAddress: '',
  storeCity: 'Cotonou',
  storeCountry: 'Bénin',
  heroTitle: 'Le vestiaire urbain, sans compromis.',
  heroSubtitle:
    'Streetwear, sneakers et accessoires sélectionnés pour composer un style qui vous ressemble. Des pièces actuelles, des matières pensées pour le quotidien.',
  heroCtaLabel: 'Découvrir la boutique',
  heroCtaHref: '/boutique',
  heroImageUrl: '/media/hero-editorial.jpg',
  announcement: 'Livraison offerte dès 50 000 FCFA à Cotonou (données de démonstration)',
  contactEmail: 'contact@hpcollection.example',
  contactPhone: '',
  whatsappNumber: '',
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
  legalName: '',
  legalForm: '',
  legalRccm: '',
  legalIfu: '',
  legalVatNumber: '',
  legalAddress: '',
  legalPublisher: '',
  legalComplaintAuthority: '',
  legalUpdatedAt: '',
  hostName: '',
  hostAddress: '',
  hostPhone: '',
  hostEmail: '',
  freeShippingThresholdCents: '5000000',
  codEnabled: 'true',
  demoNotice:
    'Catalogue de démonstration : les articles, prix et frais présentés sont des exemples. Les photos sont des illustrations libres de droits (Unsplash, Pexels) et ne représentent pas les articles réels HP COLLECTION. Remplacez-les depuis l’administration.',
};

/**
 * Jeu de données de démonstration. Idempotent : ne fait rien si la boutique
 * contient déjà un catalogue. Les articles sont explicitement identifiés
 * comme fictifs (références DEMO-*).
 */
export function seedDatabase(): { seeded: boolean; products: number } {
  const marker = queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'seeded_at'");
  if (marker) return { seeded: false, products: 0 };

  const now = nowIso();
  const saleStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const saleEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const categoryIds = new Map<string, string>();

  CATEGORIES.forEach((category, index) => {
    const id = crypto.randomUUID();
    categoryIds.set(category.slug, id);
    execute(
      `INSERT INTO categories (id, slug, name, description, image_url, image_alt, sort_order, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, category.slug, category.name, category.description, category.image, `${category.name} — photo d’illustration`, index, now, now],
    );
  });

  for (const product of PRODUCTS) {
    const productId = crypto.randomUUID();
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) continue;
    execute(
      `INSERT INTO products (id, reference, slug, name, short_description, description, composition, care, category_id,
        price_cents, sale_price_cents, sale_starts_at, sale_ends_at, status, is_featured, low_stock_alert, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, 4, ?, ?)`,
      [
        productId,
        product.reference,
        product.slug,
        product.name,
        product.shortDescription,
        product.description,
        product.composition,
        product.care,
        categoryId,
        product.priceCents,
        product.salePriceCents ?? null,
        product.salePriceCents ? saleStart : null,
        product.salePriceCents ? saleEnd : null,
        product.isFeatured ? 1 : 0,
        now,
        now,
      ],
    );
    execute('INSERT INTO product_images (id, product_id, url, alt, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?)', [
      crypto.randomUUID(),
      productId,
      product.image,
      product.imageAlt,
      now,
    ]);
    for (const variant of product.variants) {
      execute(
        `INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, stock, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          crypto.randomUUID(),
          productId,
          `${product.reference}-${variant.size}-${variant.color.replace(/\s+/g, '').toUpperCase()}`.slice(0, 60),
          variant.size,
          variant.color,
          variant.colorHex,
          variant.stock,
          now,
          now,
        ],
      );
    }
  }

  execute(
    `INSERT INTO stock_movements (
      id, product_id, variant_id, sku, size, color, delta, stock_before, stock_after,
      reason, reference, note, actor_label, created_at
    )
    SELECT lower(hex(randomblob(16))), v.product_id, v.id, v.sku, v.size, v.color,
           v.stock, 0, v.stock, 'initial', v.sku,
           'Stock initial de démonstration', 'Seed', ?
      FROM product_variants v
     WHERE v.stock > 0`,
    [now],
  );

  for (const [key, value] of Object.entries(SETTINGS)) {
    execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, now]);
  }
  execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('seeded_at', ?, ?)", [now, now]);

  const beninId = crypto.randomUUID();
  execute(
    'INSERT INTO shipping_zones (id, name, countries, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)',
    [beninId, 'Bénin', 'BJ', now, now],
  );
  execute(
    `INSERT INTO shipping_methods (id, zone_id, name, description, price_cents, free_over_cents, min_days, max_days, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    [
      crypto.randomUUID(),
      beninId,
      'Livraison Cotonou',
      'Livraison à Cotonou. Tarif et délai de démonstration, à confirmer par la boutique.',
      150_000,
      5_000_000,
      1,
      2,
      now,
      now,
    ],
  );
  execute(
    `INSERT INTO shipping_methods (id, zone_id, name, description, price_cents, free_over_cents, min_days, max_days, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
    [
      crypto.randomUUID(),
      beninId,
      'Livraison nationale',
      'Livraison au Bénin hors Cotonou. Tarif et délai de démonstration, à confirmer par la boutique.',
      250_000,
      7_500_000,
      2,
      4,
      now,
      now,
    ],
  );

  execute(
    `INSERT INTO promo_codes (id, code, description, type, value, min_subtotal_cents, starts_at, ends_at, max_uses,
      max_uses_per_customer, active, created_at, updated_at)
     VALUES (?, 'BIENVENUE10', '10 % sur une première commande (démonstration)', 'percent', 1000, 500000, NULL, NULL, 500, 1, 1, ?, ?)`,
    [crypto.randomUUID(), now, now],
  );

  return { seeded: true, products: PRODUCTS.length };
}

export function isEmptyCatalog(): boolean {
  return Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM products')?.total ?? 0) === 0;
}
