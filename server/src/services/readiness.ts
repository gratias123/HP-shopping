import fs from 'node:fs';
import { config, onlinePaymentConfigured } from '../config.js';
import { queryOne } from '../db/index.js';
import { latestBackup } from './backups.js';
import { getSettings } from './settings.js';

export type ReadinessStatus = 'ok' | 'warning' | 'blocking';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  action?: string;
}

export interface ReadinessReport {
  status: ReadinessStatus;
  checks: ReadinessCheck[];
  generatedAt: string;
}

function worst(statuses: ReadinessStatus[]): ReadinessStatus {
  if (statuses.includes('blocking')) return 'blocking';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
}

/**
 * Diagnostic de mise en production. Il ne corrige rien et n’expose aucun
 * secret : il indique seulement les prérequis encore manquants.
 */
export function buildReadinessReport(): ReadinessReport {
  const settings = getSettings();
  const checks: ReadinessCheck[] = [];
  const legalAddress = settings.legalAddress || settings.storeAddress;
  const legalIdentity = [settings.legalName, settings.legalForm, settings.legalRccm, settings.legalIfu, legalAddress];
  checks.push({
    id: 'legal_identity',
    label: 'Identité légale de l’entreprise',
    status: legalIdentity.every((value) => value.trim()) ? 'ok' : 'blocking',
    detail: legalIdentity.every((value) => value.trim())
      ? 'Raison sociale, forme juridique, RCCM, IFU et adresse renseignés.'
      : 'Renseignez raison sociale, forme juridique, RCCM, IFU et adresse dans les paramètres.',
    action: '/admin/parametres',
  });

  const contactEmail = settings.contactEmail.trim().toLowerCase();
  const emailValid = Boolean(contactEmail) && !contactEmail.endsWith('.example') && contactEmail.includes('@');
  checks.push({
    id: 'contact',
    label: 'Coordonnées de contact réelles',
    status: emailValid ? (settings.contactPhone ? 'ok' : 'warning') : 'blocking',
    detail: !emailValid
      ? 'L’adresse de contact est vide ou utilise encore un domaine .example.'
      : settings.contactPhone
        ? 'E-mail et téléphone de contact renseignés.'
        : 'Ajoutez un téléphone réel pour le service client.',
    action: '/admin/parametres',
  });

  checks.push({
    id: 'legal_host',
    label: 'Hébergeur et directeur de publication',
    status:
      settings.hostName && settings.hostAddress && settings.legalPublisher
        ? settings.hostEmail || settings.hostPhone
          ? 'ok'
          : 'warning'
        : 'blocking',
    detail:
      settings.hostName && settings.hostAddress
        ? settings.legalPublisher
          ? 'Hébergeur déclaré ; vérifiez aussi son contact.'
          : 'Ajoutez le directeur de publication pour les mentions légales.'
        : 'Les mentions légales exigent le nom, l’adresse et le contact de l’hébergeur.',
    action: '/admin/parametres',
  });

  checks.push({
    id: 'legal_updated',
    label: 'Date de mise à jour des documents légaux',
    status: settings.legalUpdatedAt ? 'ok' : 'warning',
    detail: settings.legalUpdatedAt
      ? 'Les pages légales affichent une date de mise à jour.'
      : 'La date sera calculée automatiquement à la première modification des informations légales.',
    action: '/admin/parametres',
  });

  const appUrlIsHttps = config.appUrl.startsWith('https://');
  checks.push({
    id: 'app_url',
    label: 'URL publique et HTTPS',
    status: config.isProduction ? (appUrlIsHttps ? 'ok' : 'blocking') : 'warning',
    detail: config.isProduction
      ? appUrlIsHttps
        ? `URL publique : ${config.appUrl}`
        : 'En production, APP_URL doit utiliser HTTPS.'
      : 'En développement, l’URL locale est normale. Renseignez le domaine HTTPS avant la mise en ligne.',
    action: config.isProduction ? undefined : '/admin/parametres',
  });

  const secretReady = config.sessionSecret.length >= 32;
  checks.push({
    id: 'session_secret',
    label: 'Secret de session',
    status: secretReady ? 'ok' : config.isProduction ? 'blocking' : 'warning',
    detail: secretReady
      ? 'SESSION_SECRET est défini avec une longueur suffisante.'
      : 'Générez un SESSION_SECRET aléatoire d’au moins 32 caractères.',
  });

  const backup = latestBackup(config.backupDir);
  const backupAgeDays = backup
    ? Math.floor((Date.now() - new Date(backup.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  checks.push({
    id: 'backup',
    label: 'Sauvegarde récente',
    status: !backup ? (config.isProduction ? 'blocking' : 'warning') : backupAgeDays !== null && backupAgeDays <= 7 ? 'ok' : 'warning',
    detail: !backup
      ? 'Aucune sauvegarde trouvée. Lancez npm run backup.'
      : `Dernière sauvegarde : ${backup.createdAt} (${backupAgeDays} jour${backupAgeDays === 1 ? '' : 's'}).`,
    action: '/admin/production',
  });

  const demoProducts = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM products WHERE reference LIKE 'DEMO-%'",
  );
  checks.push({
    id: 'demo_catalog',
    label: 'Catalogue réel',
    status: Number(demoProducts?.total ?? 0) === 0 ? 'ok' : 'warning',
    detail:
      Number(demoProducts?.total ?? 0) === 0
        ? 'Aucune référence de démonstration DEMO-* détectée.'
        : `${Number(demoProducts?.total ?? 0)} article(s) de démonstration encore présents.`,
    action: '/admin/produits',
  });

  const admins = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users WHERE role_slug = 'admin' AND status = 'active'",
  );
  checks.push({
    id: 'admin_account',
    label: 'Administrateur actif',
    status: Number(admins?.total ?? 0) > 0 ? 'ok' : 'blocking',
    detail: `${Number(admins?.total ?? 0)} administrateur(s) actif(s).`,
    action: '/admin/utilisateurs',
  });

  checks.push({
    id: 'uploads',
    label: 'Dossier des médias',
    status: fs.existsSync(config.uploadDir) ? 'ok' : 'warning',
    detail: fs.existsSync(config.uploadDir)
      ? 'Le dossier des téléversements existe.'
      : 'Le dossier des téléversements sera créé au démarrage du serveur.',
  });

  checks.push({
    id: 'data_mode',
    label: 'Mode de stockage',
    status: config.dataMode === 'local' ? 'warning' : 'ok',
    detail:
      config.dataMode === 'local'
        ? 'SQLite local : prévoyez des sauvegardes automatiques et une seule instance d’API.'
        : 'Mode de stockage distant.',
  });

  checks.push({
    id: 'payment',
    label: 'Paiement en ligne',
    status: onlinePaymentConfigured ? 'ok' : 'warning',
    detail: onlinePaymentConfigured
      ? 'Un prestataire de paiement est configuré.'
      : 'Mobile Money non configuré : le paiement à la réception reste disponible. À finaliser en fin de projet.',
  });

  return {
    status: worst(checks.map((check) => check.status)),
    checks,
    generatedAt: new Date().toISOString(),
  };
}
