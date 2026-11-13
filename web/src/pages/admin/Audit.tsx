import { useState } from 'react';
import { ErrorState, Seo, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { AuditEntry } from '../../lib/types';

export function AdminAuditPage() {
  const { data, loading, error, reload } = useApi<{ entries: AuditEntry[] }>('/api/admin/audit?limit=200');
  const [term, setTerm] = useState('');

  const entries = (data?.entries ?? []).filter((entry) => {
    const query = term.trim().toLowerCase();
    if (!query) return true;
    return [entry.action, entry.entity, entry.entityId ?? '', entry.actorEmail, entry.actorName]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  return (
    <>
      <Seo title="Journal d’audit" />
      <div className="admin-toolbar">
        <p className="muted">
          {data ? `${data.entries.length} événement${data.entries.length > 1 ? 's' : ''}` : ' '} — lecture seule.
        </p>
        <div className="inline-search">
          <label className="sr-only" htmlFor="admin-audit-search">
            Rechercher dans le journal
          </label>
          <input
            id="admin-audit-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Action, entité, acteur…"
          />
        </div>
      </div>

      <div className="alert alert--warning">
        <strong>Journal d’audit.</strong> Les entrées sont conservées côté serveur et ne peuvent pas être modifiées
        depuis cette page. Les détails peuvent contenir des identifiants techniques, jamais de mot de passe ni de clé de
        paiement.
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner label="Chargement du journal" /> : null}

      {data && entries.length === 0 ? (
        <div className="empty-state">
          <h2>Aucun événement</h2>
          <p>Les connexions staff, modifications de paramètres et actions sensibles apparaîtront ici.</p>
        </div>
      ) : null}

      {entries.length ? (
        <div className="table-wrap admin-panel admin-panel--flush">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Acteur</th>
                <th>Action</th>
                <th>Entité</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>
                    {entry.actorName || 'Système / inconnu'}
                    {entry.actorEmail ? <small className="muted">{entry.actorEmail}</small> : null}
                  </td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    {entry.entity}
                    {entry.entityId ? <small className="muted mono">{entry.entityId}</small> : null}
                  </td>
                  <td>
                    <details>
                      <summary>Voir</summary>
                      <pre className="audit-details">{JSON.stringify(entry.details, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
