import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_SHORT } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import type { AdminDashboard } from '../../lib/types';

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export function AdminDashboardPage() {
  const { data, loading, error, reload } = useApi<AdminDashboard>('/api/admin/dashboard');
  const { user } = useAuth();

  if (loading && !data) {
    return (
      <div className="page-loading">
        <Spinner label="Chargement du tableau de bord" />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState error={error ?? { message: 'Tableau de bord indisponible.' }} onRetry={reload} />;
  }

  const currency = data.currency;
  const canCatalog = user?.permissions.includes('catalog:read');

  return (
    <>
      <Seo title="Tableau de bord" />
      <div className="admin-kpis">
        <article className="admin-kpi">
          <p>Chiffre d’affaires</p>
          <strong>{formatPrice(data.revenueCents, currency)}</strong>
          <small>Commandes non annulées / non remboursées</small>
        </article>
        <article className="admin-kpi">
          <p>CA — 30 derniers jours</p>
          <strong>{formatPrice(data.revenue30dCents, currency)}</strong>
          <small>{data.orderCount} commande{data.orderCount > 1 ? 's' : ''} au total</small>
        </article>
        <article className="admin-kpi">
          <p>Clients</p>
          <strong>{data.customerCount}</strong>
          <small>Comptes clients enregistrés</small>
        </article>
        <article className="admin-kpi admin-kpi--alert">
          <p>Stock bas</p>
          <strong>{data.lowStockTotal}</strong>
          <small>{data.newMessages} message{data.newMessages > 1 ? 's' : ''} non lu{data.newMessages > 1 ? 's' : ''}</small>
        </article>
      </div>

      <section className="admin-panel">
        <header className="admin-panel__head">
          <h2>Commandes par statut</h2>
          <Link to="/admin/commandes" className="link-arrow">
            Toutes les commandes <Icon name="arrow-right" size={16} />
          </Link>
        </header>
        <div className="status-grid">
          {STATUS_ORDER.map((status) => (
            <Link key={status} to={`/admin/commandes?status=${status}`} className="status-card">
              <StatusBadge status={status} label={ORDER_STATUS_SHORT[status]} />
              <strong>{data.statusCounts[status] ?? 0}</strong>
            </Link>
          ))}
        </div>
      </section>

      <div className="admin-columns">
        <section className="admin-panel">
          <header className="admin-panel__head">
            <h2>Commandes récentes</h2>
            <Link to="/admin/commandes" className="link-arrow">
              Voir tout
            </Link>
          </header>
          {data.recentOrders.length === 0 ? (
            <EmptyState title="Aucune commande" description="Les commandes apparaîtront ici dès la première vente." />
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Client</th>
                    <th>Statut</th>
                    <th className="num">Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => (
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
                      <td>
                        <StatusBadge status={order.status} label={order.statusLabel} />
                      </td>
                      <td className="num">{formatPrice(order.totalCents, currency)}</td>
                      <td>{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <header className="admin-panel__head">
            <h2>Meilleures ventes</h2>
          </header>
          {data.topProducts.length === 0 ? (
            <p className="muted">Aucune vente enregistrée pour l’instant.</p>
          ) : (
            <ol className="rank-list">
              {data.topProducts.map((product, index) => (
                <li key={product.reference}>
                  <span className="rank-list__index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="rank-list__body">
                    <strong>{product.name}</strong>
                    <small>{product.reference}</small>
                  </span>
                  <span className="rank-list__value">
                    {product.units} u.
                    <small>{formatPrice(product.revenueCents, currency)}</small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="admin-panel">
        <header className="admin-panel__head">
          <h2>Alertes de stock</h2>
          <Link to="/admin/produits" className="link-arrow">
            Gérer les stocks
          </Link>
        </header>
        {data.lowStock.length === 0 ? (
          <p className="muted">Aucune alerte : tous les stocks sont au-dessus du seuil configuré.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Variante</th>
                  <th>SKU</th>
                  <th className="num">Stock</th>
                  <th className="num">Seuil</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.productName}</td>
                    <td>
                      {variant.color} · {variant.size}
                    </td>
                    <td className="mono">{variant.sku}</td>
                    <td className="num">
                      <span className={variant.stock === 0 ? 'stock-zero' : 'stock-low'}>{variant.stock}</span>
                    </td>
                    <td className="num">{variant.threshold}</td>
                    <td>
                      {canCatalog ? (
                        <Link to={`/admin/produits/${variant.productId}`} className="link-small">
                          Ajuster
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted admin__footnote">
        Le chiffre d’affaires exclut les commandes annulées et remboursées. Les meilleures ventes sont calculées à
        partir des lignes de commande enregistrées. Statuts : {STATUS_ORDER.map((status) => ORDER_STATUS_LABELS[status]).join(' · ')}.
      </p>
    </>
  );
}
