import { config } from '../config.js';
import { execute, queryAll } from '../db/index.js';

export interface SiteSettings {
  storeName: string;
  storeTagline: string;
  storeAddress: string;
  storeCity: string;
  storeCountry: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroImageUrl: string;
  announcement: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  legalName: string;
  legalForm: string;
  legalRccm: string;
  legalIfu: string;
  legalVatNumber: string;
  legalAddress: string;
  legalPublisher: string;
  legalComplaintAuthority: string;
  legalUpdatedAt: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  hostEmail: string;
  freeShippingThresholdCents: number;
  codEnabled: boolean;
  demoNotice: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'HP COLLECTION',
  storeTagline: 'Ton style. Tes règles.',
  storeAddress: '',
  storeCity: 'Cotonou',
  storeCountry: 'Bénin',
  heroTitle: 'Le vestiaire urbain, sans compromis.',
  heroSubtitle:
    'Streetwear, sneakers et accessoires sélectionnés pour composer un style qui vous ressemble. Des pièces actuelles, des matières pensées pour le quotidien.',
  heroCtaLabel: 'Découvrir la boutique',
  heroCtaHref: '/boutique',
  heroImageUrl: '/media/hero-hp-collection.jpg',
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

const BOOLEAN_KEYS = new Set(['codEnabled']);
const NUMBER_KEYS = new Set(['freeShippingThresholdCents']);

export function getSettings(): SiteSettings {
  const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: SiteSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as keyof SiteSettings;
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (BOOLEAN_KEYS.has(key)) {
      settings[key] = (row.value === 'true') as never;
    } else if (NUMBER_KEYS.has(key)) {
      settings[key] = Number(row.value) as never;
    } else {
      settings[key] = row.value as never;
    }
  }
  return settings;
}

/** Champs réservés à l'administration : jamais renvoyés par l'API publique. */
const ADMIN_ONLY_KEYS = new Set<keyof SiteSettings>(['hostName', 'hostAddress', 'hostPhone', 'hostEmail', 'legalPublisher']);

/** Réglages publics de la boutique (sans coordonnées internes ni informations d'administration). */
export function getPublicSettings(): Partial<SiteSettings> {
  const all = getSettings();
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => !ADMIN_ONLY_KEYS.has(key as keyof SiteSettings)),
  ) as Partial<SiteSettings>;
}

export function saveSettings(values: SiteSettings): SiteSettings {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    execute(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, String(value)],
    );
  }
  return getSettings();
}

export function publicStoreConfig() {
  return {
    currency: config.currency,
    country: config.defaultCountry,
    // L'intégration Mobile Money n'est exposée qu'après validation serveur
    // du prestataire et des webhooks. Ce drapeau restera false tant que
    // l'adaptateur de paiement n'est pas branché.
    mobileMoneyEnabled: false,
    lowStockThreshold: config.lowStockThreshold,
  };
}
