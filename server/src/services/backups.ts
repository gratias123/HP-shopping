import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const BACKUP_PREFIX = 'hp-collection-';
const BACKUP_DB = 'database.sqlite';
const MANIFEST = 'manifest.json';
const MANIFEST_VERSION = 1;

export interface BackupManifest {
  formatVersion: number;
  createdAt: string;
  databaseFile: string;
  databaseBytes: number;
  uploadsCopied: boolean;
  uploadsFiles: number;
  uploadsBytes: number;
}

export interface BackupInfo {
  directory: string;
  createdAt: string;
  manifest: BackupManifest | null;
}

export interface CreateBackupOptions {
  databasePath: string;
  uploadDir?: string;
  backupDir: string;
  label?: string;
}

export interface VerifyBackupResult {
  ok: boolean;
  directory: string;
  integrity: string;
  tables: string[];
  counts: Record<string, number>;
  manifest: BackupManifest | null;
}

function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function uniqueDirectory(backupDir: string, label: string): string {
  const base = path.join(backupDir, `${BACKUP_PREFIX}${stamp()}${label ? `-${label}` : ''}`);
  let candidate = base;
  for (let attempt = 2; fs.existsSync(candidate); attempt += 1) {
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function fileSize(files: string[]): number {
  return files.reduce((total, file) => total + fs.statSync(file).size, 0);
}

/**
 * Sauvegarde cohérente même si l’API tourne : `VACUUM INTO` produit un fichier
 * SQLite compact à partir d’une lecture transactionnelle, sans copier les
 * fichiers WAL/SHM à chaud. Les médias téléversés sont copiés dans le même lot.
 */
export function createBackup(options: CreateBackupOptions): BackupInfo {
  const databasePath = path.resolve(options.databasePath);
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Base de données introuvable : ${databasePath}`);
  }
  const backupDir = path.resolve(options.backupDir);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const directory = uniqueDirectory(backupDir, (options.label ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40));
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  const databaseFile = path.join(directory, BACKUP_DB);

  const db = new DatabaseSync(databasePath);
  try {
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec(`VACUUM INTO ${sqlString(databaseFile.replace(/\\/g, '/'))};`);
  } finally {
    db.close();
  }

  let uploadsCopied = false;
  let uploadsFiles = 0;
  let uploadsBytes = 0;
  if (options.uploadDir && fs.existsSync(options.uploadDir)) {
    const uploadTarget = path.join(directory, 'uploads');
    fs.cpSync(options.uploadDir, uploadTarget, { recursive: true });
    const copied = walkFiles(uploadTarget);
    uploadsCopied = true;
    uploadsFiles = copied.length;
    uploadsBytes = fileSize(copied);
  }

  const manifest: BackupManifest = {
    formatVersion: MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    databaseFile: BACKUP_DB,
    databaseBytes: fs.statSync(databaseFile).size,
    uploadsCopied,
    uploadsFiles,
    uploadsBytes,
  };
  fs.writeFileSync(path.join(directory, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
    fs.chmodSync(databaseFile, 0o600);
    fs.chmodSync(path.join(directory, MANIFEST), 0o600);
  }

  return { directory, createdAt: manifest.createdAt, manifest };
}

function readManifest(directory: string): BackupManifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(directory, MANIFEST), 'utf8')) as Partial<BackupManifest>;
    if (parsed.formatVersion !== MANIFEST_VERSION || typeof parsed.databaseFile !== 'string') return null;
    return parsed as BackupManifest;
  } catch {
    return null;
  }
}

export function listBackups(backupDir: string): BackupInfo[] {
  const root = path.resolve(backupDir);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
    .map((entry) => {
      const directory = path.join(root, entry.name);
      const manifest = readManifest(directory);
      const createdAt = manifest?.createdAt ?? fs.statSync(directory).mtime.toISOString();
      return { directory, createdAt, manifest };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function latestBackup(backupDir: string): BackupInfo | null {
  return listBackups(backupDir)[0] ?? null;
}

export function verifyBackup(directory: string): VerifyBackupResult {
  const manifest = readManifest(directory);
  const databaseFile = path.join(directory, manifest?.databaseFile ?? BACKUP_DB);
  if (!fs.existsSync(databaseFile)) {
    throw new Error(`Fichier de sauvegarde introuvable : ${databaseFile}`);
  }

  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const integrityRow = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    const integrity = String(integrityRow?.integrity_check ?? 'unknown');
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map(
      (row) => row.name,
    );
    const counts: Record<string, number> = {};
    for (const table of ['users', 'products', 'product_variants', 'orders', 'customer_addresses', 'audit_log']) {
      if (!tables.includes(table)) continue;
      const row = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number } | undefined;
      counts[table] = Number(row?.total ?? 0);
    }
    return { ok: integrity === 'ok', directory, integrity, tables, counts, manifest };
  } finally {
    db.close();
  }
}

/**
 * Ne supprime que les dossiers créés par la boutique, jamais un autre dossier.
 * Les N sauvegardes les plus récentes sont toujours conservées (BACKUP_KEEP).
 */
export function pruneBackups(
  backupDir: string,
  options: { retentionDays: number; keep: number; now?: Date },
): string[] {
  const now = options.now?.getTime() ?? Date.now();
  const cutoff = now - options.retentionDays * 24 * 60 * 60 * 1000;
  const backups = listBackups(backupDir);
  const removed: string[] = [];
  backups.forEach((backup, index) => {
    if (index < options.keep) return;
    if (new Date(backup.createdAt).getTime() >= cutoff) return;
    fs.rmSync(backup.directory, { recursive: true, force: true });
    removed.push(backup.directory);
  });
  return removed;
}
