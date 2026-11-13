/**
 * Vérifie l’intégrité d’une sauvegarde sans la restaurer.
 *
 * Usage :
 *   npm run backup:verify
 *   npm run backup:verify -- --dir ./backups/hp-collection-20261112-120000
 */
import path from 'node:path';
import { config } from '../config.js';
import { latestBackup, verifyBackup } from '../services/backups.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : undefined;
}

const requested = arg('dir');
const directory = requested
  ? path.resolve(requested)
  : latestBackup(config.backupDir)?.directory;

if (!directory) {
  console.error(`[backup:verify] Aucune sauvegarde trouvée dans ${config.backupDir}.`);
  process.exit(1);
}

try {
  const result = verifyBackup(directory);
  console.info(`[backup:verify] Dossier : ${result.directory}`);
  console.info(`[backup:verify] Intégrité SQLite : ${result.integrity}`);
  console.info(`[backup:verify] Tables : ${result.tables.length}`);
  for (const [table, count] of Object.entries(result.counts)) {
    console.info(`[backup:verify]   ${table}: ${count}`);
  }
  if (!result.ok) {
    console.error('[backup:verify] La sauvegarde est corrompue ou incomplète.');
    process.exit(1);
  }
} catch (error) {
  console.error(`[backup:verify] Échec : ${(error as Error).message}`);
  process.exit(1);
}
