-- Historique des mouvements de stock.
--
-- Chaque vente, annulation, ajustement administrateur ou stock initial laisse
-- une trace immuable. Les colonnes SKU/taille/couleur sont des instantanés :
-- l'historique reste lisible même si la variante est supprimée plus tard.

CREATE TABLE stock_movements (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id    TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  sku           TEXT NOT NULL DEFAULT '',
  size          TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '',
  delta         INTEGER NOT NULL,
  stock_before  INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after   INTEGER NOT NULL CHECK (stock_after >= 0),
  reason        TEXT NOT NULL CHECK (reason IN ('initial', 'order', 'cancellation', 'adjustment', 'restock', 'return')),
  reference     TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  actor_label   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_variant ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);

-- Reprise du stock existant (bases déjà initialisées avec 001/002).
-- Sur une base neuve, aucune variante n'existe encore : le seed crée ensuite
-- ses propres mouvements initiaux.
INSERT INTO stock_movements (
  id, product_id, variant_id, sku, size, color, delta, stock_before, stock_after,
  reason, reference, note, actor_label, created_at
)
SELECT lower(hex(randomblob(16))), v.product_id, v.id, v.sku, v.size, v.color,
       v.stock, 0, v.stock, 'initial', v.sku,
       'Stock repris lors de la migration de l’historique', 'Migration',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM product_variants v
 WHERE v.stock > 0;
