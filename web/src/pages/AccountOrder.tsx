import { Link, useParams } from 'react-router-dom';
import { OrderItems, OrderMeta, OrderTimeline, OrderTotals } from '../components/OrderView';
import { Breadcrumbs, ErrorState, Seo, Spinner, StatusBadge } from '../components/ui';
import { useApi } from '../lib/hooks';
import { formatDate } from '../lib/format';
import type { Order } from '../lib/types';

export function AccountOrderPage() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useApi<{ order: Order }>(id ? `/api/orders/${id}` : null);

  if (loading) {
    return (
      <div className="page-shell page-loading">
        <Spinner label="Chargement de la commande" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-shell">
        <ErrorState error={error ?? { message: 'Commande introuvable.' }} onRetry={reload} />
        <p className="center">
          <Link to="/compte" className="btn btn--ghost">
            Retour à mon compte
          </Link>
        </p>
      </div>
    );
  }

  const order = data.order;

  return (
    <>
      <Seo title={`Commande ${order.reference}`} />
      <div className="page-shell narrow">
        <Breadcrumbs
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Mon compte', href: '/compte' },
            { label: order.reference },
          ]}
        />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Commande du {formatDate(order.createdAt)}</p>
            <h1>{order.reference}</h1>
          </div>
          <StatusBadge status={order.status} label={order.statusLabel} />
        </header>

        <section className="panel">
          <h2>Suivi</h2>
          <OrderTimeline order={order} />
        </section>

        <section className="panel">
          <h2>Articles</h2>
          <OrderItems order={order} currency={order.currency} />
          <OrderTotals order={order} currency={order.currency} />
          <p className="order-receipt">
            <a className="btn btn--ghost btn--small" href={`/api/orders/${order.id}/receipt.pdf`} download>
              Télécharger le reçu PDF
            </a>
            <span className="muted">Document non fiscal.</span>
          </p>
        </section>

        <section className="panel">
          <OrderMeta order={order} />
        </section>

        <p className="muted">
          Un problème avec cette commande ?{' '}
          <Link to="/contact">Contactez-nous</Link> en précisant la référence {order.reference}.
        </p>
      </div>
    </>
  );
}
