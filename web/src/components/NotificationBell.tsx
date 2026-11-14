import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { useNotifications } from '../lib/notifications';
import type { AppNotification } from '../lib/types';
import { Icon } from './Icon';

export function NotificationBell({ variant = 'site' }: { variant?: 'site' | 'admin' }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = async (item: AppNotification) => {
    if (!item.read) await markRead(item.id);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const preview = notifications.slice(0, 8);
  const label =
    unreadCount > 0 ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})` : 'Notifications';

  return (
    <div className={`notif notif--${variant}`} ref={root}>
      <button
        type="button"
        className="icon-button icon-button--badge"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 ? <span className="icon-button__count">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notif__panel" role="region" aria-label="Notifications">
          <div className="notif__head">
            <strong>Notifications</strong>
            <button type="button" className="notif__link" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Tout marquer comme lu
            </button>
          </div>
          {preview.length === 0 ? (
            <p className="notif__empty">Aucune notification pour le moment.</p>
          ) : (
            <ul className="notif__list">
              {preview.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notif__item${item.read ? '' : ' is-unread'}`}
                    onClick={() => void openNotification(item)}
                  >
                    <span className="notif__title">{item.title}</span>
                    {item.body ? <span className="notif__body">{item.body}</span> : null}
                    <time className="notif__time" dateTime={item.createdAt}>
                      {formatDateTime(item.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="notif__foot">
            <Link to="/notifications" className="notif__link">
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
