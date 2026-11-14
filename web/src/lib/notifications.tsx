import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { AppNotification } from './types';

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000;

interface ListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

/**
 * Notifications internes : liste persistante côté serveur, rafraîchie à
 * intervalle régulier et au retour sur l'onglet. Le serveur reste la source de
 * vérité : le compteur affiché vient de la base, jamais d'un calcul local.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const activeUser = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.get<ListResponse>('/api/notifications?limit=50');
      if (activeUser.current !== userId) return;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Une panne réseau ponctuelle ne doit pas perturber la navigation.
    }
  }, [userId]);

  useEffect(() => {
    activeUser.current = userId;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    void refresh().finally(() => setLoading(false));
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      try {
        const data = await api.post<{ unreadCount: number }>(`/api/notifications/${id}/read`);
        setUnreadCount(data.unreadCount);
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await api.post('/api/notifications/read-all');
    } catch {
      await refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refresh, markRead, markAllRead }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications doit être utilisé dans NotificationsProvider.');
  return context;
}
