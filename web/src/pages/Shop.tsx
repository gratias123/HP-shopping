import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { Breadcrumbs, EmptyState, ErrorState, Pagination, Seo, SkeletonGrid } from '../components/ui';
import { queryString } from '../lib/api';
import { useCategoryTree } from '../lib/categories';
import { formatPrice } from '../lib/format';
import { useDebouncedValue, useApi } from '../lib/hooks';
import { useSite } from '../lib/site';
import type { CollectionSummary, Facets, ProductsResponse } from '../lib/types';

const GENDER_LABELS: Record<string, string> = { homme: 'Homme', femme: 'Femme', mixte: 'Mixte' };

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nouveautés' },
  { value: 'bestsellers', label: 'Les plus vendus' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom (A–Z)' },
];

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { store } = useSite();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const gender = ['homme', 'femme', 'mixte'].includes(params.get('gender') ?? '') ? (params.get('gender') as string) : '';
  const collection = params.get('collection') ?? '';
  const sizes = params.get('sizes')?.split(',').filter(Boolean) ?? [];
  const colors = params.get('colors')?.split(',').filter(Boolean) ?? [];
  const onSale = params.get('onSale') === 'true';
  const inStock = params.get('inStock') === 'true';
  const sort = params.get('sort') ?? 'newest';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';

  const [searchTerm, setSearchTerm] = useState(q);
  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setSearchTerm(q);
  }, [q]);

  useEffect(() => {
    if (debouncedSearch === q) return;
    const next = new URLSearchParams(params);
    if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim());
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const productsPath = `/api/products${queryString({
    q,
    category,
    gender: gender || undefined,
    collection: collection || undefined,
    sizes,
    colors,
    onSale: onSale || undefined,
    inStock: inStock || undefined,
    sort,
    page,
    perPage: 12,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
  })}`;
  const products = useApi<ProductsResponse>(productsPath);
  const facets = useApi<Facets>('/api/facets');
  const tree = useCategoryTree();
  const collections = useApi<{ collections: CollectionSummary[] }>('/api/collections');

  const update = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete('page');
    setParams(next);
  };

  const toggleInList = (key: 'sizes' | 'colors', value: string) => {
    const current = key === 'sizes' ? sizes : colors;
    const nextValues = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    update(key, nextValues.length ? nextValues.join(',') : null);
  };

  const [priceMin, setPriceMin] = useState(minPrice ? String(Number(minPrice) / 100) : '');
  const [priceMax, setPriceMax] = useState(maxPrice ? String(Number(maxPrice) / 100) : '');
  useEffect(() => {
    setPriceMin(minPrice ? String(Number(minPrice) / 100) : '');
    setPriceMax(maxPrice ? String(Number(maxPrice) / 100) : '');
  }, [minPrice, maxPrice]);

  const applyPrices = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const minCents = Math.round(Number.parseFloat(priceMin) * 100);
    const maxCents = Math.round(Number.parseFloat(priceMax) * 100);
    if (Number.isFinite(minCents) && minCents >= 0) next.set('minPrice', String(minCents));
    else next.delete('minPrice');
    if (Number.isFinite(maxCents) && maxCents > 0) next.set('maxPrice', String(maxCents));
    else next.delete('maxPrice');
    next.delete('page');
    setParams(next);
  };

  const activeFilters = [
    ...(q ? [{ key: 'q', label: `« ${q} »` }] : []),
    ...(category
      ? [{ key: 'category', label: tree.all.find((entry) => entry.slug === category)?.name ?? category }]
      : []),
    ...(gender ? [{ key: 'gender', label: GENDER_LABELS[gender] ?? gender }] : []),
    ...(collection ? [{ key: 'collection', label: `Collection ${collection}` }] : []),
    ...sizes.map((size) => ({ key: `size:${size}`, label: `Taille ${size}` })),
    ...colors.map((color) => ({ key: `color:${color}`, label: color })),
    ...(onSale ? [{ key: 'onSale', label: 'En promotion' }] : []),
    ...(inStock ? [{ key: 'inStock', label: 'En stock' }] : []),
    ...(minPrice ? [{ key: 'minPrice', label: `Dès ${formatPrice(Number(minPrice), store.currency)}` }] : []),
    ...(maxPrice ? [{ key: 'maxPrice', label: `Jusqu’à ${formatPrice(Number(maxPrice), store.currency)}` }] : []),
  ];

  const removeFilter = (key: string) => {
    if (key.startsWith('size:')) return toggleInList('sizes', key.slice(5));
    if (key.startsWith('color:')) return toggleInList('colors', key.slice(6));
    update(key, null);
  };

  return (
    <>
      <Seo title="Boutique" description="Tous les vêtements, sneakers et accessoires HP COLLECTION." />
      <div className="page-shell">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Boutique' }]} />
        <header className="page-heading">
          <div>
            <p className="eyebrow">Catalogue</p>
            <h1>{q ? `Résultats pour « ${q} »` : 'La boutique'}</h1>
            <p className="page-heading__intro">
              Streetwear, sneakers et accessoires. Filtrez par taille, couleur et budget pour trouver la pièce juste.
            </p>
          </div>
          <form
            className="inline-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              update('q', searchTerm.trim() || null);
            }}
          >
            <label htmlFor="shop-search" className="sr-only">
              Rechercher dans la boutique
            </label>
            <input
              id="shop-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher un article"
            />
            <button type="submit" className="btn btn--primary" aria-label="Lancer la recherche">
              <Icon name="search" size={18} />
            </button>
          </form>
        </header>

        <div className="shop-layout">
          <aside className={`filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filtres">
            <div className="filters__head">
              <h2>Filtres</h2>
              <button type="button" className="icon-button filters__close" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="filter-group">
              <h3>Catégories</h3>
              <ul className="filter-list">
                <li>
                  <button type="button" className={!category ? 'is-active' : ''} onClick={() => update('category', null)}>
                    Toutes les catégories
                  </button>
                </li>
                {[...tree.groups.map((group) => ({ entry: group.category, children: group.children })), ...tree.standalone.map((entry) => ({ entry, children: [] as typeof tree.standalone }))].map(
                  ({ entry, children }) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={category === entry.slug ? 'is-active' : ''}
                        onClick={() => update('category', entry.slug)}
                      >
                        {entry.name}
                        <span>{entry.productCount}</span>
                      </button>
                      {children.length > 0 ? (
                        <ul className="filter-list filter-list--nested">
                          {children.map((child) => (
                            <li key={child.id}>
                              <button
                                type="button"
                                className={category === child.slug ? 'is-active' : ''}
                                onClick={() => update('category', child.slug)}
                              >
                                {child.name}
                                <span>{child.productCount}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="filter-group">
              <h3>Public</h3>
              <div className="filter-chips">
                {(['homme', 'femme', 'mixte'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={gender === value ? 'is-active' : ''}
                    aria-pressed={gender === value}
                    onClick={() => update('gender', gender === value ? null : value)}
                  >
                    {GENDER_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            {collections.data?.collections.length ? (
              <div className="filter-group">
                <h3>Collections</h3>
                <ul className="filter-list">
                  {collections.data.collections.map((entry) => (
                    <li key={entry.name}>
                      <button
                        type="button"
                        className={collection.toLowerCase() === entry.name.toLowerCase() ? 'is-active' : ''}
                        onClick={() => update('collection', collection.toLowerCase() === entry.name.toLowerCase() ? null : entry.name)}
                      >
                        {entry.name}
                        <span>{entry.productCount}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="filter-group">
              <h3>Tailles</h3>
              <div className="filter-chips">
                {facets.data?.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={sizes.includes(size) ? 'is-active' : ''}
                    aria-pressed={sizes.includes(size)}
                    onClick={() => toggleInList('sizes', size)}
                  >
                    {size}
                  </button>
                ))}
                {!facets.data?.sizes.length ? <p className="muted">Aucune taille disponible.</p> : null}
              </div>
            </div>

            <div className="filter-group">
              <h3>Couleurs</h3>
              <div className="filter-swatches">
                {facets.data?.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    className={colors.includes(color.name) ? 'is-active' : ''}
                    aria-pressed={colors.includes(color.name)}
                    onClick={() => toggleInList('colors', color.name)}
                  >
                    <span className="swatch" style={{ background: color.hex ?? '#777D86' }} aria-hidden="true" />
                    {color.name}
                  </button>
                ))}
                {!facets.data?.colors.length ? <p className="muted">Aucune couleur disponible.</p> : null}
              </div>
            </div>

            <form className="filter-group" onSubmit={applyPrices}>
              <h3>Prix</h3>
              <div className="filter-price">
                <label>
                  Min.
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  Max.
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                    placeholder="300"
                  />
                </label>
                <button type="submit" className="btn btn--ghost btn--small">
                  Appliquer
                </button>
              </div>
            </form>

            <div className="filter-group">
              <h3>Disponibilité</h3>
              <label className="checkbox">
                <input type="checkbox" checked={inStock} onChange={(event) => update('inStock', event.target.checked ? 'true' : null)} />
                En stock uniquement
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={onSale} onChange={(event) => update('onSale', event.target.checked ? 'true' : null)} />
                En promotion
              </label>
            </div>

            <button type="button" className="btn btn--ghost btn--full filters__reset" onClick={() => setParams(new URLSearchParams())}>
              Réinitialiser les filtres
            </button>
          </aside>

          <section className="shop-results" aria-live="polite">
            <div className="shop-toolbar">
              <button type="button" className="btn btn--ghost shop-toolbar__filters" onClick={() => setFiltersOpen(true)}>
                <Icon name="filter" size={18} /> Filtres
                {activeFilters.length ? <span className="count-pill">{activeFilters.length}</span> : null}
              </button>
              <p className="shop-toolbar__count">
                {products.data ? `${products.data.total} article${products.data.total > 1 ? 's' : ''}` : '—'}
              </p>
              <label className="select-field shop-toolbar__sort">
                <span>Trier par</span>
                <select value={sort} onChange={(event) => update('sort', event.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeFilters.length ? (
              <ul className="active-filters" aria-label="Filtres actifs">
                {activeFilters.map((filter) => (
                  <li key={filter.key}>
                    <button type="button" onClick={() => removeFilter(filter.key)} aria-label={`Retirer le filtre ${filter.label}`}>
                      {filter.label} <Icon name="close" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {products.error ? <ErrorState error={products.error} onRetry={products.reload} /> : null}

            {!products.error && products.loading && !products.data ? <SkeletonGrid count={8} /> : null}

            {products.data && products.data.items.length === 0 ? (
              <EmptyState
                title="Aucun article ne correspond"
                description="Essayez d’élargir vos filtres ou de modifier votre recherche."
                action={
                  <button type="button" className="btn btn--primary" onClick={() => setParams(new URLSearchParams())}>
                    Voir toute la boutique
                  </button>
                }
              />
            ) : null}

            {products.data && products.data.items.length > 0 ? (
              <>
                <ProductGrid products={products.data.items} currency={store.currency} />
                <Pagination
                  page={products.data.page}
                  pages={products.data.pages}
                  total={products.data.total}
                  onChange={(nextPage) => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(nextPage));
                    setParams(next);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </>
            ) : null}

            <p className="shop-results__more">
              Besoin d’aide pour choisir ? <Link to="/contact">Écrivez-nous</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
