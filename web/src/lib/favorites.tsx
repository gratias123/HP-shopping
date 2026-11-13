import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { ProductCard } from './types';

export interface FavoriteItem {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  effectivePriceCents: number;
  compareAtCents: number | null;
  onSale: boolean;
  saleEndsAt: string | null;
  category: { name: string; slug: string };
  image: { url: string; alt: string } | null;
  stockTotal: number;
}

interface ServerFavorite extends FavoriteItem {
  reference?: string;
}

interface FavoritesContextValue {
  items: FavoriteItem[];
  isFavorite: (id: string) => boolean;
  toggle: (product: FavoriteItem) => Promise<void>;
  removingId: string | null;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const GUEST_KEY = 'hp_favorites_v1';

function readGuests(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FavoriteItem[]).filter((item) => typeof item?.id === 'string') : [];
  } catch {
    return [];
  }
}

function fromCard(product: ProductCard | FavoriteItem): FavoriteItem {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    effectivePriceCents: product.effectivePriceCents,
    compareAtCents: product.compareAtCents,
    onSale: product.onSale,
    saleEndsAt: product.saleEndsAt,
    category: { name: product.category.name, slug: product.category.slug },
    image: product.image,
    stockTotal: product.stockTotal,
  };
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FavoriteItem[]>(readGuests);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const previousUser = useRef<string | null>(null);
  const guestItems = useRef<FavoriteItem[]>(readGuests());

  useEffect(() => {
    try {
      if (!user) localStorage.setItem(GUEST_KEY, JSON.stringify(items));
      else localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
  }, [items, user]);

  useEffect(() => {
    if (!user) {
      previousUser.current = null;
      setItems(guestItems.current);
      return;
    }
    if (previousUser.current === user.id) return;
    previousUser.current = user.id;

    const sync = async () => {
      const pendingGuests = guestItems.current;
      if (pendingGuests.length) {
        try {
          await api.post('/api/favorites/merge', { productIds: pendingGuests.map((item) => item.id) });
          guestItems.current = [];
        } catch {
          // La fusion échouera silencieusement : les favoris locaux restent affichés.
        }
      }
      try {
        const data = await api.get<{ items: ServerFavorite[] }>('/api/favorites');
        setItems(data.items.map(fromCard));
      } catch {
        // Session expirée : on conserve l'affichage courant.
      }
    };
    void sync();
  }, [user]);

  const isFavorite = useCallback((id: string) => items.some((item) => item.id === id), [items]);

  const toggle = useCallback(
    async (product: FavoriteItem) => {
      const currentlyFavorite = items.some((item) => item.id === product.id);
      const snapshot = fromCard(product);
      if (currentlyFavorite) {
        setRemovingId(product.id);
        setItems((current) => current.filter((item) => item.id !== product.id));
        if (!user) guestItems.current = guestItems.current.filter((item) => item.id !== product.id);
        try {
          if (user) await api.delete(`/api/favorites/${product.id}`);
        } catch {
          setItems((current) => [snapshot, ...current]);
        } finally {
          setRemovingId(null);
        }
      } else {
        setItems((current) => [snapshot, ...current]);
        if (!user) guestItems.current = [snapshot, ...guestItems.current];
        try {
          if (user) await api.post(`/api/favorites/${product.id}`);
        } catch {
          setItems((current) => current.filter((item) => item.id !== product.id));
          if (!user) guestItems.current = guestItems.current.filter((item) => item.id !== product.id);
        }
      }
    },
    [items, user],
  );

  const value = useMemo(() => ({ items, isFavorite, toggle, removingId }), [items, isFavorite, toggle, removingId]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites doit être utilisé dans FavoritesProvider.');
  return context;
}
