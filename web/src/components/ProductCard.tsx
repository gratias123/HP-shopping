import { Link } from 'react-router-dom';
import type { ProductCard as ProductCardType } from '../lib/types';
import { formatPrice } from '../lib/format';
import { discountPercent } from '../lib/format';
import { useFavorites } from '../lib/favorites';
import { Icon } from './Icon';

export function ProductCard({ product, currency }: { product: ProductCardType; currency: string }) {
  const favorites = useFavorites();
  const isFavorite = favorites.isFavorite(product.id);
  const soldOut = product.stockTotal <= 0;
  const percent = discountPercent(product.effectivePriceCents, product.compareAtCents);

  return (
    <article className="product-card">
      <div className="product-card__media">
        <Link to={`/produit/${product.slug}`} className="product-card__link" aria-label={product.name}>
          {product.image ? (
            <img src={product.image.url} alt={product.image.alt || product.name} loading="lazy" width="640" height="800" />
          ) : (
            <span className="product-card__placeholder" aria-hidden="true">
              HP
            </span>
          )}
          <span className="product-card__hover" aria-hidden="true">
            Voir le produit
          </span>
        </Link>
        <div className="product-card__flags">
          {product.onSale ? <span className="flag flag--sale">−{percent ?? ''}%</span> : null}
          {soldOut ? <span className="flag flag--out">Épuisé</span> : null}
          {product.isFeatured && !product.onSale && !soldOut ? <span className="flag">Sélection</span> : null}
        </div>
        <button
          type="button"
          className={`product-card__fav ${isFavorite ? 'is-active' : ''}`}
          aria-label={isFavorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
          aria-pressed={isFavorite}
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await favorites.toggle(product);
          }}
        >
          <Icon name="heart" size={16} />
        </button>
      </div>
      <div className="product-card__body">
        <p className="product-card__category">{product.category.name}</p>
        <h3 className="product-card__name">
          <Link to={`/produit/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="product-card__price">
          {formatPrice(product.effectivePriceCents, currency)}
          {product.compareAtCents ? <s>{formatPrice(product.compareAtCents, currency)}</s> : null}
        </p>
        {product.sizes?.length ? <p className="product-card__sizes">Tailles {product.sizes.slice(0, 6).join(' · ')}</p> : null}
      </div>
    </article>
  );
}

export function ProductGrid({ products, currency }: { products: ProductCardType[]; currency: string }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} currency={currency} />
      ))}
    </div>
  );
}
