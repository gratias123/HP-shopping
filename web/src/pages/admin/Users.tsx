import { useState } from 'react';
import { ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import type { AdminUser } from '../../lib/types';

export function AdminUsersPage() {
  const { data, loading, error, reload } = useApi<{ users: AdminUser[] }>('/api/admin/users');
  const { user: currentUser, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [term, setTerm] = useState('');

  const update = async (target: AdminUser, payload: { role?: string; status?: string }, message: string) => {
    setBusy(target.id);
    try {
      await api.patch(`/api/admin/users/${target.id}`, payload);
      toast.push(message, 'success');
      reload();
      if (target.id === currentUser?.id) await refresh();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Action impossible.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const users = (data?.users ?? []).filter((entry) => {
    const query = term.trim().toLowerCase();
    if (!query) return true;
    return entry.email.toLowerCase().includes(query) || entry.fullName.toLowerCase().includes(query);
  });

  return (
    <>
      <Seo title="Utilisateurs" />
      <div className="admin-toolbar">
        <p className="muted">
          {data ? `${data.users.length} compte${data.users.length > 1 ? 's' : ''}` : ' '} — rôles et accès.
        </p>
        <div className="inline-search">
          <label className="sr-only" htmlFor="admin-user-search">
            Rechercher un utilisateur
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Nom ou e-mail"
          />
        </div>
      </div>

      <div className="alert alert--warning">
        <strong>Attention.</strong> Modifier un rôle déconnecte immédiatement l’utilisateur concerné. Le dernier
        administrateur actif ne peut pas être rétrogradé ou désactivé. Vous ne pouvez pas modifier votre propre rôle ni
        désactiver votre propre compte.
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner label="Chargement des comptes" /> : null}

      <div className="table-wrap admin-panel admin-panel--flush">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Inscription</th>
              <th className="num">Commandes</th>
              <th>Rôle</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {entry.fullName || '—'}
                  <small className="muted">{entry.email}</small>
                  {entry.id === currentUser?.id ? <small className="sale-tag">vous</small> : null}
                </td>
                <td>{formatDate(entry.createdAt)}</td>
                <td className="num">{entry.orderCount}</td>
                <td>
                  <select
                    value={entry.role}
                    disabled={busy === entry.id || entry.id === currentUser?.id}
                    onChange={(event) => {
                      if (!window.confirm(`Changer le rôle de ${entry.email} en « ${event.target.value} » ?`)) {
                        reload();
                        return;
                      }
                      void update(entry, { role: event.target.value }, 'Rôle mis à jour.');
                    }}
                  >
                    <option value="customer">Client</option>
                    <option value="staff">Équipe</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </td>
                <td>
                  <StatusBadge
                    status={entry.status === 'active' ? 'published' : 'cancelled'}
                    label={entry.status === 'active' ? 'Actif' : 'Désactivé'}
                  />
                  <button
                    type="button"
                    className="link-small"
                    disabled={busy === entry.id || entry.id === currentUser?.id}
                    onClick={() => {
                      const next = entry.status === 'active' ? 'disabled' : 'active';
                      if (!window.confirm(`${next === 'disabled' ? 'Désactiver' : 'Réactiver'} le compte ${entry.email} ?`)) return;
                      void update(entry, { status: next }, next === 'disabled' ? 'Compte désactivé.' : 'Compte réactivé.');
                    }}
                  >
                    {entry.status === 'active' ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Les comptes administrateurs sont créés uniquement en ligne de commande (
        <code>npm run admin:create</code>) ou promus depuis cette page. Les permissions détaillées sont définies par les
        rôles (client, équipe, administrateur) et vérifiées à chaque requête côté serveur.
      </p>
    </>
  );
}
