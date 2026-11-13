-- Journal d’audit lisible depuis l’administration.
-- Cette permission est réservée aux administrateurs : les membres du staff
-- conservent leurs droits métier mais ne peuvent pas consulter le journal.
INSERT OR IGNORE INTO role_permissions (role_slug, permission)
VALUES ('admin', 'audit:read');

CREATE INDEX IF NOT EXISTS idx_audit_actor_created
  ON audit_log(actor_user_id, created_at DESC);
