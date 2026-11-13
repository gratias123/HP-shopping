import { Router } from 'express';
import { execute, getDb, queryOne } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  pruneExpiredSessions,
  sessionCookie,
  sessionTtlMsForRole,
  verifyPassword,
} from '../lib/auth.js';
import { newId, nowIso } from '../lib/ids.js';
import { loginSchema, passwordChangeSchema, profileSchema, registerSchema } from '../lib/validation.js';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit, readSessionToken } from '../middleware/security.js';
import type { SessionUser } from '../lib/auth.js';
import { audit } from './admin/helpers.js';

export const authRouter = Router();

function publicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions,
    isAdmin: user.role === 'admin' || user.permissions.length > 0,
  };
}

authRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: req.csrfToken, user: req.user ? publicUser(req.user) : null });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

authRouter.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 8, scope: 'register' }),
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [input.email]);
    if (existing) {
      throw new ApiError(409, 'email_taken', 'Un compte existe déjà avec cette adresse e-mail.');
    }
    const id = newId();
    const now = nowIso();
    execute(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role_slug, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', 'active', ?, ?)`,
      [id, input.email, await hashPassword(input.password), input.fullName, input.phone ?? '', now, now],
    );
    const { token, expiresAt } = createSession(getDb(), id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
    const user: SessionUser = {
      id,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? '',
      role: 'customer',
      permissions: [],
    };
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, scope: 'login' }),
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const row = queryOne<{ id: string; email: string; password_hash: string; full_name: string; phone: string; role_slug: string; status: string }>(
      'SELECT id, email, password_hash, full_name, phone, role_slug, status FROM users WHERE email = ?',
      [input.email],
    );
    const genericError = new ApiError(401, 'invalid_credentials', 'Adresse e-mail ou mot de passe incorrect.');
    if (!row) {
      // Comparaison factice pour lisser le temps de réponse.
      await verifyPassword(input.password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      throw genericError;
    }
    const valid = await verifyPassword(input.password, row.password_hash);
    if (!valid) throw genericError;
    if (row.status !== 'active') {
      throw new ApiError(403, 'account_disabled', 'Ce compte est désactivé. Contactez la boutique.');
    }
    pruneExpiredSessions();
    const { token, expiresAt } = createSession(getDb(), row.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      ttlMs: sessionTtlMsForRole(row.role_slug),
    });
    res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
    if (row.role_slug === 'admin' || row.role_slug === 'staff') {
      audit(row.id, 'auth.login', 'user', row.id, { role: row.role_slug });
    }
    const permissions = getDb()
      .prepare('SELECT permission FROM role_permissions WHERE role_slug = ?')
      .all(row.role_slug) as Array<{ permission: string }>;
    res.json({
      user: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        phone: row.phone ?? '',
        role: row.role_slug,
        permissions: permissions.map((p) => p.permission),
        isAdmin: row.role_slug === 'admin' || permissions.length > 0,
      },
    });
  }),
);

authRouter.post('/logout', (req, res) => {
  const token = readSessionToken(req);
  if (token) destroySession(token);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

authRouter.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = profileSchema.parse(req.body);
    execute('UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?', [
      input.fullName,
      input.phone ?? '',
      nowIso(),
      req.user!.id,
    ]);
    res.json({ ok: true, user: { ...publicUser(req.user!), fullName: input.fullName, phone: input.phone ?? '' } });
  }),
);

authRouter.post(
  '/password',
  requireAuth,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, scope: 'password' }),
  asyncHandler(async (req, res) => {
    const input = passwordChangeSchema.parse(req.body);
    const row = queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!row) throw ApiError.unauthorized();
    if (!(await verifyPassword(input.currentPassword, row.password_hash))) {
      throw new ApiError(400, 'invalid_password', 'Le mot de passe actuel est incorrect.');
    }
    execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      await hashPassword(input.newPassword),
      nowIso(),
      req.user!.id,
    ]);
    // Révoque toutes les sessions existantes puis en ouvre une nouvelle.
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user!.id);
    const { token: fresh, expiresAt } = createSession(getDb(), req.user!.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      ttlMs: sessionTtlMsForRole(req.user!.role),
    });
    audit(req.user!.id, 'auth.password_change', 'user', req.user!.id, {});
    res.setHeader('Set-Cookie', sessionCookie(fresh, expiresAt));
    res.json({ ok: true });
  }),
);
