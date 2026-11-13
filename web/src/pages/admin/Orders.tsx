import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Pagination, Seo, Spinner, StatusBadge } from '../../components/ui';
import { formatDateTime, formatPrice, ORDER_STATUS_SHORT, PAYMENT_STATUS_LABELS } from '../../lib/format';
import { useApi, useDebouncedValue } from '../../lib/hooks';
import { queryString } from '../../lib/api';
import { useSite } from '../../lib/site';
import type { AdminOrderSummary } from '../../lib/types';

interface AdminOrdersResponse {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

const TABS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'shipped', label: 'Expédiées' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
];

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const { store } = useSite();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(term, 300);
  const status = params.get('status') ?? 'all';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const { data, loading, error, reload } = useApi<AdminOrdersResponse>(
    `/api/admin/orders${queryString({ status, q: params.get('q') ?? '', page, perPage: 20 })}`,
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <>
      <Seo title="Commandes" />
      <div className="admin-toolbar">
        <div className="admin-tabs admin-tabs--scroll">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={status === tab.value ? 'is-active' : ''}
              onClick={() => setParam('status', tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          className="inline-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setParam('q', debounced.trim() || null);
          }}
        >
          <label className="sr-only" htmlFor="admin-order-search">
            Rechercher une commande
          </label>
          <input
            id="admin-order-search"
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              if (params.get('q') && !event.target.value) setParam('q', null);
            }}
            placeholder="Référence, client, e-mail"
          />
          <button type="submit" className="btn btn--ghost btn--small" aria-label="Rechercher">
            <Icon name="search" size={16} />
          </button>
        </form>
        <a
          className="btn btn--ghost btn--small"
          href={`/api/admin/reports/orders.csv${queryString({
            status: status === 'all' ? '' : status,
            q: params.get('q') ?? '',
          })}`}
        >
          Exporter CSV
        </a>
        <a className="btn btn--ghost btn--small" href="/api/admin/reports/sales.pdf">
          Rapport PDF
        </a>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner label="Chargement des commandes" /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          description="Les commandes passées sur la boutique apparaîtront ici avec leur statut et leur historique."
        />
      ) : null}

      {data && data.items.length ? (
        <div className="table-wrap admin-panel admin-panel--flush">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th className="num">Articles</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/commandes/${order.id}`} className="mono">
                      {order.reference}
                    </Link>
                  </td>
                  <td>
                    {order.customerName}
                    <small className="muted">{order.email}</small>
                  </td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>
                    <StatusBadge status={order.status} label={order.statusLabel} />
                  </td>
                  <td>
                    <StatusBadge
                      status={order.paymentStatus}
                      label={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                    />
                  </td>
                  <td className="num">{order.itemCount}</td>
                  <td className="num">{formatPrice(order.totalCents, store.currency)}</td>
                  <td>
                    <Link to={`/admin/commandes/${order.id}`} className="btn btn--ghost btn--small">
                      Ouvrir
                    </Link>
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

      <p className="muted">
        Statuts : {Object.entries(ORDER_STATUS_SHORT).map(([key, label]) => `${label.toLowerCase()} (${key})`).join(' · ')}.
        Une commande ne peut avancer que selon les transitions autorisées ; chaque changement est historisé.
      </p>
    </>
  );
}
