import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { Breadcrumbs, ErrorState, Price, QuantityStepper, Seo, Spinner } from '../components/ui';
import { useApi } from '../lib/hooks';
import { useCart } from '../lib/cart';
import { useFavorites } from '../lib/favorites';
import { useSite } from '../lib/site';
import { useToast } from '../lib/toast';
import { formatPrice, discountPercent } from '../lib/format';
import type { ProductDetail, ProductsResponse } from '../lib/types';

export function ProductPage() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useApi<{ product: ProductDetail }>(slug ? `/api/products/${slug}` : null);
  const { store, settings } = useSite();
  const cart = useCart();
  const favorites = useFavorites();
  const toast = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const product = data?.product;
  const related = useApi<ProductsResponse>(
    product ? `/api/products?category=${product.category.slug}&perPage=5` : null,
  );

  const colors = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, { name: string; hex: string | null; stock: number }>();
    for (const variant of product.variants.filter((entry) => entry.isActive)) {
      const existing = map.get(variant.color);
      if (existing) existing.stock += variant.stock;
      else map.set(variant.color, { name: variant.color, hex: variant.colorHex, stock: variant.stock });
    }
    return [...map.values()];
  }, [product]);

  const selectedColor = color ?? colors.find((entry) => entry.stock > 0)?.name ?? colors[0]?.name ?? null;
  const sizesForColor = useMemo(
    () => product?.variants.filter((variant) => variant.isActive && variant.color === selectedColor) ?? [],
    [product, selectedColor],
  );
  const selectedVariant = sizesForColor.find((variant) => variant.size === size) ?? null;

  if (loading && !product) {
    return (
      <div className="page-shell page-loading">
        <Spinner label="Chargement du produit" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-shell">
        <ErrorState
          error={error ?? { message: 'Ce produit n’est plus disponible.' }}
          onRetry={reload}
        />
        <p className="center">
          <Link to="/boutique" className="btn btn--ghost">
            Retour à la boutique
          </Link>
        </p>
      </div>
    );
  }

  const gallery = product.images.length
    ? product.images
    : product.image
      ? [{ url: product.image.url, alt: product.image.alt }]
      : [];
  const percent = discountPercent(product.effectivePriceCents, product.compareAtCents);
  const isFavorite = favorites.isFavorite(product.id);

  const addToCart = () => {
    if (!selectedVariant) {
      toast.push('Choisissez une taille disponible.', 'error');
      return;
    }
    if (selectedVariant.stock <= 0) {
      toast.push('Cette taille est épuisée.', 'error');
      return;
    }
    cart.addItem(
      {
        variantId: selectedVariant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        reference: product.reference,
        size: selectedVariant.size,
        color: selectedVariant.color,
        imageUrl: product.images[0]?.url ?? product.image?.url ?? null,
        unitPriceCents: product.effectivePriceCents,
        maxStock: selectedVariant.stock,
      },
      quantity,
    );
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.reference,
    description: product.description || product.shortDescription,
    category: product.category.name,
    brand: { '@type': 'Brand', name: 'HP COLLECTION' },
    image: product.images.map((image) => new URL(image.url, window.location.origin).href),
    offers: {
      '@type': 'Offer',
      priceCurrency: store.currency,
      price: (product.effectivePriceCents / 100).toFixed(store.currency === 'XOF' ? 0 : 2),
      availability: product.stockTotal > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
  };

  return (
    <>
      <Seo title={product.name} description={product.shortDescription} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="page-shell">
        <Breadcrumbs
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Boutique', href: '/boutique' },
            { label: product.category.name, href: `/categories/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="product">
          <div className="product__gallery">
            <div className="product__thumbs">
              {gallery.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  className={index === activeImage ? 'is-active' : ''}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Voir l’image ${index + 1}`}
                  aria-pressed={index === activeImage}
                >
                  <img src={image.url} alt="" width="120" height="150" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="product__main-image">
              {gallery[activeImage] ? (
                <img src={gallery[activeImage].url} alt={gallery[activeImage].alt || product.name} width="900" height="1125" />
              ) : (
                <span className="product__placeholder" aria-hidden="true">
                  HP
                </span>
              )}
              {product.onSale ? <span className="flag flag--sale product__flag">−{percent ?? ''}%</span> : null}
            </div>
          </div>

          <div className="product__info">
            <p className="eyebrow">{product.category.name}</p>
            <h1>{product.name}</h1>
            <p className="product__ref">Réf. {product.reference}</p>
            <Price priceCents={product.effectivePriceCents} compareAtCents={product.compareAtCents} currency={store.currency} size="lg" />
            {product.onSale && product.saleEndsAt ? (
              <p className="product__promo-note">Prix promotionnel jusqu’au {new Date(product.saleEndsAt).toLocaleDateString('fr-FR')}.</p>
            ) : null}
            <p className="product__short">{product.shortDescription}</p>

            <div className="selector">
              <div className="selector__label">
                <span>Couleur</span>
                <strong>{selectedColor ?? '—'}</strong>
              </div>
              <div className="color-options">
                {colors.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    className={entry.name === selectedColor ? 'is-active' : ''}
                    onClick={() => {
                      setColor(entry.name);
                      setSize(null);
                      setQuantity(1);
                    }}
                    aria-pressed={entry.name === selectedColor}
                    title={entry.name}
                  >
                    <span className="swatch" style={{ background: entry.hex ?? '#777D86' }} aria-hidden="true" />
                    <span>{entry.name}</span>
                    {entry.stock === 0 ? <em>Épuisé</em> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="selector">
              <div className="selector__label">
                <span>Taille</span>
                <button type="button" className="link-small" onClick={() => toast.push('Les coupes sont indiquées dans les détails du produit.', 'info')}>
                  Guide des tailles
                </button>
              </div>
              <div className="size-options">
                {sizesForColor.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={variant.size === size ? 'is-active' : ''}
                    onClick={() => {
                      setSize(variant.size);
                      setQuantity(1);
                    }}
                    disabled={variant.stock <= 0}
                    aria-pressed={variant.size === size}
                    title={variant.stock <= 0 ? 'Épuisé' : `${variant.stock} en stock`}
                  >
                    {variant.size}
                  </button>
                ))}
                {!sizesForColor.length ? <p className="muted">Aucune taille disponible pour cette couleur.</p> : null}
              </div>
              {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 ? (
                <p className="stock-hint">Plus que {selectedVariant.stock} en stock.</p>
              ) : null}
              {selectedVariant && selectedVariant.stock <= 0 ? <p className="stock-hint stock-hint--out">Épuisé dans cette taille.</p> : null}
            </div>

            <div className="product__buy">
              <QuantityStepper
                value={quantity}
                max={Math.max(1, Math.min(selectedVariant?.stock ?? 1, 10))}
                onChange={setQuantity}
                ariaLabel="Quantité souhaitée"
              />
              <button
                type="button"
                className="btn btn--primary btn--full"
                onClick={addToCart}
                disabled={!selectedVariant || selectedVariant.stock <= 0}
              >
                {selectedVariant && selectedVariant.stock <= 0 ? 'Épuisé' : 'Ajouter au panier'}
              </button>
              <button
                type="button"
                className={`btn btn--icon ${isFavorite ? 'is-active' : ''}`}
                onClick={() =>
                  favorites.toggle({
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    priceCents: product.priceCents,
                    effectivePriceCents: product.effectivePriceCents,
                    compareAtCents: product.compareAtCents,
                    onSale: product.onSale,
                    saleEndsAt: product.saleEndsAt,
                    category: { name: product.category.name, slug: product.category.slug },
                    image: product.image,
                    stockTotal: product.stockTotal,
                  })
                }
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Icon name="heart" size={20} />
              </button>
            </div>

            <ul className="product__services">
              <li>
                <Icon name="truck" size={18} /> Expédition sous 1 à 2 jours ouvrés
              </li>
              <li>
                <Icon name="return" size={18} /> Retours sous 14 jours
              </li>
              <li>
                <Icon name="lock" size={18} /> Paiement à la réception disponible
              </li>
            </ul>

            <div className="accordions">
              <details open>
                <summary>Description</summary>
                <div>
                  {product.description.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </details>
              <details>
                <summary>Composition & entretien</summary>
                <div>
                  {product.composition ? <p>{product.composition}</p> : <p>Composition non renseignée.</p>}
                  {product.care ? <p>{product.care}</p> : null}
                </div>
              </details>
              <details>
                <summary>Livraison & retours</summary>
                <div>
                  <p>
                    Livraison offerte dès {formatPrice(settings.freeShippingThresholdCents, store.currency)} selon la zone de livraison
                    sélectionnée au paiement. Expédition sous 1 à 2 jours ouvrés, suivi en ligne avec votre référence.
                  </p>
                  <p>
                    Retour possible sous 14 jours après réception, article non porté et dans son emballage d’origine.{' '}
                    <Link to="/livraison">En savoir plus</Link>.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>

        {related.data?.items.filter((entry) => entry.id !== product.id).length ? (
          <section className="section section--related">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Même rayon</p>
                <h2>À associer</h2>
              </div>
              <Link to={`/categories/${product.category.slug}`} className="link-arrow">
                Tout voir <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className="product-grid product-grid--compact">
              {related.data.items
                .filter((entry) => entry.id !== product.id)
                .slice(0, 4)
                .map((entry) => (
                  <ProductCard key={entry.id} product={entry} currency={store.currency} />
                ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
