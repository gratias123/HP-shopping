import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Breadcrumbs, EmptyState, QuantityStepper, Seo, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { useSite } from '../lib/site';
import type { Quote } from '../lib/types';

export function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { store, settings } = useSite();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const itemsKey = cart.lines.map((line) => `${line.variantId}:${line.quantity}`).join('|');

  useEffect(() => {
    if (!cart.lines.length) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setQuoteError(null);
    api
      .post<{ quote: Quote }>('/api/cart/quote', {
        items: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        promoCode: appliedPromo || undefined,
      })
      .then((data) => setQuote(data.quote))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteError(error instanceof ApiError ? error.message : 'Impossible de recalculer le panier.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, appliedPromo]);

  const applyPromo = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const data = await api.post<{ quote: Quote }>('/api/cart/quote', {
        items: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        promoCode: code,
      });
      setQuote(data.quote);
      setAppliedPromo(code);
      setPromoError(null);
    } catch (error) {
      setPromoError(error instanceof ApiError ? error.message : 'Code promotionnel invalide.');
    } finally {
      setPromoBusy(false);
    }
  };

  const freeShipping =
    quote && quote.shippingCents === 0 ? true : cart.subtotalCents >= settings.freeShippingThresholdCents;

  if (!cart.lines.length) {
    return (
      <>
        <Seo title="Panier" />
        <div className="page-shell">
          <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Panier' }]} />
          <EmptyState
            title="Votre panier est vide"
            description="Les pièces que vous ajoutez apparaîtront ici. Vous pourrez ajuster les quantités avant de commander."
            action={
              <Link to="/boutique" className="btn btn--primary">
                Découvrir la boutique
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const subtotal = quote?.subtotalCents ?? cart.subtotalCents;
  const lineFor = (variantId: string) => quote?.lines.find((line) => line.variantId === variantId);

  return (
    <>
      <Seo title="Panier" />
      <div className="page-shell">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Panier' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Votre sélection</p>
            <h1>Panier</h1>
            <p className="page-heading__intro">
              {cart.itemCount} article{cart.itemCount > 1 ? 's' : ''} — vérifiez les tailles et quantités avant de
              commander.
            </p>
          </div>
          <Link to="/boutique" className="link-arrow">
            Continuer mes achats <Icon name="arrow-right" size={16} />
          </Link>
        </header>

        {quoteError ? (
          <div className="alert alert--error" role="alert">
            <p>{quoteError}</p>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setQuoteError(null)}>
              Fermer
            </button>
          </div>
        ) : null}

        <div className="cart-layout">
          <section aria-label="Articles du panier">
            <ul className="cart-page-lines">
              {cart.lines.map((line) => {
                const live = lineFor(line.variantId);
                const maxStock = live?.availableStock ?? line.maxStock;
                return (
                  <li key={line.variantId} className="cart-page-line">
                    <Link to={`/produit/${line.slug}`} className="cart-page-line__media">
                      {line.imageUrl ? <img src={line.imageUrl} alt="" width="160" height="200" /> : <span aria-hidden="true">HP</span>}
                    </Link>
                    <div className="cart-page-line__body">
                      <div className="cart-page-line__head">
                        <div>
                          <h2>
                            <Link to={`/produit/${line.slug}`}>{line.name}</Link>
                          </h2>
                          <p className="muted">
                            {line.color} · Taille {line.size} · Réf. {line.reference}
                          </p>
                        </div>
                        <p className="cart-page-line__price">
                          {formatPrice(live?.lineTotalCents ?? line.unitPriceCents * line.quantity, store.currency)}
                        </p>
                      </div>
                      {live && live.unitPriceCents !== line.unitPriceCents ? (
                        <p className="alert-inline">Le prix de cet article a été actualisé : {formatPrice(live.unitPriceCents, store.currency)} l’unité.</p>
                      ) : null}
                      {live && live.availableStock < line.quantity ? (
                        <p className="alert-inline alert-inline--error">Stock disponible : {live.availableStock}. Ajustez la quantité.</p>
                      ) : null}
                      <div className="cart-page-line__actions">
                        <QuantityStepper
                          value={line.quantity}
                          max={Math.max(1, Math.min(maxStock, 10))}
                          onChange={(quantity) => cart.updateQuantity(line.variantId, quantity)}
                          ariaLabel={`Quantité pour ${line.name}`}
                        />
                        <button
                          type="button"
                          className="link-small link-small--danger"
                          onClick={() => cart.removeItem(line.variantId)}
                        >
                          <Icon name="trash" size={15} /> Retirer
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="summary" aria-label="Récapitulatif">
            <h2>Récapitulatif</h2>
            <form className="promo-form" onSubmit={applyPromo}>
              <label htmlFor="promo">Code promotionnel</label>
              <div>
                <input
                  id="promo"
                  type="text"
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  placeholder="Ex. BIENVENUE10"
                  autoComplete="off"
                />
                <button type="submit" className="btn btn--ghost btn--small" disabled={promoBusy || !promoInput.trim()}>
                  {promoBusy ? '…' : 'Appliquer'}
                </button>
              </div>
              {promoError ? <p className="field-error">{promoError}</p> : null}
              {quote?.promo ? (
                <p className="promo-applied">
                  <Icon name="check" size={15} /> {quote.promo.code} — {formatPrice(quote.promo.discountCents, store.currency)} de remise
                  <button
                    type="button"
                    className="link-small"
                    onClick={() => {
                      setAppliedPromo('');
                      setPromoInput('');
                    }}
                  >
                    Annuler
                  </button>
                </p>
              ) : null}
            </form>

            <dl className="summary__totals">
              <div>
                <dt>Sous-total</dt>
                <dd>{formatPrice(subtotal, store.currency)}</dd>
              </div>
              {quote?.discountCents ? (
                <div className="summary__discount">
                  <dt>Remise</dt>
                  <dd>−{formatPrice(quote.discountCents, store.currency)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Livraison</dt>
                <dd>{freeShipping ? 'Offerte' : 'Calculée à l’étape suivante'}</dd>
              </div>
              <div className="summary__grand">
                <dt>Total estimé</dt>
                <dd>{formatPrice(quote?.totalCents ?? subtotal - (quote?.discountCents ?? 0), store.currency)}</dd>
              </div>
            </dl>

            {loading ? <Spinner label="Recalcul du panier" /> : null}

            <button
              type="button"
              className="btn btn--primary btn--full"
              onClick={() => navigate('/commander')}
              disabled={Boolean(quoteError)}
            >
              Passer commande
            </button>
            <p className="summary__note">
              <Icon name="lock" size={15} /> Paiement à la réception disponible. Aucune donnée bancaire n’est stockée sur
              ce site.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
