/**
 * Sauvegarde locale de la base SQLite et des médias téléversés.
 *
 * Usage :
 *   npm run backup
 *   npm run backup -- --label avant-mise-a-jour
 *
 * Variables : BACKUP_DIR, BACKUP_RETENTION_DAYS, BACKUP_KEEP.
 */
import { config } from '../config.js';
import { createBackup, pruneBackups } from '../services/backups.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : undefined;
}

try {
  const backup = createBackup({
    databasePath: config.databasePath,
    uploadDir: config.uploadDir,
    backupDir: config.backupDir,
    label: arg('label'),
  });
  const removed = pruneBackups(config.backupDir, {
    retentionDays: config.backupRetentionDays,
    keep: config.backupKeep,
  });
  console.info(`[backup] Sauvegarde créée : ${backup.directory}`);
  const databaseMegabytes = (backup.manifest?.databaseBytes ?? 0) / 1024 / 1024;
  console.info(
    `[backup] ${databaseMegabytes.toFixed(2)} Mo de base, ${backup.manifest?.uploadsFiles ?? 0} média(s).`,
  );
  console.info(
    `[backup] Rétention : ${config.backupRetentionDays} jours, minimum ${config.backupKeep} sauvegarde(s).` +
      (removed.length ? ` ${removed.length} ancienne(s) sauvegarde(s) supprimée(s).` : ''),
  );
} catch (error) {
  console.error(`[backup] Échec : ${(error as Error).message}`);
  process.exit(1);
}
