import { Link } from 'react-router-dom';
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../lib/format';
import type { Order, OrderStatus } from '../lib/types';
import { Icon } from './Icon';
import { StatusBadge } from './ui';

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

export function OrderTimeline({ order }: { order: Order }) {
  const cancelled = order.status === 'cancelled' || order.status === 'refunded';
  const historyByStatus = new Map(order.history.map((entry) => [entry.toStatus, entry]));
  const currentIndex = STEPS.indexOf(order.status);

  return (
    <div className="timeline-wrap">
      {cancelled ? (
        <div className={`alert ${order.status === 'cancelled' ? 'alert--warning' : 'alert--error'}`}>
          <strong>{order.statusLabel}.</strong>{' '}
          {order.status === 'cancelled'
            ? 'Cette commande a été annulée. Contactez-nous pour toute question.'
            : 'Cette commande a été remboursée.'}
        </div>
      ) : null}
      <ol className="timeline">
        {STEPS.map((step, index) => {
          const entry = historyByStatus.get(step);
          const done = !cancelled && currentIndex >= index;
          const current = !cancelled && currentIndex === index;
          return (
            <li key={step} className={`${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
              <span className="timeline__dot" aria-hidden="true">
                {done && !current ? <Icon name="check" size={12} /> : null}
              </span>
              <div>
                <strong>{ORDER_STATUS_LABELS[step]}</strong>
                {entry ? <p>{formatDateTime(entry.createdAt)}</p> : <p className="muted">À venir</p>}
                {entry?.note && step !== 'pending' ? <p className="timeline__note">{entry.note}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
      {cancelled
        ? order.history
            .filter((entry) => entry.toStatus === order.status)
            .map((entry) => (
              <p key={entry.id} className="timeline__note">
                {formatDateTime(entry.createdAt)} — {entry.note || entry.actorLabel}
              </p>
            ))
        : null}
    </div>
  );
}

export function OrderItems({ order, currency }: { order: Order; currency: string }) {
  return (
    <ul className="order-items">
      {order.items.map((item) => (
        <li key={item.id}>
          <span className="order-items__media">
            {item.imageUrl ? <img src={item.imageUrl} alt="" width="80" height="100" /> : <span aria-hidden="true">HP</span>}
          </span>
          <span className="order-items__body">
            <strong>
              {item.productSlug ? <Link to={`/produit/${item.productSlug}`}>{item.productName}</Link> : item.productName}
            </strong>
            <small>
              {item.variantColor} · Taille {item.variantSize} · Réf. {item.productReference}
            </small>
            <small>Quantité : {item.quantity}</small>
          </span>
          <span className="order-items__price">{formatPrice(item.lineTotalCents, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order, currency }: { order: Order; currency: string }) {
  return (
    <dl className="summary__totals">
      <div>
        <dt>Sous-total</dt>
        <dd>{formatPrice(order.subtotalCents, currency)}</dd>
      </div>
      {order.discountCents > 0 ? (
        <div className="summary__discount">
          <dt>Remise {order.promoCode ? `(${order.promoCode})` : ''}</dt>
          <dd>−{formatPrice(order.discountCents, currency)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Livraison</dt>
        <dd>{order.shippingCents === 0 ? 'Offerte' : formatPrice(order.shippingCents, currency)}</dd>
      </div>
      <div className="summary__grand">
        <dt>Total</dt>
        <dd>{formatPrice(order.totalCents, currency)}</dd>
      </div>
    </dl>
  );
}

export function OrderMeta({ order }: { order: Order }) {
  return (
    <div className="order-meta">
      <div>
        <h3>Livraison</h3>
        <p>
          {order.shippingFirstName} {order.shippingLastName}
          <br />
          {order.shippingLine1}
          {order.shippingLine2 ? (
            <>
              <br />
              {order.shippingLine2}
            </>
          ) : null}
          <br />
          {order.shippingPostalCode} {order.shippingCity}
          <br />
          {order.shippingCountry}
          <br />
          {order.phone}
        </p>
        <p className="muted">{order.shippingMethodLabel}</p>
      </div>
      <div>
        <h3>Paiement</h3>
        <p>
          <StatusBadge status={order.paymentStatus} label={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} />
        </p>
        <p className="muted">
          {order.paymentMethod === 'cod' ? 'Paiement à la réception' : 'Mobile Money'}
          {order.paymentStatus === 'pending' ? ' — à régler à la livraison' : ''}
        </p>
        {order.customerNote ? (
          <>
            <h3>Votre note</h3>
            <p className="muted">{order.customerNote}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
