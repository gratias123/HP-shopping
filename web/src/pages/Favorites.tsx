import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Breadcrumbs, EmptyState, Seo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useFavorites } from '../lib/favorites';
import { useSite } from '../lib/site';
import type { ProductCard as ProductCardType } from '../lib/types';

export function FavoritesPage() {
  const favorites = useFavorites();
  const { user } = useAuth();
  const { store } = useSite();

  const products: ProductCardType[] = favorites.items.map((item) => ({
    ...item,
    reference: '',
    shortDescription: '',
    status: 'published',
    isFeatured: false,
    createdAt: '',
    sizes: [],
    colors: [],
  }));

  return (
    <>
      <Seo title="Favoris" />
      <div className="page-shell">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Favoris' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Votre sélection</p>
            <h1>Favoris</h1>
            <p className="page-heading__intro">
              {user
                ? 'Vos favoris sont enregistrés sur votre compte.'
                : 'Vos favoris sont conservés sur cet appareil. Connectez-vous pour les retrouver partout.'}
            </p>
          </div>
          {!user ? (
            <Link to="/connexion?redirect=/favoris" className="btn btn--ghost">
              Se connecter
            </Link>
          ) : null}
        </header>

        {products.length === 0 ? (
          <EmptyState
            title="Aucun favori pour l’instant"
            description="Utilisez le cœur sur un article pour le retrouver ici."
            action={
              <Link to="/boutique" className="btn btn--primary">
                Parcourir la boutique
              </Link>
            }
          />
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} currency={store.currency} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
