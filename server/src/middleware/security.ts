import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { CSRF_COOKIE, SESSION_COOKIE, newCsrfToken, parseCookies, serializeCookie } from '../lib/auth.js';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function readSessionToken(req: Request): string {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? '';
}

/**
 * Jeton CSRF en double soumission : cookie lisible par le frontend + en-tête
 * x-csrf-token exigé sur toute requête mutante. Complété par un contrôle
 * d'origine pour bloquer les requêtes intersites.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  let token = cookies[CSRF_COOKIE];
  if (!token || token.length < 20) {
    token = newCsrfToken();
    res.append(
      'Set-Cookie',
      serializeCookie(CSRF_COOKIE, token, { httpOnly: false, sameSite: 'Lax', maxAgeSeconds: 60 * 60 * 24 * 365 }),
    );
  }
  req.csrfToken = token;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const headerToken = String(req.headers['x-csrf-token'] ?? '');
  const valid =
    headerToken.length === token.length &&
    crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(token));
  if (!valid) {
    return next(new ApiError(403, 'csrf_invalid', 'Jeton de sécurité invalide ou expiré. Rechargez la page.'));
  }

  const origin = req.headers.origin;
  if (origin) {
    const requestOrigin = `${req.protocol}://${req.headers.host}`;
    const allowed = new Set([config.appUrl, requestOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']);
    if (!allowed.has(origin.replace(/\/$/, ''))) {
      return next(new ApiError(403, 'origin_rejected', 'Origine non autorisée.'));
    }
  }
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; scope: string }): RequestHandler {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = `${options.scope}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      if (buckets.size > 5000) {
        for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
      }
      return next();
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return next(ApiError.tooManyRequests('Trop de tentatives. Merci de réessayer dans quelques minutes.'));
    }
    next();
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}
