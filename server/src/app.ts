import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { config } from './config.js';
import { addressesRouter } from './routes/addresses.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { contactRouter } from './routes/contact.js';
import { favoritesRouter } from './routes/favorites.js';
import { notificationsRouter } from './routes/notifications.js';
import { ordersRouter } from './routes/orders.js';
import { seoRouter } from './routes/seo.js';
import { adminRouter } from './routes/admin/index.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { csrfGuard, securityHeaders } from './middleware/security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(attachUser);
  app.use(csrfGuard);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), mode: config.dataMode });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/addresses', addressesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', catalogRouter);
  app.use('/api', ordersRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api', contactRouter);

  // SEO technique, servi avant le fallback SPA.
  app.use(seoRouter);

  // Médias téléchargés : noms aléatoires, extensions contrôlées à l'upload.
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      fallthrough: false,
      index: false,
      dotfiles: 'deny',
      maxAge: config.isProduction ? '30d' : 0,
      immutable: config.isProduction,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
      },
    }),
  );

  // En production, le serveur peut servir le build Vite (déploiement monolithique).
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(
      express.static(webDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get(/^\/(?!(?:api|uploads)(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
