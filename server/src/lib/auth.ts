import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { getDb, queryOne } from '../db/index.js';
import { newId, nowIso } from './ids.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (error, derived) => (error ? reject(error) : resolve(derived)),
    );
  });
}

/** Format : scrypt$N$r$p$saltBase64$hashBase64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(saltB64 ?? '', 'base64');
  const expected = Buffer.from(hashB64 ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, out) =>
      error ? reject(error) : resolve(out),
    );
  });
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export const SESSION_COOKIE = 'hp_session';
export const CSRF_COOKIE = 'hp_csrf';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const chunk of header.split(';')) {
    const index = chunk.indexOf('=');
    if (index < 0) continue;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; secure?: boolean; path?: string } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`, `SameSite=${options.sameSite ?? 'Lax'}`];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure ?? config.isProduction) parts.push('Secure');
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  return parts.join('; ');
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  permissions: string[];
}

export function loadPermissions(roleSlug: string): string[] {
  const rows = getDb()
    .prepare('SELECT permission FROM role_permissions WHERE role_slug = ?')
    .all(roleSlug) as Array<{ permission: string }>;
  return rows.map((row) => row.permission);
}

export function findUserBySession(token: string): SessionUser | null {
  if (!token) return null;
  const row = queryOne<{
    id: string;
    email: string;
    full_name: string;
    phone: string;
    role_slug: string;
    status: string;
    expires_at: string;
  }>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role_slug, u.status, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [hashToken(token)],
  );
  if (!row) return null;
  if (row.status !== 'active') return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? '',
    role: row.role_slug as SessionUser['role'],
    permissions: loadPermissions(row.role_slug),
  };
}

/** Les comptes staff et administrateur ont une session plus courte par défaut. */
export function sessionTtlMsForRole(role: string): number {
  if (role === 'admin' || role === 'staff') {
    return config.adminSessionTtlHours * 60 * 60 * 1000;
  }
  return config.sessionTtlDays * 24 * 60 * 60 * 1000;
}

export function createSession(
  db: DatabaseSync,
  userId: string,
  meta: { ip?: string; userAgent?: string; ttlMs?: number } = {},
): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (meta.ttlMs ?? config.sessionTtlDays * 24 * 60 * 60 * 1000));
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    userId,
    hashToken(token),
    (meta.userAgent ?? '').slice(0, 300),
    (meta.ip ?? '').slice(0, 60),
    expiresAt.toISOString(),
    nowIso(),
  );
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function pruneExpiredSessions(): void {
  getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return serializeCookie(SESSION_COOKIE, token, {
    maxAgeSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    httpOnly: true,
    sameSite: 'Lax',
  });
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, '', { maxAgeSeconds: 0, httpOnly: true, sameSite: 'Lax' });
}

export function newCsrfToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}
