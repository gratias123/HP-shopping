-- Catalogue : genre, collection et arbre de catégories évolutif.
--
-- * products.gender  : public concerné (homme, femme ou mixte).
-- * products.collection : nom de collection libre, administrable depuis la fiche produit.
-- * Catégories : trois rayons (parent_id NULL) et leurs sous-catégories. L'arbre est
--   inséré sans écraser l'existant (INSERT OR IGNORE sur le slug) ; l'administrateur
--   peut ensuite renommer, réordonner, masquer ou ajouter des catégories.
-- * Visuel d'accueil : remplace uniquement l'ancien visuel par défaut.

ALTER TABLE products ADD COLUMN gender TEXT NOT NULL DEFAULT 'mixte';
ALTER TABLE products ADD COLUMN collection TEXT;
CREATE INDEX idx_products_gender ON products (gender);
CREATE INDEX idx_products_collection ON products (collection);

-- Rayons
INSERT OR IGNORE INTO categories (id, slug, name, description, image_url, image_alt, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'mode-homme', 'Mode homme', 'Joggings, ensembles, hoodies, vestes et sneakers pour homme.', '/media/product-ensemble.jpg', 'Mannequin portant une veste varsity et un pantalon de survêtement — photo d’illustration', NULL, 0, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, image_url, image_alt, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'mode-femme', 'Mode femme', 'Ensembles, joggings, vestes, sneakers et accessoires pour femme.', NULL, NULL, NULL, 1, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, image_url, image_alt, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-streetwear', 'Sport & streetwear', 'Tenues basketball, maillots, shorts et ensembles sportifs.', '/media/product-basket.jpg', 'Chaussure de basketball montante — photo d’illustration', NULL, 2, 1);

-- Sous-catégories
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-joggings', 'Joggings', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 0, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-ensembles-deux-pieces', 'Ensembles deux pièces', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 1, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-t-shirts', 'T-shirts', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 2, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-polos', 'Polos', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 3, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-jeans', 'Jeans', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 4, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-pantalons', 'Pantalons', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 5, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-hoodies', 'Hoodies', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 6, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-vestes', 'Vestes', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 7, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-sneakers', 'Sneakers', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 8, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-chaussures-basketball', 'Chaussures de basketball', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 9, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-sandales', 'Sandales', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 10, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-casquettes', 'Casquettes', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 11, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'homme-sacs-accessoires', 'Sacs et accessoires', '', (SELECT id FROM categories WHERE slug = 'mode-homme'), 12, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-ensembles', 'Ensembles', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 0, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-joggings', 'Joggings', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 1, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-t-shirts', 'T-shirts', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 2, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-jeans', 'Jeans', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 3, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-pantalons', 'Pantalons', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 4, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-vestes', 'Vestes', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 5, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-sneakers', 'Sneakers', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 6, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-chaussures', 'Chaussures', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 7, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-sacs', 'Sacs', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 8, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'femme-accessoires', 'Accessoires', '', (SELECT id FROM categories WHERE slug = 'mode-femme'), 9, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-tenues-basketball', 'Tenues basketball', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 0, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-maillots', 'Maillots', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 1, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-shorts', 'Shorts', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 2, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-chaussures-sportives', 'Chaussures sportives', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 3, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-ensembles-sportifs', 'Ensembles sportifs', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 4, 1);
INSERT OR IGNORE INTO categories (id, slug, name, description, parent_id, sort_order, published)
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), 'sport-tenues-casual', 'Tenues casual', '', (SELECT id FROM categories WHERE slug = 'sport-streetwear'), 5, 1);

UPDATE settings
   SET value = '/media/hero-hp-collection.jpg',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE key = 'heroImageUrl'
   AND value = '/media/hero-editorial.jpg';
