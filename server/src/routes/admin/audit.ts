import { Router } from 'express';
import { queryAll } from '../../db/index.js';
import { requirePermission } from '../../middleware/auth.js';

export const adminAuditRouter = Router();

adminAuditRouter.get('/audit', requirePermission('audit:read'), (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;
  const action = typeof req.query.action === 'string' ? req.query.action.trim().slice(0, 80) : '';
  const entity = typeof req.query.entity === 'string' ? req.query.entity.trim().slice(0, 60) : '';

  const clauses: string[] = [];
  const params: string[] = [];
  if (action) {
    clauses.push('a.action LIKE ?');
    params.push(`%${action}%`);
  }
  if (entity) {
    clauses.push('a.entity = ?');
    params.push(entity);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = queryAll<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    details: string;
    created_at: string;
    actor_email: string | null;
    actor_name: string | null;
  }>(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at,
            u.email AS actor_email, u.full_name AS actor_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ${where}
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [...params, String(limit)],
  );

  res.json({
    entries: rows.map((row) => {
      let details: unknown = {};
      try {
        details = JSON.parse(row.details || '{}');
      } catch {
        details = { raw: row.details };
      }
      return {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        actorEmail: row.actor_email ?? '',
        actorName: row.actor_name ?? '',
        details,
        createdAt: row.created_at,
      };
    }),
    limit,
  });
});
