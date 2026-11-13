import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Route introuvable.' } });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    res.status(422).json({
      error: { code: 'validation_error', message: 'Certains champs sont invalides.', fields: fieldErrors },
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }

  const maybeMulter = error as { code?: string; message?: string };
  if (maybeMulter?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: { code: 'file_too_large', message: `Le fichier dépasse la limite de ${config.maxUploadMb} Mo.` },
    });
    return;
  }
  if (maybeMulter?.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: { code: 'unexpected_file', message: 'Envoi de fichier invalide.' } });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Requête JSON invalide.' } });
    return;
  }

  if (maybeMulter?.message && /UNIQUE constraint failed/i.test(maybeMulter.message)) {
    res.status(409).json({
      error: { code: 'duplicate', message: 'Une entrée avec ces informations existe déjà.' },
    });
    return;
  }

  const httpStatus = Number((error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode);
  if (Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus < 500) {
    res.status(httpStatus).json({
      error: {
        code: httpStatus === 404 ? 'not_found' : 'request_rejected',
        message: httpStatus === 404 ? 'Ressource introuvable.' : 'Requête refusée.',
      },
    });
    return;
  }

  console.error('[hp-collection] Erreur non gérée :', error);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: config.isProduction
        ? 'Une erreur interne est survenue. Merci de réessayer.'
        : `Erreur interne : ${(error as Error).message}`,
    },
  });
}
