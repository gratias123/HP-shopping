import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OrderItems, OrderMeta, OrderTimeline, OrderTotals } from '../components/OrderView';
import { Breadcrumbs, Seo } from '../components/ui';
import { api, ApiError } from '../lib/api';
import type { Order } from '../lib/types';

export function TrackPage() {
  const [params] = useSearchParams();
  const [reference, setReference] = useState(params.get('reference') ?? '');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('hp_last_order') ?? 'null') as { reference?: string; email?: string } | null;
      if (stored?.reference === reference && stored.email) setEmail(stored.email);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const data = await api.post<{ order: Order }>('/api/orders/track', { reference: reference.trim(), email });
      setOrder(data.order);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Impossible de retrouver cette commande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo title="Suivi de commande" description="Consultez l’état de votre commande HP COLLECTION." />
      <div className={`page-shell ${order ? '' : 'narrow'}`}>
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Suivi de commande' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Suivi</p>
            <h1>Où en est ma commande ?</h1>
            <p className="page-heading__intro">
              Renseignez votre référence de commande (format HP-XXXXXX) et l’adresse e-mail utilisée lors de l’achat.
            </p>
          </div>
        </header>

        <form className="track-form panel" onSubmit={submit}>
          <label className="field">
            <span>Référence de commande</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value.toUpperCase())}
              placeholder="HP-XXXXXX"
              required
              autoComplete="off"
              pattern="HP-[A-Z0-9]{6}"
              title="Format attendu : HP-XXXXXX"
            />
          </label>
          <label className="field">
            <span>E-mail de commande</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="vous@exemple.fr"
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Recherche…' : 'Suivre ma commande'}
          </button>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </form>

        {order ? (
          <div className="track-result">
            <div className="track-result__head">
              <div>
                <p className="eyebrow">Commande {order.reference}</p>
                <h2>{order.statusLabel}</h2>
              </div>
              <p className="muted">Mise à jour le {new Date(order.updatedAt).toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="track-grid">
              <section className="panel">
                <h3>Étapes</h3>
                <OrderTimeline order={order} />
              </section>
              <section className="panel">
                <h3>Livraison</h3>
                <OrderMeta order={order} />
              </section>
            </div>
            <section className="panel">
              <h3>Articles</h3>
              <OrderItems order={order} currency={order.currency} />
              <OrderTotals order={order} currency={order.currency} />
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
