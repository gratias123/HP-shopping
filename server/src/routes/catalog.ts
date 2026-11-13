import { Router } from 'express';
import { publicStoreConfig, getSettings } from '../services/settings.js';
import {
  getCategoryBySlug,
  getProductBySlug,
  homePayload,
  listCategories,
  listFacets,
  listProducts,
} from '../services/catalog.js';
import { ApiError } from '../lib/errors.js';
import { parseBoolean, parseInteger, parseList } from '../lib/http.js';
import { listShippingOptions, listActiveCountries } from '../services/shipping.js';
import { config } from '../config.js';

export const catalogRouter = Router();

catalogRouter.get('/home', (_req, res) => {
  res.json(homePayload());
});

catalogRouter.get('/store', (_req, res) => {
  res.json({ settings: getSettings(), store: publicStoreConfig() });
});

catalogRouter.get('/products', (req, res) => {
  const sort = String(req.query.sort ?? 'newest');
  const allowedSorts = ['newest', 'price-asc', 'price-desc', 'name', 'bestsellers'] as const;
  const result = listProducts({
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    sizes: parseList(req.query.sizes),
    colors: parseList(req.query.colors),
    minPriceCents: parseInteger(req.query.minPrice),
    maxPriceCents: parseInteger(req.query.maxPrice),
    inStockOnly: parseBoolean(req.query.inStock),
    onSaleOnly: parseBoolean(req.query.onSale),
    sort: (allowedSorts as readonly string[]).includes(sort) ? (sort as (typeof allowedSorts)[number]) : 'newest',
    page: parseInteger(req.query.page) ?? 1,
    perPage: parseInteger(req.query.perPage) ?? 12,
  });
  res.json(result);
});

catalogRouter.get('/products/:slug', (req, res) => {
  const product = getProductBySlug(String(req.params.slug));
  if (!product) throw ApiError.notFound("Ce produit n'existe pas ou n'est plus disponible.");
  res.json({ product });
});

catalogRouter.get('/categories', (_req, res) => {
  res.json({ categories: listCategories() });
});

catalogRouter.get('/categories/:slug', (req, res) => {
  const category = getCategoryBySlug(String(req.params.slug));
  if (!category || !category.published) throw ApiError.notFound("Cette catégorie n'existe pas.");
  res.json({ category });
});

catalogRouter.get('/facets', (_req, res) => {
  res.json(listFacets());
});

catalogRouter.get('/shipping/countries', (_req, res) => {
  res.json({ countries: listActiveCountries(), defaultCountry: config.defaultCountry });
});

catalogRouter.get('/shipping/options', (req, res) => {
  const country = typeof req.query.country === 'string' && req.query.country.length === 2 ? req.query.country : config.defaultCountry;
  const subtotal = Math.max(0, parseInteger(req.query.subtotal) ?? 0);
  res.json({
    country: country.toUpperCase(),
    methods: listShippingOptions(country, subtotal),
    freeShippingThresholdCents: getSettings().freeShippingThresholdCents,
  });
});
