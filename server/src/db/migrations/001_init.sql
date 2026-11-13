-- ============================================================================
-- HP COLLECTION — schéma local (SQLite)
-- Miroir fidèle du schéma de production PostgreSQL/Supabase
-- (voir supabase/migrations). Montants en centimes, dates ISO 8601 UTC.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- Rôles et permissions -------------------------------------------------------
CREATE TABLE roles (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_slug   TEXT NOT NULL REFERENCES roles(slug) ON DELETE CASCADE,
  permission  TEXT NOT NULL,
  PRIMARY KEY (role_slug, permission)
);

INSERT INTO roles (slug, label) VALUES
  ('customer', 'Client'),
  ('staff', 'Équipe boutique'),
  ('admin', 'Administrateur');

INSERT INTO role_permissions (role_slug, permission) VALUES
  ('admin', 'catalog:read'), ('admin', 'catalog:write'),
  ('admin', 'orders:read'), ('admin', 'orders:write'),
  ('admin', 'promos:write'), ('admin', 'shipping:write'),
  ('admin', 'settings:write'), ('admin', 'users:read'),
  ('admin', 'messages:read'),
  ('staff', 'catalog:read'), ('staff', 'catalog:write'),
  ('staff', 'orders:read'), ('staff', 'orders:write'),
  ('staff', 'promos:write'), ('staff', 'shipping:write'),
  ('staff', 'messages:read');

-- Comptes --------------------------------------------------------------------
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL DEFAULT '',
  phone          TEXT,
  role_slug      TEXT NOT NULL DEFAULT 'customer' REFERENCES roles(slug),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

-- Catalogue ------------------------------------------------------------------
CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  image_url    TEXT,
  image_alt    TEXT,
  parent_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_categories_public ON categories(published, sort_order);

CREATE TABLE products (
  id                 TEXT PRIMARY KEY,
  reference          TEXT NOT NULL UNIQUE,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  short_description  TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  composition        TEXT,
  care               TEXT,
  category_id        TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price_cents        INTEGER NOT NULL CHECK (price_cents >= 0),
  sale_price_cents   INTEGER CHECK (sale_price_cents IS NULL OR (sale_price_cents >= 0 AND sale_price_cents <= price_cents)),
  sale_starts_at     TEXT,
  sale_ends_at       TEXT,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured        INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  low_stock_alert    INTEGER,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_status ON products(status, created_at DESC);
CREATE INDEX idx_products_category ON products(category_id, status);
CREATE INDEX idx_products_name ON products(name);

CREATE TABLE product_images (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);

CREATE TABLE product_variants (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku         TEXT NOT NULL UNIQUE,
  size        TEXT NOT NULL,
  color       TEXT NOT NULL,
  color_hex   TEXT,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (product_id, size, color)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE TABLE wishlists (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, product_id)
);

-- Promotions -----------------------------------------------------------------
CREATE TABLE promo_codes (
  id                   TEXT PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  description          TEXT NOT NULL DEFAULT '',
  type                 TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value                INTEGER NOT NULL CHECK (value > 0),
  min_subtotal_cents   INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal_cents >= 0),
  starts_at            TEXT,
  ends_at              TEXT,
  max_uses             INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  max_uses_per_customer INTEGER CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer > 0),
  used_count           INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Livraison ------------------------------------------------------------------
CREATE TABLE shipping_zones (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  countries   TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE shipping_methods (
  id               TEXT PRIMARY KEY,
  zone_id          TEXT NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  free_over_cents  INTEGER CHECK (free_over_cents IS NULL OR free_over_cents >= 0),
  min_days         INTEGER CHECK (min_days IS NULL OR min_days >= 0),
  max_days         INTEGER CHECK (max_days IS NULL OR max_days >= 0),
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_shipping_methods_zone ON shipping_methods(zone_id);

-- Commandes ------------------------------------------------------------------
CREATE TABLE orders (
  id                    TEXT PRIMARY KEY,
  reference             TEXT NOT NULL UNIQUE,
  user_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_method        TEXT NOT NULL CHECK (payment_method IN ('cod', 'card')),
  payment_status        TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  subtotal_cents        INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents        INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents        INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents           INTEGER NOT NULL CHECK (total_cents >= 0),
  currency              TEXT NOT NULL,
  promo_code            TEXT,
  promo_id              TEXT REFERENCES promo_codes(id) ON DELETE SET NULL,
  shipping_first_name   TEXT NOT NULL,
  shipping_last_name    TEXT NOT NULL,
  shipping_line1        TEXT NOT NULL,
  shipping_line2        TEXT NOT NULL DEFAULT '',
  shipping_postal_code  TEXT NOT NULL,
  shipping_city         TEXT NOT NULL,
  shipping_country      TEXT NOT NULL,
  shipping_zone_id      TEXT,
  shipping_method_id    TEXT,
  shipping_method_label TEXT NOT NULL DEFAULT '',
  customer_note         TEXT NOT NULL DEFAULT '',
  internal_note         TEXT NOT NULL DEFAULT '',
  stock_released        INTEGER NOT NULL DEFAULT 0 CHECK (stock_released IN (0, 1)),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents)
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_orders_email ON orders(email, created_at DESC);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id         TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name       TEXT NOT NULL,
  product_reference  TEXT NOT NULL,
  variant_size       TEXT NOT NULL DEFAULT '',
  variant_color      TEXT NOT NULL DEFAULT '',
  image_url          TEXT,
  unit_price_cents   INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents   INTEGER NOT NULL CHECK (line_total_cents >= 0),
  CHECK (line_total_cents = unit_price_cents * quantity)
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE order_status_history (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  actor_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label    TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_order_history_order ON order_status_history(order_id, created_at);

CREATE TABLE payments (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_reference  TEXT,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_payments_provider_ref ON payments(provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payments_order ON payments(order_id);

-- Traçabilité des codes promo (après orders) ---------------------------------
CREATE TABLE promo_redemptions (
  id          TEXT PRIMARY KEY,
  promo_id    TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (promo_id, order_id)
);
CREATE INDEX idx_redemptions_email ON promo_redemptions(promo_id, email);

-- Idempotence des notifications prestataire (paiement) -----------------------
CREATE TABLE webhook_events (
  id             TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  event_id       TEXT NOT NULL,
  payload_hash   TEXT NOT NULL,
  received_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at   TEXT,
  UNIQUE (provider, event_id)
);

-- Divers ---------------------------------------------------------------------
CREATE TABLE contact_messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_contact_status ON contact_messages(status, created_at DESC);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_log (
  id             TEXT PRIMARY KEY,
  actor_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity         TEXT NOT NULL,
  entity_id      TEXT,
  details        TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
