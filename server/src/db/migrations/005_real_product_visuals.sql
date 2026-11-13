-- Photos produits réelles (illustrations libres de droits).
--
-- Les visuels de démonstration SVG sont remplacés par des photographies
-- locales, sans toucher aux commandes ni aux stocks. Les articles restent
-- identifiés DEMO-* et les photos ne représentent pas les produits réels de
-- la boutique. Crédits : web/public/media/CREDITS.md.

UPDATE product_images
   SET url = '/media/product-hoodie.jpg',
       alt = 'Photo d’illustration : hoodie noir à capuche porté'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-HD01');

UPDATE product_images
   SET url = '/media/product-jogging.jpg',
       alt = 'Photo d’illustration : tenue de jogging sombre portée'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-JG02');

UPDATE product_images
   SET url = '/media/product-sneaker.jpg',
       alt = 'Photo d’illustration : paire de sneakers basses blanches'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-SN03');

UPDATE product_images
   SET url = '/media/product-basket.jpg',
       alt = 'Photo d’illustration : chaussure de basketball montante'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-BK04');

UPDATE product_images
   SET url = '/media/product-tee.jpg',
       alt = 'Photo d’illustration : t-shirt blanc à col rond porté'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-TS05');

UPDATE product_images
   SET url = '/media/product-veste.jpg',
       alt = 'Photo d’illustration : veste noire façon varsity portée'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-VS06');

UPDATE product_images
   SET url = '/media/product-cap.jpg',
       alt = 'Photo d’illustration : casquette grise à visière'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-CP07');

UPDATE product_images
   SET url = '/media/product-cargo.jpg',
       alt = 'Photo d’illustration : pantalon sombre à poches'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-CG08');

UPDATE product_images
   SET url = '/media/product-ensemble.jpg',
       alt = 'Photo d’illustration : ensemble deux pièces porté'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-EN09');

UPDATE product_images
   SET url = '/media/product-sac.jpg',
       alt = 'Photo d’illustration : sac banane zippé'
 WHERE product_id = (SELECT id FROM products WHERE reference = 'DEMO-SB10');

UPDATE categories
   SET image_url = '/media/product-ensemble.jpg',
       image_alt = 'Ensembles & survêtements — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'ensembles-jogging';

UPDATE categories
   SET image_url = '/media/product-sneaker.jpg',
       image_alt = 'Sneakers lifestyle — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'sneakers';

UPDATE categories
   SET image_url = '/media/product-basket.jpg',
       image_alt = 'Chaussures de basketball — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'basketball';

UPDATE categories
   SET image_url = '/media/product-tee.jpg',
       image_alt = 'T-shirts, polos & chemises — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'tshirts';

UPDATE categories
   SET image_url = '/media/product-cargo.jpg',
       image_alt = 'Jeans, pantalons & shorts — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'jeans-pantalons';

UPDATE categories
   SET image_url = '/media/product-hoodie.jpg',
       image_alt = 'Sweats & hoodies — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'sweats-hoodies';

UPDATE categories
   SET image_url = '/media/product-veste.jpg',
       image_alt = 'Vestes & varsity — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'vestes-streetwear';

UPDATE categories
   SET image_url = '/media/product-cap.jpg',
       image_alt = 'Sacs, casquettes & accessoires — photo d’illustration',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE slug = 'accessoires';

UPDATE settings
   SET value = '/media/product-veste.jpg',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE key = 'heroImageUrl'
   AND value = '/media/hero-editorial.svg';

UPDATE settings
   SET value = 'Catalogue de démonstration : les articles, prix et frais présentés sont des exemples. Les photos sont des illustrations libres de droits (Unsplash, Pexels) et ne représentent pas les articles réels HP COLLECTION. Remplacez-les depuis l’administration.',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE key = 'demoNotice'
   AND value LIKE 'Catalogue de démonstration%';
