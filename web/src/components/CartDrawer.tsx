import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { useSite } from '../lib/site';
import { formatPrice } from '../lib/format';
import { Icon } from './Icon';
import { QuantityStepper } from './ui';

export function CartDrawer() {
  const cart = useCart();
  const { settings, store } = useSite();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cart.isOpen) closeRef.current?.focus();
  }, [cart.isOpen]);

  if (!cart.isOpen) return null;

  const remaining = Math.max(0, settings.freeShippingThresholdCents - cart.subtotalCents);
  const progress = Math.min(100, Math.round((cart.subtotalCents / Math.max(1, settings.freeShippingThresholdCents)) * 100));

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="drawer-layer">
      <button type="button" className="drawer-layer__scrim" aria-label="Fermer le panier" onClick={cart.closeCart} />
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Panier"
        ref={panelRef}
        onKeyDown={onKeyDown}
      >
        <header className="cart-drawer__head">
          <div>
            <p className="eyebrow">Votre sélection</p>
            <h2>Panier ({cart.itemCount})</h2>
          </div>
          <button type="button" className="icon-button" ref={closeRef} onClick={cart.closeCart} aria-label="Fermer le panier">
            <Icon name="close" size={22} />
          </button>
        </header>

        {cart.lines.length === 0 ? (
          <div className="cart-drawer__empty">
            <Icon name="bag" size={40} />
            <h3>Votre panier est vide</h3>
            <p>Parcourez la boutique et ajoutez les pièces qui vous correspondent.</p>
            <Link to="/boutique" className="btn btn--primary" onClick={cart.closeCart}>
              Découvrir la boutique
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-drawer__shipping">
              {remaining > 0 ? (
                <p>
                  Plus que <strong>{formatPrice(remaining, store.currency)}</strong> pour la livraison offerte.
                </p>
              ) : (
                <p>
                  <Icon name="check" size={16} /> Livraison offerte sur cette commande.
                </p>
              )}
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="cart-lines">
              {cart.lines.map((line) => (
                <li key={line.variantId} className="cart-line">
                  <Link to={`/produit/${line.slug}`} className="cart-line__media" onClick={cart.closeCart}>
                    {line.imageUrl ? <img src={line.imageUrl} alt="" width="96" height="120" /> : <span aria-hidden="true">HP</span>}
                  </Link>
                  <div className="cart-line__body">
                    <div className="cart-line__title">
                      <Link to={`/produit/${line.slug}`} onClick={cart.closeCart}>
                        {line.name}
                      </Link>
                      <button
                        type="button"
                        className="cart-line__remove"
                        aria-label={`Retirer ${line.name}`}
                        onClick={() => cart.removeItem(line.variantId)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    <p className="cart-line__variant">
                      {line.color} · {line.size}
                    </p>
                    <div className="cart-line__row">
                      <QuantityStepper
                        value={line.quantity}
                        max={Math.max(1, Math.min(line.maxStock, 10))}
                        onChange={(quantity) => cart.updateQuantity(line.variantId, quantity)}
                        ariaLabel={`Quantité pour ${line.name}`}
                      />
                      <p className="cart-line__price">{formatPrice(line.unitPriceCents * line.quantity, store.currency)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="cart-drawer__foot">
              <div className="cart-drawer__subtotal">
                <span>Sous-total</span>
                <strong>{formatPrice(cart.subtotalCents, store.currency)}</strong>
              </div>
              <p className="cart-drawer__note">Frais de livraison et code promotionnel calculés à l’étape suivante.</p>
              <Link to="/panier" className="btn btn--primary btn--full" onClick={cart.closeCart}>
                Voir le panier
              </Link>
              <Link to="/commander" className="btn btn--ghost btn--full" onClick={cart.closeCart}>
                Passer commande
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
