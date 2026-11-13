import { useState } from 'react';
import { EmptyState, ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import type { ContactMessage } from '../../lib/types';

export function AdminMessagesPage() {
  const { data, loading, error, reload } = useApi<{ messages: ContactMessage[] }>('/api/admin/messages');
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'archived'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (message: ContactMessage, status: ContactMessage['status']) => {
    setBusy(message.id);
    try {
      await api.patch(`/api/admin/messages/${message.id}`, { status });
      toast.push('Message mis à jour.', 'success');
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Action impossible.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const messages = (data?.messages ?? []).filter((message) => filter === 'all' || message.status === filter);
  const newCount = data?.messages.filter((message) => message.status === 'new').length ?? 0;

  return (
    <>
      <Seo title="Messages" />
      <div className="admin-toolbar">
        <div className="admin-tabs">
          {(
            [
              { value: 'all', label: 'Tous' },
              { value: 'new', label: `Nouveaux${newCount ? ` (${newCount})` : ''}` },
              { value: 'read', label: 'Lus' },
              { value: 'archived', label: 'Archivés' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={filter === tab.value ? 'is-active' : ''}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={reload}>
          Actualiser
        </button>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner label="Chargement des messages" /> : null}
      {data && messages.length === 0 ? (
        <EmptyState
          title="Aucun message"
          description="Les demandes envoyées depuis la page de contact apparaîtront ici."
        />
      ) : null}

      <div className="message-list">
        {messages.map((message) => {
          const open = openId === message.id;
          return (
            <article key={message.id} className={`message-card ${message.status === 'new' ? 'is-new' : ''}`}>
              <button
                type="button"
                className="message-card__head"
                onClick={() => {
                  setOpenId(open ? null : message.id);
                  if (!open && message.status === 'new') void setStatus(message, 'read');
                }}
                aria-expanded={open}
              >
                <span className="message-card__subject">
                  <strong>{message.subject}</strong>
                  <small>
                    {message.name} · {message.email}
                  </small>
                </span>
                <span className="message-card__meta">
                  <StatusBadge
                    status={message.status === 'new' ? 'pending' : message.status === 'read' ? 'confirmed' : 'archived'}
                    label={message.status === 'new' ? 'Nouveau' : message.status === 'read' ? 'Lu' : 'Archivé'}
                  />
                  <small>{formatDateTime(message.createdAt)}</small>
                  <Icon name="arrow-right" size={16} style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
                </span>
              </button>
              {open ? (
                <div className="message-card__body">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{message.message}</p>
                  <div className="message-card__actions">
                    <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="btn btn--primary btn--small">
                      Répondre par e-mail
                    </a>
                    {message.status !== 'read' ? (
                      <button type="button" className="btn btn--ghost btn--small" disabled={busy === message.id} onClick={() => setStatus(message, 'read')}>
                        Marquer comme lu
                      </button>
                    ) : null}
                    {message.status !== 'archived' ? (
                      <button type="button" className="btn btn--ghost btn--small" disabled={busy === message.id} onClick={() => setStatus(message, 'archived')}>
                        Archiver
                      </button>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--small" disabled={busy === message.id} onClick={() => setStatus(message, 'read')}>
                        Désarchiver
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
