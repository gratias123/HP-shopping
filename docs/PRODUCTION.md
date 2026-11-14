# Mise en production — HP COLLECTION

Ce document décrit la préparation technique et l’exploitation du service.

Pour l’architecture Vercel + Render, voir [`DEPLOY_VERCEL_RENDER.md`](DEPLOY_VERCEL_RENDER.md).

## 1. Checklist avant ouverture

- [ ] Renseigner `APP_URL` avec le domaine public **HTTPS** et configurer le certificat.
- [ ] Générer un `SESSION_SECRET` aléatoire d’au moins 32 caractères.
- [ ] Créer l’administrateur avec `npm run admin:create`, récupérer le mot de passe généré.
- [ ] Remplacer l’e-mail `.example`, le téléphone, les réseaux et l’adresse par les coordonnées réelles.
- [ ] Remplacer le catalogue de démonstration et les frais de livraison de démonstration.
- [ ] Vérifier la page **Administration → Mise en production** : aucun point bloquant.
- [ ] Créer et vérifier une sauvegarde : `npm run backup` puis `npm run backup:verify`.
- [ ] Tester une restauration sur une base de recette, jamais directement en production.
- [ ] Vérifier `robots.txt`, `sitemap.xml` et le parcours de commande complet.

## 2. Variables d’environnement

Copier `.env.example` vers `server/.env` et renseigner au minimum :

```dotenv
NODE_ENV=production
PORT=4000
APP_URL=https://www.votre-domaine.com
SESSION_SECRET=...
ADMIN_SESSION_TTL_HOURS=12
DATA_MODE=local
DATABASE_PATH=./data/hp-collection.sqlite
UPLOAD_DIR=./uploads
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14
BACKUP_KEEP=5
```

`APP_URL` doit être en HTTPS en production : les cookies de session sont
`Secure`. Le serveur refuse de démarrer si l’URL n’est pas HTTPS ou si
`SESSION_SECRET` est trop court.

## 3. Build et démarrage

```bash
npm ci
npm run build
npm run admin:create -- --email admin@votre-domaine.com --name "Administrateur"
npm start
```

Le serveur Express sert l’API et le frontend compilé (`web/dist`). Placer un
reverse proxy HTTPS (Nginx, Caddy, etc.) devant l’application et transmettre
les en-têtes `Host`, `X-Forwarded-Proto` et `X-Forwarded-For`.

Exemple Nginx :

```nginx
server {
  listen 443 ssl http2;
  server_name www.votre-domaine.com;

  client_max_body_size 6m;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## 4. Sauvegardes

La commande crée un lot daté contenant une copie cohérente de SQLite
(`VACUUM INTO`) et les médias téléversés :

```bash
npm run backup
npm run backup:verify
```

Planifier une sauvegarde quotidienne, par exemple avec cron :

```cron
15 2 * * * cd /srv/hp-collection && npm run backup >> /var/log/hp-collection-backup.log 2>&1
```

Sur Windows, utiliser le Planificateur de tâches avec la commande
`npm.cmd run backup` et le dossier du projet comme répertoire de travail.

Les archives sont dans `server/backups/`. Elles contiennent des données
personnelles : restreindre les permissions et les copier vers un stockage
externe chiffré. La purge automatique ne supprime que les dossiers
`hp-collection-*` au-delà de `BACKUP_RETENTION_DAYS`, en conservant toujours
les `BACKUP_KEEP` plus récents.

### Restauration

1. Arrêter l’API.
2. Créer une sauvegarde de sécurité de l’état actuel.
3. Vérifier le lot à restaurer : `npm run backup:verify -- --dir ./backups/hp-collection-...`.
4. Copier `database.sqlite` vers le chemin `DATABASE_PATH`, et le dossier
   `uploads/` vers `UPLOAD_DIR`.
5. Redémarrer l’API, vérifier `/api/health`, une fiche produit et une commande.
6. Ne jamais restaurer une sauvegarde sans avoir vérifié l’intégrité SQLite.

## 5. Durcissement de l’administration

- Les sessions staff/admin expirent après `ADMIN_SESSION_TTL_HOURS` (12 h par défaut), contre `SESSION_TTL_DAYS` pour les clients.
- Les routes d’administration vérifient une permission précise côté serveur.
- Les connexions staff/admin et les changements de mot de passe sont inscrits dans le journal d’audit.
- Le journal d’audit est consultable dans **Administration → Journal d’audit** et n’est pas modifiable depuis l’interface.
- La limitation de débit protège la connexion et l’inscription ; elle est en mémoire et adaptée à une instance unique.
- Une double authentification (2FA) n’est pas encore implémentée. Pour un compte très sensible, restreindre l’accès à `/admin` par le reverse proxy ou un VPN.

## 6. Limites connues

- SQLite local : une seule instance applicative, sauvegardes manuellement planifiées.
- Mobile Money/FedaPay non configuré : seul le paiement à la réception est actif.
- Aucun fournisseur e-mail/SMS/WhatsApp : pas d’envoi automatique de messages.
- Les PDF sont des reçus de commande internes.
