-- Visuel éditorial de la page d'accueil.
--
-- Photo d'illustration locale (Pexels), recadrée en 4:3 pour le bandeau
-- d'accueil. Elle ne représente pas un article réel de la boutique.

UPDATE settings
   SET value = '/media/hero-editorial.jpg',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE key = 'heroImageUrl'
   AND value = '/media/product-veste.jpg';
