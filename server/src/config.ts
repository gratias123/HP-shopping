import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function str(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFromServer(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(serverRoot, value);
}

const nodeEnv = str('NODE_ENV', 'development');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: int('PORT', 4000),
  appUrl: str('APP_URL', 'http://localhost:5173').replace(/\/$/, ''),
  sessionSecret: str('SESSION_SECRET', ''),
  sessionTtlDays: int('SESSION_TTL_DAYS', 14),
  adminSessionTtlHours: int('ADMIN_SESSION_TTL_HOURS', 12),
  dataMode: str('DATA_MODE', 'local') as 'local' | 'supabase',
  databasePath: resolveFromServer(str('DATABASE_PATH', './data/hp-collection.sqlite')),
  uploadDir: resolveFromServer(str('UPLOAD_DIR', './uploads')),
  backupDir: resolveFromServer(str('BACKUP_DIR', './backups')),
  backupRetentionDays: int('BACKUP_RETENTION_DAYS', 14),
  backupKeep: int('BACKUP_KEEP', 5),
  maxUploadMb: int('MAX_UPLOAD_MB', 5),
  currency: str('CURRENCY', 'XOF').toUpperCase(),
  defaultCountry: str('DEFAULT_COUNTRY', 'BJ').toUpperCase(),
  lowStockThreshold: int('LOW_STOCK_THRESHOLD', 5),
  supabaseUrl: str('SUPABASE_URL'),
  supabaseAnonKey: str('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseStorageBucket: str('SUPABASE_STORAGE_BUCKET', 'product-media'),
  paymentProvider: str('PAYMENT_PROVIDER'),
  paymentSecretKey: str('PAYMENT_SECRET_KEY'),
  paymentWebhookSecret: str('PAYMENT_WEBHOOK_SECRET'),
} as const;

export const onlinePaymentConfigured = Boolean(config.paymentProvider && config.paymentSecretKey);

/**
 * Vérifications de démarrage. On refuse de démarrer en production sans secret
 * de session, et on avertit quand des prérequis optionnels manquent.
 */
export function assertConfig(): string[] {
  const warnings: string[] = [];
  if (!['local', 'supabase'].includes(config.dataMode)) {
    throw new Error(`DATA_MODE invalide : « ${config.dataMode} ». Valeurs acceptées : local, supabase.`);
  }
  if (config.adminSessionTtlHours < 1 || config.adminSessionTtlHours > 168) {
    throw new Error('ADMIN_SESSION_TTL_HOURS doit être compris entre 1 et 168 heures.');
  }
  if (config.backupRetentionDays < 1) {
    throw new Error('BACKUP_RETENTION_DAYS doit être supérieur ou égal à 1.');
  }
  if (config.backupKeep < 1) {
    throw new Error('BACKUP_KEEP doit être supérieur ou égal à 1.');
  }
  if (config.isProduction && !config.appUrl.startsWith('https://')) {
    throw new Error(
      'APP_URL doit utiliser HTTPS en production (par exemple https://www.votre-domaine.com). ' +
        'Les cookies de session sont marqués Secure et l’authentification ne fonctionnerait pas correctement en HTTP.',
    );
  }
  if (!config.isProduction && !config.appUrl.startsWith('http://localhost') && !config.appUrl.startsWith('http://127.0.0.1')) {
    warnings.push('APP_URL ne pointe pas vers localhost en développement : vérifiez les contrôles CSRF et les liens absolus.');
  }
  if (config.sessionSecret.length < 32) {
    if (config.isProduction) {
      throw new Error(
        'SESSION_SECRET manquant ou trop court (32 caractères minimum). Générez-le avant de démarrer en production.',
      );
    }
    warnings.push('SESSION_SECRET non défini : un secret de développement instable est utilisé.');
  }
  if (config.dataMode === 'supabase') {
    // Les migrations SQL Supabase sont fournies, mais le connecteur applicatif
    // n'est pas encore branché. On refuse de démarrer plutôt que d'utiliser
    // silencieusement SQLite alors que l'opérateur croit être sur Supabase.
    throw new Error(
      'DATA_MODE=supabase n’est pas encore pris en charge par cette version de l’API. ' +
        'Les migrations de production se trouvent dans supabase/migrations ; ' +
        'utilisez DATA_MODE=local en attendant le branchement de l’adaptateur.',
    );
  }
  if (config.isProduction && config.dataMode === 'local') {
    warnings.push(
      'Stockage SQLite local en production : une seule instance applicative est supportée et les sauvegardes doivent être automatisées.',
    );
  }
  if (!onlinePaymentConfigured) {
    warnings.push(
      'Paiement Mobile Money non configuré (PAYMENT_PROVIDER/PAYMENT_SECRET_KEY absents) : seule la livraison avec paiement à la réception est proposée.',
    );
  }
  return warnings;
}
