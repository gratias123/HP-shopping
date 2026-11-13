import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../lib/auth';
import { useSite } from '../../lib/site';

const LINKS = [
  { to: '/admin', label: 'Tableau de bord', icon: 'shield' as const, permission: 'orders:read', end: true },
  { to: '/admin/produits', label: 'Produits', icon: 'bag' as const, permission: 'catalog:read' },
  { to: '/admin/categories', label: 'Catégories', icon: 'filter' as const, permission: 'catalog:read' },
  { to: '/admin/commandes', label: 'Commandes', icon: 'truck' as const, permission: 'orders:read' },
  { to: '/admin/promotions', label: 'Promotions', icon: 'check' as const, permission: 'promos:write' },
  { to: '/admin/livraison', label: 'Livraison', icon: 'truck' as const, permission: 'shipping:write' },
  { to: '/admin/messages', label: 'Messages', icon: 'user' as const, permission: 'messages:read' },
  { to: '/admin/parametres', label: 'Paramètres', icon: 'lock' as const, permission: 'settings:write' },
  { to: '/admin/production', label: 'Mise en production', icon: 'shield' as const, permission: 'settings:write' },
  { to: '/admin/audit', label: 'Journal d’audit', icon: 'history' as const, permission: 'audit:read' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'user' as const, permission: 'users:read' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { settings } = useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const links = LINKS.filter((link) => user.permissions.includes(link.permission));
  const current = links.find((link) => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)));

  return (
    <div className="admin">
      <aside className={`admin__sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin__brand">
          <Link to="/admin" className="logo logo--admin">
            <span className="logo__mark">HP</span>
            <span className="logo__word">COLLECTION</span>
          </Link>
          <span className="admin__badge">Administration</span>
        </div>
        <nav className="admin__nav" aria-label="Navigation administration">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={link.icon} size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin__sidebar-foot">
          <Link to="/" className="admin__store-link">
            <Icon name="arrow-left" size={16} /> Voir la boutique
          </Link>
          <div className="admin__user">
            <span>
              <strong>{user.fullName || 'Administrateur'}</strong>
              <small>{user.email}</small>
            </span>
            <button
              type="button"
              className="admin__logout"
              onClick={async () => {
                await logout();
                navigate('/connexion');
              }}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="admin__main">
        <header className="admin__topbar">
          <button
            type="button"
            className="icon-button admin__burger"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Ouvrir le menu d’administration"
            aria-expanded={menuOpen}
          >
            <Icon name="menu" size={20} />
          </button>
          <div>
            <p className="eyebrow">HP COLLECTION</p>
            <h1>{current?.label ?? 'Administration'}</h1>
          </div>
          <p className="admin__tagline">{settings.storeTagline}</p>
        </header>
        <div className="admin__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
