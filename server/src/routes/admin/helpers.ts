import crypto from 'node:crypto';
import { execute, queryOne } from '../../db/index.js';
import { nowIso, slugify } from '../../lib/ids.js';

export function uniqueSlug(table: 'products' | 'categories', base: string, excludeId?: string): string {
  const root = slugify(base) || 'sans-titre';
  let candidate = root;
  for (let attempt = 2; attempt < 100; attempt += 1) {
    const row = queryOne<{ id: string }>(`SELECT id FROM ${table} WHERE slug = ?`, [candidate]);
    if (!row || row.id === excludeId) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${crypto.randomBytes(2).toString('hex')}`;
}

export function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
): void {
  execute('INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    crypto.randomUUID(),
    actorId,
    action,
    entity,
    entityId,
    JSON.stringify(details),
    nowIso(),
  ]);
}

export function requireNonEmpty(value: unknown, message: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw Object.assign(new Error(message), { status: 422 });
  return text;
}
