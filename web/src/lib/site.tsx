import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { SiteSettings, StoreConfig } from './types';

export const FALLBACK_SETTINGS: SiteSettings = {
  storeName: 'HP COLLECTION',
  storeTagline: 'Ton style. Tes règles.',
  storeAddress: '',
  storeCity: 'Cotonou',
  storeCountry: 'Bénin',
  heroTitle: 'Le vestiaire urbain, sans compromis.',
  heroSubtitle:
    'Streetwear, sneakers et accessoires sélectionnés pour composer un style qui vous ressemble.',
  heroCtaLabel: 'Découvrir la boutique',
  heroCtaHref: '/boutique',
  heroImageUrl: '/media/hero-editorial.jpg',
  announcement: '',
  contactEmail: 'contact@hpcollection.example',
  contactPhone: '',
  whatsappNumber: '',
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
  legalName: '',
  legalForm: '',
  legalRccm: '',
  legalIfu: '',
  legalVatNumber: '',
  legalAddress: '',
  legalPublisher: '',
  legalComplaintAuthority: '',
  legalUpdatedAt: '',
  hostName: '',
  hostAddress: '',
  hostPhone: '',
  hostEmail: '',
  freeShippingThresholdCents: 5_000_000,
  codEnabled: true,
  demoNotice: '',
};

export const FALLBACK_STORE: StoreConfig = {
  currency: 'XOF',
  country: 'BJ',
  mobileMoneyEnabled: false,
  lowStockThreshold: 5,
};

interface SiteContextValue {
  settings: SiteSettings;
  store: StoreConfig;
  loading: boolean;
  currencies: string[];
  reload: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue>({
  settings: FALLBACK_SETTINGS,
  store: FALLBACK_STORE,
  loading: true,
  currencies: ['XOF'],
  reload: async () => {},
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(FALLBACK_SETTINGS);
  const [store, setStore] = useState<StoreConfig>(FALLBACK_STORE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await api.get<{ settings: SiteSettings; store: StoreConfig }>('/api/store', signal);
      setSettings({ ...FALLBACK_SETTINGS, ...data.settings });
      setStore(data.store);
    } catch {
      // Les valeurs de repli restent affichées : la boutique ne casse pas.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const value = useMemo(
    () => ({ settings, store, loading, currencies: [store.currency], reload }),
    [settings, store, loading, reload],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  return useContext(SiteContext);
}
