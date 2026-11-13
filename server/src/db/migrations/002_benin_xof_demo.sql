-- Passage des données de démonstration historiques (France / EUR) vers le
-- marché Bénin / XOF. Cette migration ne touche que les lignes de démonstration
-- reconnaissables et laisse intactes les commandes et les données réelles.
-- Sur une base neuve, elle ne fait rien : le seed insère directement les
-- valeurs Bénin / XOF.

-- Produits de démonstration : anciens prix en centimes d'euro -> prix FCFA
-- stockés dans la même colonne de centimes (1 FCFA = 100 centimes internes).
UPDATE products SET price_cents = 2290000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-HD01' AND price_cents = 6990;

UPDATE products SET price_cents = 1890000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-JG02' AND price_cents = 5990;
UPDATE products SET sale_price_cents = 1490000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-JG02' AND sale_price_cents = 4790;

UPDATE products SET price_cents = 3490000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-SN03' AND price_cents = 9990;

UPDATE products SET price_cents = 4490000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-BK04' AND price_cents = 12990;

UPDATE products SET price_cents = 990000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-TS05' AND price_cents = 2990;

UPDATE products SET price_cents = 4990000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-VS06' AND price_cents = 14990;
UPDATE products SET sale_price_cents = 3990000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-VS06' AND sale_price_cents = 11990;

UPDATE products SET price_cents = 790000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-CP07' AND price_cents = 2490;

UPDATE products SET price_cents = 2490000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-CG08' AND price_cents = 7490;

UPDATE products SET price_cents = 2990000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-EN09' AND price_cents = 8990;

UPDATE products SET price_cents = 1290000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reference = 'DEMO-SB10' AND price_cents = 3990;

-- Réglages de démonstration.
UPDATE settings SET value = '5000000', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'freeShippingThresholdCents' AND value = '8000';

UPDATE settings SET value = 'Livraison offerte dès 50 000 FCFA à Cotonou (données de démonstration)',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'announcement' AND value LIKE '%80 %';

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('storeName', 'HP COLLECTION', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('storeAddress', '', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('storeCity', 'Cotonou', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('storeCountry', 'Bénin', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('whatsappNumber', '', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('facebookUrl', '', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('tiktokUrl', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Ancienne zone de démonstration : on la désactive et on ajoute la zone Bénin.
-- Les commandes historiques conservent leurs instantanés de livraison.
UPDATE shipping_zones SET active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE name IN ('France métropolitaine', 'Union européenne') AND active = 1;

INSERT INTO shipping_zones (id, name, countries, active, sort_order, created_at, updated_at)
SELECT '00000000-0000-4000-8000-0000000000b1', 'Bénin', 'BJ', 1, 0,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS (SELECT 1 FROM shipping_zones WHERE name = 'France métropolitaine')
  AND NOT EXISTS (SELECT 1 FROM shipping_zones WHERE countries = 'BJ' AND active = 1);

INSERT INTO shipping_methods (id, zone_id, name, description, price_cents, free_over_cents, min_days, max_days, active, sort_order, created_at, updated_at)
SELECT '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1',
       'Livraison Cotonou',
       'Livraison à Cotonou. Tarif et délai de démonstration, à confirmer par la boutique.',
       150000, 5000000, 1, 2, 1, 0,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS (SELECT 1 FROM shipping_zones WHERE id = '00000000-0000-4000-8000-0000000000b1')
  AND NOT EXISTS (SELECT 1 FROM shipping_methods WHERE name = 'Livraison Cotonou');

INSERT INTO shipping_methods (id, zone_id, name, description, price_cents, free_over_cents, min_days, max_days, active, sort_order, created_at, updated_at)
SELECT '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b1',
       'Livraison nationale',
       'Livraison au Bénin hors Cotonou. Tarif et délai de démonstration, à confirmer par la boutique.',
       250000, 7500000, 2, 4, 1, 1,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS (SELECT 1 FROM shipping_zones WHERE id = '00000000-0000-4000-8000-0000000000b1')
  AND NOT EXISTS (SELECT 1 FROM shipping_methods WHERE name = 'Livraison nationale');

-- Minimum du code de bienvenue exprimé en FCFA.
UPDATE promo_codes SET min_subtotal_cents = 500000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE code = 'BIENVENUE10' AND min_subtotal_cents = 5000;
