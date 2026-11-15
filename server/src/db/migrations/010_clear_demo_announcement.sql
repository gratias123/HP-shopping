-- Retire le bandeau d'annonce de démonstration (modifiable ensuite dans Admin → Réglages).
UPDATE settings SET value = ''
WHERE key = 'announcement' AND value = 'Livraison offerte dès 50 000 FCFA à Cotonou (données de démonstration)';
