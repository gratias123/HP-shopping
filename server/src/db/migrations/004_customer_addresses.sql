-- Carnet d'adresses client.
--
-- Les adresses sont strictement rattachées à un compte. Le pays reste un code
-- ISO à deux lettres afin de rester compatible avec les zones de livraison.
-- Un index partiel garantit au plus une adresse par défaut par utilisateur.

CREATE TABLE customer_addresses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL,
  city        TEXT NOT NULL,
  country     TEXT NOT NULL CHECK (length(country) = 2),
  phone       TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_customer_addresses_user ON customer_addresses(user_id, is_default DESC, updated_at DESC);
CREATE UNIQUE INDEX idx_customer_addresses_default ON customer_addresses(user_id) WHERE is_default = 1;
