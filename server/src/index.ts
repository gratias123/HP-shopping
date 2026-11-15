import fs from 'node:fs';
import { assertConfig, config } from './config.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { seedDatabase } from './db/seed/index.js';
import { pruneExpiredSessions } from './lib/auth.js';
import { createApp } from './app.js';
import { flushOnShutdown, restoreIfNeeded, startPersistence } from './services/persistence.js';

const warnings = assertConfig();
for (const warning of warnings) console.warn(`[hp-collection] ${warning}`);

await restoreIfNeeded();
initDatabase(config.databasePath);
pruneExpiredSessions();
fs.mkdirSync(config.uploadDir, { recursive: true });

if (!config.isProduction) {
  const result = seedDatabase();
  if (result.seeded) {
    console.info(`[hp-collection] Catalogue de démonstration créé (${result.products} articles, références DEMO-*).`);
  }
}

const app = createApp();
void startPersistence();
const server = app.listen(config.port, () => {
  console.info(`[hp-collection] API prête sur http://localhost:${config.port} (${config.nodeEnv}, données: ${config.dataMode})`);
});

function shutdown(signal: string) {
  console.info(`[hp-collection] ${signal} reçu, arrêt en cours…`);
  server.close(() => {
    void flushOnShutdown().finally(() => {
      closeDatabase();
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 9000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
