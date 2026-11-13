import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { findUserBySession } from '../lib/auth.js';
import { readSessionToken } from './security.js';

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = readSessionToken(req);
  req.user = token ? findUserBySession(token) : null;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!req.user.permissions.includes(permission)) {
      return next(ApiError.forbidden("Votre compte ne dispose pas des droits nécessaires pour cette action."));
    }
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden('Action réservée aux administrateurs.'));
  next();
}
