import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { useNotifications } from '../lib/notifications';
import type { AppNotification } from '../lib/types';

export function NotificationsPage() {
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Notifications · HP COLLECTION';
    void refresh();
  }, [refresh]);

  const open = async (item: AppNotification) => {
    if (!item.read) await markRead(item.id);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="page-shell narrow">
      <header className="page-heading page-heading--compact">
        <div>
          <p className="eyebrow">Mon espace</p>
          <h1>Notifications</h1>
          <p className="page-heading__intro">
          {unreadCount > 0
            ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}.`
            : 'Vous êtes à jour.'}
          </p>
        </div>
      </header>

      <div className="notif-page__actions">
        <button type="button" className="btn btn--ghost" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
          Tout marquer comme lu
        </button>
      </div>

      {loading && notifications.length === 0 ? (
        <p className="notif__empty">Chargement…</p>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune notification</h2>
          <p>Vous serez prévenu ici de l’avancement de vos commandes.</p>
        </div>
      ) : (
        <ul className="notif-page__list">
          {notifications.map((item) => (
            <li key={item.id}>
              <div className={`notif-page__item${item.read ? '' : ' is-unread'}`}>
                <button type="button" className="notif-page__main" onClick={() => void open(item)}>
                  <span className="notif__title">{item.title}</span>
                  {item.body ? <span className="notif__body">{item.body}</span> : null}
                  <time className="notif__time" dateTime={item.createdAt}>
                    {formatDateTime(item.createdAt)}
                  </time>
                </button>
                {!item.read ? (
                  <button type="button" className="notif__link" onClick={() => void markRead(item.id)}>
                    Marquer comme lu
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
