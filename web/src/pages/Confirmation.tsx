import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { OrderItems, OrderMeta, OrderTimeline, OrderTotals } from '../components/OrderView';
import { Seo, Spinner, StatusBadge } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Order } from '../lib/types';

interface StoredOrder {
  reference: string;
  email: string;
}

export function ConfirmationPage() {
  const { reference = '' } = useParams();
  const location = useLocation();
  const stateOrder = (location.state as { order?: Order } | null)?.order ?? null;
  const [order, setOrder] = useState<Order | null>(stateOrder);
  const [loading, setLoading] = useState(!stateOrder);

  useEffect(() => {
    if (order) return;
    let stored: StoredOrder | null = null;
    try {
      stored = JSON.parse(sessionStorage.getItem('hp_last_order') ?? 'null') as StoredOrder | null;
    } catch {
      stored = null;
    }
    if (!stored || stored.reference !== reference) {
      setLoading(false);
      return;
    }
    api
      .post<{ order: Order }>('/api/orders/track', { reference, email: stored.email })
      .then((data) => setOrder(data.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [order, reference]);

  if (loading) {
    return (
      <div className="page-shell page-loading">
        <Spinner label="Chargement de la commande" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-shell narrow">
        <Seo title="Commande confirmée" />
        <div className="confirmation-hero confirmation-hero--info">
          <Icon name="bag" size={28} />
          <h1>Commande {reference}</h1>
          <p>
            Pour des raisons de confidentialité, reconnectez-vous avec l’e-mail utilisé lors de la commande ou
            consultez le suivi avec votre référence.
          </p>
          <Link to="/suivi" className="btn btn--primary">
            Suivre ma commande
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo title={`Commande ${order.reference}`} />
      <div className="page-shell narrow">
        <div className="confirmation-hero">
          <span className="confirmation-hero__icon">
            <Icon name="check" size={26} />
          </span>
          <p className="eyebrow">Commande enregistrée</p>
          <h1>Merci pour votre confiance.</h1>
          <p>
            Votre commande <strong>{order.reference}</strong> du {formatDate(order.createdAt)} a bien été reçue. Un
            récapitulatif est à conserver ; le suivi sera mis à jour depuis votre compte ou la page de suivi.
          </p>
          <div className="confirmation-hero__meta">
            <StatusBadge status={order.status} label={order.statusLabel} />
            <span>{order.email}</span>
          </div>
          <div className="confirmation-hero__actions">
            <Link to={`/suivi?reference=${order.reference}`} className="btn btn--primary">
              Suivre ma commande
            </Link>
            <Link to="/boutique" className="btn btn--ghost">
              Continuer mes achats
            </Link>
          </div>
        </div>

        <section className="panel">
          <h2>Suivi</h2>
          <OrderTimeline order={order} />
        </section>

        <section className="panel">
          <h2>Articles</h2>
          <OrderItems order={order} currency={order.currency} />
          <OrderTotals order={order} currency={order.currency} />
        </section>

        <section className="panel">
          <OrderMeta order={order} />
        </section>

        <p className="muted center">
          Une question sur cette commande ? <Link to="/contact">Contactez-nous</Link> en indiquant la référence{' '}
          {order.reference}.
        </p>
      </div>
    </>
  );
}
