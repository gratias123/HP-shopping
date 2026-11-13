/**
 * Initialisation sécurisée du premier administrateur.
 *
 * L'élévation au rôle admin n'est possible que par ce script, exécuté avec un
 * accès direct à la base (jamais via une requête HTTP ou une simple modification
 * côté navigateur). Le mot de passe est soit fourni par l'opérateur, soit généré
 * aléatoirement et affiché une seule fois.
 *
 * Usage :
 *   npm run admin:create -- --email admin@exemple.fr --name "Prénom Nom"
 *   ADMIN_PASSWORD='...' npm run admin:create -- --email ...
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { closeDatabase, execute, initDatabase, queryOne } from '../db/index.js';
import { hashPassword } from '../lib/auth.js';
import { newId, nowIso } from '../lib/ids.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : undefined;
}

function generatePassword(): string {
  return crypto.randomBytes(18).toString('base64url');
}

function fail(message: string): never {
  console.error(`\n[admin:create] ${message}\n`);
  process.exit(1);
}

const email = arg('email')?.trim().toLowerCase();
const name = arg('name')?.trim() || 'Administrateur';
const promote = process.argv.includes('--promote');
let password = arg('password') ?? process.env.ADMIN_PASSWORD ?? '';
const generated = !password;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail('Adresse e-mail invalide. Exemple : --email admin@exemple.fr');
}
if (password && password.length < 12) {
  fail('Le mot de passe fourni doit contenir au moins 12 caractères.');
}
if (password && process.argv.some((value) => value.startsWith('--password'))) {
  console.warn('[admin:create] Attention : un mot de passe passé en argument peut rester dans l’historique du shell.');
}
if (generated) password = generatePassword();

initDatabase(config.databasePath);
try {
  const existing = queryOne<{ id: string; role_slug: string }>('SELECT id, role_slug FROM users WHERE email = ?', [email]);
  if (existing) {
    if (!promote) {
      fail(
        `Un compte existe déjà pour ${email} (rôle : ${existing.role_slug}). Utilisez --promote pour lui accorder les droits administrateur, ou choisissez une autre adresse.`,
      );
    }
    execute("UPDATE users SET role_slug = 'admin', status = 'active', updated_at = ? WHERE id = ?", [nowIso(), existing.id]);
    execute('DELETE FROM sessions WHERE user_id = ?', [existing.id]);
    console.info(`[admin:create] Compte ${email} promu administrateur. Ses sessions ont été révoquées.`);
  } else {
    execute(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role_slug, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', 'admin', 'active', ?, ?)`,
      [newId(), email, await hashPassword(password), name, nowIso(), nowIso()],
    );
    console.info('\n[admin:create] Compte administrateur créé.');
    console.info(`  E-mail   : ${email}`);
    if (generated) {
      console.info(`  Mot de passe (affiché une seule fois) : ${password}`);
      console.info('  Conservez-le dans un gestionnaire de mots de passe, puis changez-le après la première connexion.');
    } else {
      console.info('  Mot de passe : celui fourni (non réaffiché).');
    }
    console.info('\nAccès : /admin (connectez-vous d’abord via /connexion).\n');
  }
} finally {
  closeDatabase();
}
