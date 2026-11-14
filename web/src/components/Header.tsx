import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { useFavorites } from '../lib/favorites';
import { useSite } from '../lib/site';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';

const NAV = [
  { label: 'Boutique', to: '/boutique' },
  { label: 'Nouveautés', to: '/boutique?sort=newest' },
  { label: 'Sneakers', to: '/categories/sneakers' },
  { label: 'Accessoires', to: '/categories/accessoires' },
  { label: 'Suivi', to: '/suivi' },
];

export function Header() {
  const { settings } = useSite();
  const { user } = useAuth();
  const cart = useCart();
  const favorites = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    navigate(`/boutique?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
    setTerm('');
  };

  return (
    <>
      {settings.announcement ? (
        <div className="announcement" role="region" aria-label="Information boutique">
          <p>{settings.announcement}</p>
        </div>
      ) : null}
      <header className="site-header">
        <div className="site-header__inner">
          <button
            type="button"
            className="icon-button site-header__burger"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={22} />
          </button>

          <Link to="/" className="logo" aria-label="HP COLLECTION — Accueil">
            <span className="logo__mark">HP</span>
            <span className="logo__word">COLLECTION</span>
          </Link>

          <nav className="site-nav" aria-label="Navigation principale">
            {NAV.map((item) =>
              item.to.includes('?') ? (
                <Link key={item.label} to={item.to} className="site-nav__link">
                  {item.label}
                </Link>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="site-header__actions">
            <button
              type="button"
              className="icon-button"
              aria-label={searchOpen ? 'Fermer la recherche' : 'Rechercher'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((value) => !value)}
            >
              <Icon name="search" size={20} />
            </button>
            {user ? <NotificationBell /> : null}
            <Link to={user ? '/compte' : '/connexion'} className="icon-button" aria-label={user ? 'Mon compte' : 'Connexion'}>
              <Icon name="user" size={20} />
            </Link>
            <Link to="/favoris" className="icon-button icon-button--badge" aria-label={`Favoris (${favorites.items.length})`}>
              <Icon name="heart" size={20} />
              {favorites.items.length > 0 ? <span className="icon-button__count">{favorites.items.length}</span> : null}
            </Link>
            <button
              type="button"
              className="icon-button icon-button--badge"
              aria-label={`Panier (${cart.itemCount} article${cart.itemCount > 1 ? 's' : ''})`}
              onClick={cart.openCart}
            >
              <Icon name="bag" size={20} />
              {cart.itemCount > 0 ? <span className="icon-button__count">{cart.itemCount}</span> : null}
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="search-panel">
            <form className="search-panel__form" onSubmit={submitSearch} role="search">
              <Icon name="search" size={18} />
              <label className="sr-only" htmlFor="site-search">
                Rechercher un produit
              </label>
              <input
                id="site-search"
                ref={searchRef}
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Hoodie, sneakers, cargo…"
                autoComplete="off"
              />
              <button type="submit" className="search-panel__submit">
                Rechercher
              </button>
            </form>
            <button type="button" className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Fermer la recherche">
              <Icon name="close" size={20} />
            </button>
          </div>
        ) : null}
      </header>

      {menuOpen ? (
        <div className="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobile-menu__top">
            <span className="logo">
              <span className="logo__mark">HP</span>
              <span className="logo__word">COLLECTION</span>
            </span>
            <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">
              <Icon name="close" size={22} />
            </button>
          </div>
          <nav aria-label="Navigation mobile">
            {NAV.map((item) => (
              <Link key={item.label} to={item.to} className="mobile-menu__link">
                {item.label}
                <Icon name="arrow-right" size={18} />
              </Link>
            ))}
            {user ? (
              <Link to="/notifications" className="mobile-menu__link">
                Notifications
                <Icon name="bell" size={18} />
              </Link>
            ) : null}
            <Link to="/favoris" className="mobile-menu__link">
              Favoris
              <Icon name="heart" size={18} />
            </Link>
            <Link to={user ? '/compte' : '/connexion'} className="mobile-menu__link">
              {user ? 'Mon compte' : 'Connexion'}
              <Icon name="user" size={18} />
            </Link>
            {user?.isAdmin ? (
              <Link to="/admin" className="mobile-menu__link mobile-menu__link--admin">
                Administration
                <Icon name="lock" size={18} />
              </Link>
            ) : null}
          </nav>
          <p className="mobile-menu__footnote">{settings.storeTagline}</p>
        </div>
      ) : null}
    </>
  );
}
