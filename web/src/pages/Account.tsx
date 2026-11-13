import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddressBook } from '../components/AddressBook';
import { Icon } from '../components/Icon';
import { Seo, StatusBadge } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatPrice } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSite } from '../lib/site';
import { useToast } from '../lib/toast';
import type { Order } from '../lib/types';

type Tab = 'orders' | 'addresses' | 'profile' | 'security';

export function AccountPage() {
  const { user, logout, refresh, setUser } = useAuth();
  const navigate = useNavigate();
  const { store } = useSite();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('orders');

  const orders = useApi<{ orders: Order[] }>(user ? '/api/orders' : null);

  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) return null;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    try {
      await api.patch('/api/auth/profile', { fullName: profile.fullName, phone: profile.phone });
      setUser({ ...user, fullName: profile.fullName, phone: profile.phone });
      await refresh();
      toast.push('Vos informations ont été mises à jour.', 'success');
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Mise à jour impossible.');
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setPasswordBusy(true);
    try {
      await api.post('/api/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.push('Mot de passe modifié. Vos autres sessions ont été déconnectées.', 'success');
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : 'Modification impossible.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <Seo title="Mon compte" />
      <div className="page-shell account">
        <aside className="account__aside">
          <p className="eyebrow">Espace client</p>
          <h1>{user.fullName || 'Mon compte'}</h1>
          <p className="muted">{user.email}</p>
          <nav className="account__nav" aria-label="Espace client">
            <button type="button" className={tab === 'orders' ? 'is-active' : ''} onClick={() => setTab('orders')}>
              <Icon name="bag" size={18} /> Commandes
              {orders.data ? <span>{orders.data.orders.length}</span> : null}
            </button>
            <button type="button" className={tab === 'addresses' ? 'is-active' : ''} onClick={() => setTab('addresses')}>
              <Icon name="pin" size={18} /> Adresses
            </button>
            <button type="button" className={tab === 'profile' ? 'is-active' : ''} onClick={() => setTab('profile')}>
              <Icon name="user" size={18} /> Informations
            </button>
            <button type="button" className={tab === 'security' ? 'is-active' : ''} onClick={() => setTab('security')}>
              <Icon name="lock" size={18} /> Sécurité
            </button>
            <Link to="/favoris">
              <Icon name="heart" size={18} /> Favoris
            </Link>
            {user.isAdmin ? (
              <Link to="/admin">
                <Icon name="shield" size={18} /> Administration
              </Link>
            ) : null}
          </nav>
          <button type="button" className="link-small link-small--danger account__logout" onClick={signOut}>
            Se déconnecter
          </button>
        </aside>

        <section className="account__content">
          {tab === 'orders' ? (
            <div>
              <header className="account__heading">
                <h2>Mes commandes</h2>
                <p className="muted">Retrouvez l’historique et l’état de chaque commande.</p>
              </header>
              {orders.loading ? <p className="muted">Chargement des commandes…</p> : null}
              {orders.error ? <p className="form-error">{orders.error.message}</p> : null}
              {orders.data?.orders.length === 0 ? (
                <div className="empty-state">
                  <h3>Aucune commande pour le moment</h3>
                  <p>Votre prochaine sélection apparaîtra ici.</p>
                  <Link to="/boutique" className="btn btn--primary">
                    Découvrir la boutique
                  </Link>
                </div>
              ) : null}
              <ul className="account-orders">
                {orders.data?.orders.map((order) => (
                  <li key={order.id} className="account-order">
                    <div className="account-order__head">
                      <div>
                        <p className="account-order__ref">{order.reference}</p>
                        <p className="muted">{formatDate(order.createdAt)}</p>
                      </div>
                      <StatusBadge status={order.status} label={order.statusLabel} />
                    </div>
                    <div className="account-order__body">
                      <div className="account-order__thumbs">
                        {order.items.slice(0, 3).map((item) => (
                          <span key={item.id}>
                            {item.imageUrl ? <img src={item.imageUrl} alt="" width="48" height="60" /> : null}
                          </span>
                        ))}
                        {order.items.length > 3 ? <span className="account-order__more">+{order.items.length - 3}</span> : null}
                      </div>
                      <p>
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} article
                        {order.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 's' : ''}
                      </p>
                      <strong>{formatPrice(order.totalCents, order.currency || store.currency)}</strong>
                    </div>
                    <div className="account-order__actions">
                      <Link to={`/compte/commandes/${order.id}`} className="btn btn--ghost btn--small">
                        Voir le détail
                      </Link>
                      <Link to={`/suivi?reference=${order.reference}`} className="link-small">
                        Suivre
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === 'addresses' ? <AddressBook /> : null}

          {tab === 'profile' ? (
            <div>
              <header className="account__heading">
                <h2>Informations personnelles</h2>
                <p className="muted">Ces informations peuvent préremplir vos prochaines commandes.</p>
              </header>
              <form className="stack-form account-form" onSubmit={saveProfile}>
                <label className="field">
                  <span>Nom complet</span>
                  <input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Téléphone</span>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Facultatif"
                  />
                </label>
                <label className="field">
                  <span>Adresse e-mail</span>
                  <input value={user.email} disabled />
                  <small>Pour modifier votre e-mail, contactez la boutique.</small>
                </label>
                {profileError ? <p className="form-error">{profileError}</p> : null}
                <button type="submit" className="btn btn--primary" disabled={profileBusy}>
                  {profileBusy ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </form>
            </div>
          ) : null}

          {tab === 'security' ? (
            <div>
              <header className="account__heading">
                <h2>Sécurité</h2>
                <p className="muted">Modifiez votre mot de passe. Toutes les autres sessions seront déconnectées.</p>
              </header>
              <form className="stack-form account-form" onSubmit={savePassword}>
                <label className="field">
                  <span>Mot de passe actuel</span>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </label>
                <label className="field">
                  <span>Nouveau mot de passe</span>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                <label className="field">
                  <span>Confirmer le nouveau mot de passe</span>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))}
                    required
                    autoComplete="new-password"
                  />
                </label>
                {passwordError ? <p className="form-error">{passwordError}</p> : null}
                <button type="submit" className="btn btn--primary" disabled={passwordBusy}>
                  {passwordBusy ? 'Modification…' : 'Modifier le mot de passe'}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
