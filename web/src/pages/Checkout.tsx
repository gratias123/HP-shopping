import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Breadcrumbs, EmptyState, Seo, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { useSite } from '../lib/site';
import { formatPrice } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { CustomerAddress, Order, Quote, ShippingMethod } from '../lib/types';

const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

interface FormState {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  note: string;
}

export function CheckoutPage() {
  const cart = useCart();
  const { user } = useAuth();
  const { settings, store } = useSite();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: store.country || 'BJ',
    phone: '',
    email: '',
    note: '',
  });
  const [country, setCountry] = useState(store.country || 'BJ');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'mobile_money'>('cod');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const addresses = useApi<{ addresses: CustomerAddress[] }>(user ? '/api/addresses' : null);

  const itemsKey = cart.lines.map((line) => `${line.variantId}:${line.quantity}`).join('|');
  const subtotalEstimate = cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  useEffect(() => {
    if (!user) return;
    const [firstName, ...rest] = user.fullName.split(' ');
    setForm((current) => ({
      ...current,
      email: user.email,
      firstName: current.firstName || firstName || '',
      lastName: current.lastName || rest.join(' '),
      phone: current.phone || user.phone || '',
    }));
  }, [user]);

  useEffect(() => {
    const list = addresses.data?.addresses ?? [];
    if (!user || !list.length) return;
    const preferred = list.find((address) => address.isDefault) ?? list[0];
    setForm((current) => {
      if (current.line1) return current;
      return {
        ...current,
        firstName: current.firstName || preferred.firstName,
        lastName: current.lastName || preferred.lastName,
        line1: preferred.line1,
        line2: preferred.line2,
        postalCode: preferred.postalCode,
        city: preferred.city,
        phone: current.phone || preferred.phone,
      };
    });
    setSelectedAddressId((current) => current || preferred.id);
    setCountry(preferred.country);
  }, [addresses.data, user]);

  const countries = useApi<{ countries: string[] }>('/api/shipping/countries');
  const shipping = useApi<{ methods: ShippingMethod[] }>(
    `/api/shipping/options?country=${encodeURIComponent(country)}&subtotal=${quote?.subtotalCents ?? subtotalEstimate}`,
  );

  useEffect(() => {
    const methods = shipping.data?.methods ?? [];
    if (!methods.length) {
      setMethodId(null);
      return;
    }
    if (!methodId || !methods.some((method) => method.id === methodId)) {
      setMethodId(methods[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipping.data, country]);

  useEffect(() => {
    if (!cart.lines.length) return;
    const controller = new AbortController();
    setQuoteLoading(true);
    setQuoteError(null);
    api
      .post<{ quote: Quote }>('/api/cart/quote', {
        items: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        promoCode: appliedPromo || undefined,
        shippingMethodId: methodId || null,
        country,
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setQuote(data.quote);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteError(error instanceof ApiError ? error.message : 'Impossible de calculer la commande.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoteLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, appliedPromo, methodId, country]);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`address.${key}`];
      delete next[key];
      return next;
    });
  };

  const applyAddress = (id: string) => {
    setSelectedAddressId(id);
    const address = addresses.data?.addresses.find((item) => item.id === id);
    if (!address) return;
    setForm((current) => ({
      ...current,
      firstName: address.firstName,
      lastName: address.lastName,
      line1: address.line1,
      line2: address.line2,
      postalCode: address.postalCode,
      city: address.city,
      phone: address.phone,
    }));
    setCountry(address.country);
    setMethodId(null);
    setFieldErrors({});
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    try {
      const data = await api.post<{ quote: Quote }>('/api/cart/quote', {
        items: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        promoCode: code,
        shippingMethodId: methodId || null,
        country,
      });
      setAppliedPromo(code);
      setQuote(data.quote);
      setPromoError(null);
    } catch (error) {
      setPromoError(error instanceof ApiError ? error.message : 'Code promotionnel invalide.');
    }
  };

  const methods = shipping.data?.methods ?? [];
  const selectedMethod = methods.find((method) => method.id === methodId) ?? null;

  const totals = useMemo(() => {
    const subtotal = quote?.subtotalCents ?? subtotalEstimate;
    const discount = quote?.discountCents ?? 0;
    // Tant que le mode de livraison n'est pas connu, on n'affiche pas « Offerte »
    // par défaut : le total reste explicitement estimé hors livraison.
    const shippingCents =
      quote && quote.shipping?.methodId === methodId
        ? quote.shipping.priceCents
        : selectedMethod?.priceCents ?? null;
    return {
      subtotal,
      discount,
      shippingCents,
      total: subtotal - discount + (shippingCents ?? 0),
    };
  }, [quote, subtotalEstimate, selectedMethod, methodId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (!methodId) {
      setFormError('Sélectionnez un mode de livraison.');
      return;
    }
    if (!acceptTerms) {
      setFormError('Vous devez accepter les conditions générales de vente.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ order: Order }>('/api/orders', {
        items: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        promoCode: appliedPromo || undefined,
        shippingMethodId: methodId,
        address: {
          firstName: form.firstName,
          lastName: form.lastName,
          line1: form.line1,
          line2: form.line2,
          postalCode: form.postalCode,
          city: form.city,
          country,
          phone: form.phone,
        },
        email: user ? undefined : form.email,
        paymentMethod,
        customerNote: form.note,
        acceptTerms: true,
      });
      if (user && saveAddress && !selectedAddressId) {
        try {
          await api.post('/api/addresses', {
            label: '',
            firstName: form.firstName,
            lastName: form.lastName,
            line1: form.line1,
            line2: form.line2,
            postalCode: form.postalCode,
            city: form.city,
            country,
            phone: form.phone,
            isDefault: !(addresses.data?.addresses.length ?? 0),
          });
        } catch {
          // La commande est déjà enregistrée : un échec du carnet ne la remet pas en cause.
        }
      }
      try {
        sessionStorage.setItem('hp_last_order', JSON.stringify({ reference: data.order.reference, email: data.order.email }));
      } catch {
        // ignore
      }
      cart.clear();
      navigate(`/commande/${data.order.reference}`, { state: { order: data.order }, replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fields);
      } else {
        setFormError('La commande n’a pas pu être enregistrée. Merci de réessayer.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.lines.length) {
    return (
      <div className="page-shell">
        <Seo title="Commander" />
        <EmptyState
          title="Aucun article à commander"
          description="Ajoutez des pièces à votre panier avant de passer commande."
          action={
            <Link to="/boutique" className="btn btn--primary">
              Voir la boutique
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      <Seo title="Validation de commande" />
      <div className="page-shell">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Panier', href: '/panier' }, { label: 'Commande' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Dernière étape</p>
            <h1>Valider la commande</h1>
            <p className="page-heading__intro">
              Livraison au Bénin. Paiement à la réception disponible.
            </p>
          </div>
          {!user ? (
            <p className="checkout-login">
              Déjà client ?{' '}
              <Link to="/connexion?redirect=/commander" className="link-arrow">
                Se connecter
              </Link>
            </p>
          ) : null}
        </header>

        {formError ? (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        ) : null}

        <form className="checkout" onSubmit={submit} noValidate>
          <div className="checkout__main">
            <section className="checkout-block" aria-labelledby="contact-title">
              <div className="checkout-block__head">
                <span>01</span>
                <h2 id="contact-title">Contact</h2>
              </div>
              <div className="form-grid">
                {!user ? (
                  <label className="field field--full">
                    <span>E-mail *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => update('email', event.target.value)}
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                    {fieldErrors.email ? <em className="field-error">{fieldErrors.email}</em> : null}
                    <small>Sert à retrouver votre commande et à la suivre en ligne.</small>
                  </label>
                ) : (
                  <p className="field field--full checkout__email">
                    Connecté en tant que <strong>{user.email}</strong>
                  </p>
                )}
              </div>
            </section>

            <section className="checkout-block" aria-labelledby="shipping-title">
              <div className="checkout-block__head">
                <span>02</span>
                <h2 id="shipping-title">Adresse de livraison</h2>
              </div>
              <div className="form-grid">
                {user && addresses.data?.addresses.length ? (
                  <label className="field field--full">
                    <span>Utiliser une adresse enregistrée</span>
                    <select value={selectedAddressId} onChange={(event) => applyAddress(event.target.value)}>
                      <option value="">Saisir une nouvelle adresse</option>
                      {addresses.data.addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label ? `${address.label} — ` : ''}
                          {address.firstName} {address.lastName} · {address.city}
                          {address.isDefault ? ' · par défaut' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="field">
                  <span>Prénom *</span>
                  <input
                    value={form.firstName}
                    onChange={(event) => update('firstName', event.target.value)}
                    required
                    autoComplete="given-name"
                    aria-invalid={Boolean(fieldErrors['address.firstName'])}
                  />
                  {fieldErrors['address.firstName'] ? <em className="field-error">{fieldErrors['address.firstName']}</em> : null}
                </label>
                <label className="field">
                  <span>Nom *</span>
                  <input
                    value={form.lastName}
                    onChange={(event) => update('lastName', event.target.value)}
                    required
                    autoComplete="family-name"
                    aria-invalid={Boolean(fieldErrors['address.lastName'])}
                  />
                  {fieldErrors['address.lastName'] ? <em className="field-error">{fieldErrors['address.lastName']}</em> : null}
                </label>
                <label className="field field--full">
                  <span>Adresse *</span>
                  <input
                    value={form.line1}
                    onChange={(event) => update('line1', event.target.value)}
                    required
                    autoComplete="address-line1"
                    aria-invalid={Boolean(fieldErrors['address.line1'])}
                  />
                  {fieldErrors['address.line1'] ? <em className="field-error">{fieldErrors['address.line1']}</em> : null}
                </label>
                <label className="field field--full">
                  <span>Complément d’adresse</span>
                  <input value={form.line2} onChange={(event) => update('line2', event.target.value)} autoComplete="address-line2" />
                </label>
                <label className="field">
                  <span>Quartier / zone *</span>
                  <input
                    value={form.postalCode}
                    onChange={(event) => update('postalCode', event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Ex. Akpakpa, Fidjrossè…"
                    aria-invalid={Boolean(fieldErrors['address.postalCode'])}
                  />
                  {fieldErrors['address.postalCode'] ? <em className="field-error">{fieldErrors['address.postalCode']}</em> : null}
                </label>
                <label className="field">
                  <span>Ville *</span>
                  <input
                    value={form.city}
                    onChange={(event) => update('city', event.target.value)}
                    required
                    autoComplete="address-level2"
                    aria-invalid={Boolean(fieldErrors['address.city'])}
                  />
                  {fieldErrors['address.city'] ? <em className="field-error">{fieldErrors['address.city']}</em> : null}
                </label>
                <label className="field">
                  <span>Pays *</span>
                  <select
                    value={country}
                    onChange={(event) => {
                      setCountry(event.target.value);
                      update('country', event.target.value);
                      setMethodId(null);
                    }}
                    autoComplete="country"
                  >
                    {(countries.data?.countries ?? [store.country]).map((code) => (
                      <option key={code} value={code}>
                        {regionNames.of(code) ?? code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Téléphone *</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    required
                    autoComplete="tel"
                    aria-invalid={Boolean(fieldErrors['address.phone'])}
                  />
                  {fieldErrors['address.phone'] ? <em className="field-error">{fieldErrors['address.phone']}</em> : null}
                  <small>Nécessaire pour le transporteur.</small>
                </label>
                {user && !selectedAddressId ? (
                  <label className="checkbox field--full">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(event) => setSaveAddress(event.target.checked)}
                    />
                    <span>Enregistrer cette adresse dans mon carnet</span>
                  </label>
                ) : null}
              </div>
            </section>

            <section className="checkout-block" aria-labelledby="delivery-title">
              <div className="checkout-block__head">
                <span>03</span>
                <h2 id="delivery-title">Livraison</h2>
              </div>
              {shipping.loading ? <Spinner label="Chargement des modes de livraison" /> : null}
              {!shipping.loading && !methods.length ? (
                <p className="alert alert--warning">
                  Aucun mode de livraison n’est disponible pour ce pays. Écrivez-nous à{' '}
                  <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.
                </p>
              ) : null}
              <div className="option-list">
                {methods.map((method) => (
                  <label key={method.id} className={`option-card ${methodId === method.id ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="shipping"
                      value={method.id}
                      checked={methodId === method.id}
                      onChange={() => setMethodId(method.id)}
                    />
                    <span className="option-card__body">
                      <strong>{method.name}</strong>
                      <small>
                        {method.description}
                        {method.minDays !== null && method.maxDays !== null ? ` · ${method.minDays}–${method.maxDays} jours ouvrés` : ''}
                      </small>
                    </span>
                    <span className="option-card__price">
                      {quote?.shipping?.methodId === method.id
                        ? formatPrice(quote.shipping.priceCents, store.currency)
                        : method.priceCents === 0
                          ? 'Offerte'
                          : formatPrice(method.priceCents, store.currency)}
                    </span>
                  </label>
                ))}
              </div>
              {fieldErrors.shippingMethodId ? <em className="field-error">{fieldErrors.shippingMethodId}</em> : null}
            </section>

            <section className="checkout-block" aria-labelledby="payment-title">
              <div className="checkout-block__head">
                <span>04</span>
                <h2 id="payment-title">Paiement</h2>
              </div>
              <div className="option-list">
                <label className={`option-card ${paymentMethod === 'cod' ? 'is-selected' : ''} ${!settings.codEnabled ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    disabled={!settings.codEnabled}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <span className="option-card__body">
                    <strong>Paiement à la réception</strong>
                    <small>Réglez à la livraison, en espèces ou par carte selon le transporteur.</small>
                  </span>
                  <span className="option-card__price">Inclus</span>
                </label>
                <label className={`option-card ${paymentMethod === 'mobile_money' ? 'is-selected' : ''} ${!store.mobileMoneyEnabled ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="mobile_money"
                    checked={paymentMethod === 'mobile_money'}
                    disabled={!store.mobileMoneyEnabled}
                    onChange={() => setPaymentMethod('mobile_money')}
                  />
                  <span className="option-card__body">
                    <strong>Mobile Money</strong>
                    <small>
                      {store.mobileMoneyEnabled
                        ? 'Paiement mobile sécurisé via le prestataire configuré.'
                        : 'Pas encore disponible : un prestataire Mobile Money compatible avec le Bénin doit être configuré.'}
                    </small>
                  </span>
                  <span className="option-card__price">{store.mobileMoneyEnabled ? '' : 'Non activé'}</span>
                </label>
              </div>
              <label className="field field--full checkout__note">
                <span>Note pour la commande (facultatif)</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.note}
                  onChange={(event) => update('note', event.target.value)}
                  placeholder="Instructions de livraison, précisions…"
                />
              </label>
            </section>
          </div>

          <aside className="summary summary--checkout" aria-label="Récapitulatif de commande">
            <h2>Votre commande</h2>
            <ul className="summary__lines">
              {cart.lines.map((line) => (
                <li key={line.variantId}>
                  <span className="summary__line-media">
                    {line.imageUrl ? <img src={line.imageUrl} alt="" width="64" height="80" /> : null}
                    <span className="summary__line-qty">{line.quantity}</span>
                  </span>
                  <span className="summary__line-body">
                    <strong>{line.name}</strong>
                    <small>
                      {line.color} · {line.size}
                    </small>
                  </span>
                  <span className="summary__line-price">{formatPrice(line.unitPriceCents * line.quantity, store.currency)}</span>
                </li>
              ))}
            </ul>

            <div className="promo-form">
              <label htmlFor="checkout-promo">Code promotionnel</label>
              <div>
                <input
                  id="checkout-promo"
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  placeholder="Votre code"
                  autoComplete="off"
                />
                <button type="button" className="btn btn--ghost btn--small" onClick={applyPromo} disabled={!promoInput.trim()}>
                  Appliquer
                </button>
              </div>
              {promoError ? <p className="field-error">{promoError}</p> : null}
              {quote?.promo ? <p className="promo-applied"><Icon name="check" size={15} /> {quote.promo.code} appliqué</p> : null}
            </div>

            <dl className="summary__totals">
              <div>
                <dt>Sous-total</dt>
                <dd>{formatPrice(totals.subtotal, store.currency)}</dd>
              </div>
              {totals.discount > 0 ? (
                <div className="summary__discount">
                  <dt>Remise</dt>
                  <dd>−{formatPrice(totals.discount, store.currency)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Livraison</dt>
                <dd>
                  {totals.shippingCents === null
                    ? 'Calculée à l’étape suivante'
                    : totals.shippingCents === 0
                      ? 'Offerte'
                      : formatPrice(totals.shippingCents, store.currency)}
                </dd>
              </div>
              <div className="summary__grand">
                <dt>{totals.shippingCents === null ? 'Total estimé' : 'Total'}</dt>
                <dd>{formatPrice(totals.total, store.currency)}</dd>
              </div>
            </dl>

            {quoteLoading ? <Spinner label="Mise à jour des totaux" /> : null}
            {quoteError ? <p className="field-error">{quoteError}</p> : null}

            <label className="checkbox checkbox--terms">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                aria-invalid={Boolean(fieldErrors.acceptTerms)}
              />
              <span>
                J’accepte les <Link to="/cgv" target="_blank">conditions générales de vente</Link> et la{' '}
                <Link to="/confidentialite" target="_blank">politique de confidentialité</Link>. *
              </span>
            </label>
            {fieldErrors.acceptTerms ? <p className="field-error">{fieldErrors.acceptTerms}</p> : null}

            <button type="submit" className="btn btn--primary btn--full" disabled={submitting || !methodId}>
              {submitting ? 'Enregistrement…' : 'Confirmer la commande'}
            </button>
            <p className="summary__note">
              <Icon name="lock" size={15} /> Aucune donnée bancaire n’est enregistrée. Conservez votre référence de
              commande pour suivre son état.
            </p>
            <Link to="/panier" className="summary__back">
              <Icon name="arrow-left" size={15} /> Modifier le panier
            </Link>
          </aside>
        </form>
      </div>
    </>
  );
}
