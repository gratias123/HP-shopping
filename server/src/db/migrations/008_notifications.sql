-- Notifications internes (cloche dans l'application).
-- Une ligne par destinataire : un événement destiné au personnel est dupliqué
-- pour chaque compte staff/admin actif, ce qui permet un état « lu » individuel.
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  link        TEXT,
  entity      TEXT,
  entity_id   TEXT,
  dedupe_key  TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at);

-- Évite d'empiler les mêmes alertes de stock tant que la précédente n'est pas lue.
CREATE UNIQUE INDEX idx_notifications_dedupe_unread
  ON notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND read_at IS NULL;
