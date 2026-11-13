import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../components/ProductCard';
import { Breadcrumbs, EmptyState, ErrorState, Pagination, Seo, SkeletonGrid } from '../components/ui';
import { queryString } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useSite } from '../lib/site';
import type { Category, ProductsResponse } from '../lib/types';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { store } = useSite();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const category = useApi<{ category: Category }>(slug ? `/api/categories/${slug}` : null);
  const products = useApi<ProductsResponse>(
    slug ? `/api/products${queryString({ category: slug, page, perPage: 12, sort: params.get('sort') ?? 'newest' })}` : null,
  );

  if (category.error) {
    return (
      <div className="page-shell">
        <ErrorState
          error={category.error}
          onRetry={category.reload}
        />
        <p className="center">
          <Link to="/boutique" className="btn btn--ghost">
            Retour à la boutique
          </Link>
        </p>
      </div>
    );
  }

  const data = category.data?.category;

  return (
    <>
      <Seo title={data?.name ?? 'Catégorie'} description={data?.description} />
      <div className="page-shell">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Boutique', href: '/boutique' }, { label: data?.name ?? '…' }]} />

        <header className="category-hero">
          <div className="category-hero__copy">
            <p className="eyebrow">Rayon</p>
            <h1>{data?.name ?? '…'}</h1>
            <p>{data?.description || 'Une sélection de pièces à découvrir.'}</p>
          </div>
          {data?.imageUrl ? (
            <div className="category-hero__media">
              <img src={data.imageUrl} alt={data.imageAlt || data.name} width="720" height="480" />
            </div>
          ) : null}
        </header>

        <div className="category-toolbar">
          <p className="muted">{products.data ? `${products.data.total} article${products.data.total > 1 ? 's' : ''}` : ' '}</p>
          <label className="select-field">
            <span>Trier par</span>
            <select
              value={params.get('sort') ?? 'newest'}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value === 'newest') next.delete('sort');
                else next.set('sort', event.target.value);
                next.delete('page');
                setParams(next);
              }}
            >
              <option value="newest">Nouveautés</option>
              <option value="bestsellers">Les plus vendus</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="name">Nom (A–Z)</option>
            </select>
          </label>
        </div>

        {products.error ? <ErrorState error={products.error} onRetry={products.reload} /> : null}
        {products.loading && !products.data ? <SkeletonGrid count={8} /> : null}
        {products.data?.items.length === 0 ? (
          <EmptyState
            title="Catégorie momentanément vide"
            description="De nouvelles pièces seront publiées prochainement."
            action={
              <Link to="/boutique" className="btn btn--primary">
                Voir toute la boutique
              </Link>
            }
          />
        ) : null}
        {products.data?.items.length ? <ProductGrid products={products.data.items} currency={store.currency} /> : null}

        {products.data ? (
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
        ) : null}
      </div>
    </>
  );
}
