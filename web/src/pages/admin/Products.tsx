import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Pagination, Seo, SkeletonGrid, StatusBadge } from '../../components/ui';
import { api, ApiError, queryString } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useApi, useDebouncedValue } from '../../lib/hooks';
import { useSite } from '../../lib/site';
import { useToast } from '../../lib/toast';
import type { ProductsResponse } from '../../lib/types';

interface AdminProductsResponse extends ProductsResponse {
  statusCounts: Record<string, number>;
}

const TABS = [
  { value: 'all', label: 'Tous' },
  { value: 'published', label: 'Publiés' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'archived', label: 'Archivés' },
];

export function AdminProductsPage() {
  const [params, setParams] = useSearchParams();
  const { store } = useSite();
  const toast = useToast();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(term, 300);
  const status = params.get('status') ?? 'all';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const path = `/api/admin/products${queryString({
    status,
    q: params.get('q') ?? '',
    page,
    perPage: 20,
  })}`;
  const { data, loading, error, reload } = useApi<AdminProductsResponse>(path);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    setParam('q', debounced.trim() || null);
  };

  const changeStatus = async (id: string, nextStatus: string, label: string) => {
    if (nextStatus === 'archived' && !window.confirm(`Archiver cet article ? Il ne sera plus visible ni commandable.`)) return;
    setBusyId(id);
    try {
      await api.patch(`/api/admin/products/${id}/status`, { status: nextStatus });
      toast.push(label, 'success');
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Action impossible.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Seo title="Produits" />
      <div className="admin-toolbar">
        <div className="admin-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={status === tab.value ? 'is-active' : ''}
              onClick={() => setParam('status', tab.value)}
            >
              {tab.label}
              {data?.statusCounts ? <span>{tab.value === 'all' ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : data.statusCounts[tab.value] ?? 0}</span> : null}
            </button>
          ))}
        </div>
        <div className="admin-toolbar__actions">
          <form className="inline-search" onSubmit={search}>
            <label className="sr-only" htmlFor="admin-product-search">
              Rechercher un produit
            </label>
            <input
              id="admin-product-search"
              type="search"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                if (params.get('q') && !event.target.value) setParam('q', null);
              }}
              placeholder="Nom ou référence"
            />
            <button type="submit" className="btn btn--ghost btn--small">
              <Icon name="search" size={16} />
            </button>
          </form>
          <Link to="/admin/produits/nouveau" className="btn btn--primary btn--small">
            <Icon name="plus" size={16} /> Nouveau produit
          </Link>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <SkeletonGrid count={6} /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          description="Créez votre premier article pour alimenter la boutique."
          action={
            <Link to="/admin/produits/nouveau" className="btn btn--primary">
              Créer un produit
            </Link>
          }
        />
      ) : null}

      {data && data.items.length ? (
        <div className="table-wrap admin-panel admin-panel--flush">
          <table className="admin-table admin-table--products">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th className="num">Prix</th>
                <th className="num">Stock</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-product">
                      <span className="table-product__media">
                        {product.image ? <img src={product.image.url} alt="" width="48" height="60" /> : null}
                      </span>
                      <span>
                        <Link to={`/admin/produits/${product.id}`}>{product.name}</Link>
                        <small className="mono">{product.reference}</small>
                      </span>
                    </div>
                  </td>
                  <td>{product.category.name}</td>
                  <td className="num">
                    {formatPrice(product.effectivePriceCents, store.currency)}
                    {product.onSale ? <small className="sale-tag">promo</small> : null}
                  </td>
                  <td className="num">
                    <span className={product.stockTotal === 0 ? 'stock-zero' : product.stockTotal <= 5 ? 'stock-low' : ''}>
                      {product.stockTotal}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={product.status} label={{ published: 'Publié', draft: 'Brouillon', archived: 'Archivé' }[product.status] ?? product.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link to={`/admin/produits/${product.id}`} className="btn btn--ghost btn--small">
                        Modifier
                      </Link>
                      {product.status !== 'published' ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          disabled={busyId === product.id}
                          onClick={() => changeStatus(product.id, 'published', 'Produit publié.')}
                        >
                          Publier
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          disabled={busyId === product.id}
                          onClick={() => changeStatus(product.id, 'draft', 'Produit repassé en brouillon.')}
                        >
                          Dépublier
                        </button>
                      )}
                      {product.status !== 'archived' ? (
                        <button
                          type="button"
                          className="link-small link-small--danger"
                          disabled={busyId === product.id}
                          onClick={() => changeStatus(product.id, 'archived', 'Produit archivé.')}
                        >
                          Archiver
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data ? (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          onChange={(nextPage) => setParam('page', String(nextPage))}
        />
      ) : null}
    </>
  );
}
