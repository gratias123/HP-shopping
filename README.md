# HP COLLECTION

[![Vérification et build](https://github.com/gratias123/HP-shopping/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gratias123/HP-shopping/actions/workflows/ci.yml)

Boutique e-commerce complète pour **HP COLLECTION** : streetwear, sneakers et accessoires.
Marché principal : **Bénin**. Devise : **franc CFA (XOF)**. Interface publique en français, administration sécurisée, catalogue et commandes persistants.

> **État de la reprise — 12 novembre 2026**
>
> - Le mode **local SQLite** est opérationnel et vérifié : typecheck, build, **41 tests automatisés** et parcours navigateur.
> - Un **carnet d’adresses client** est disponible dans le compte et préremplit le checkout ; les visuels produits de démonstration sont désormais des **photos locales libres de droits** (Unsplash, Pexels), avec crédits.
> - Les données de démonstration ont été adaptées au **Bénin / XOF** : prix en FCFA, zone de livraison Bénin, réglages boutique, WhatsApp, adresse et textes légaux.
> - Le lot **mise en production** ajoute les mentions légales dynamiques, les sauvegardes vérifiables, un journal d’audit en lecture seule et un diagnostic `/admin/production`.
> - Le paiement **Mobile Money** est visible mais **volontairement désactivé** : aucun prestataire (FedaPay ou autre) n'est configuré et aucune transaction n'est simulée.
> - La stack cible demandée (**PostgreSQL + Prisma + Tailwind CSS**) n'est pas encore celle du runtime. La base de travail actuelle est **SQLite + CSS natif**, avec un schéma PostgreSQL/Supabase de préparation dans [`supabase/migrations/`](supabase/migrations). Voir [Écarts avec la stack cible](#écarts-avec-la-stack-cible).

---

## Sommaire

- [Aperçu](#aperçu)
- [Écarts avec la stack cible](#écarts-avec-la-stack-cible)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Reprise dans un autre IDE](#reprise-dans-un-autre-ide)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Base de données locale](#base-de-données-locale)
- [Administration](#administration)
- [Tests et vérifications](#tests-et-vérifications)
- [Déploiement local](#déploiement-local)
- [Publication GitHub et CI](#publication-github-et-ci)
- [Base PostgreSQL / Supabase](#base-postgresql--supabase)
- [Sécurité](#sécurité)
- [Limites connues et reste à faire](#limites-connues-et-reste-à-faire)
- [Structure du dépôt](#structure-du-dépôt)
- [Données de démonstration et mentions légales](#données-de-démonstration-et-mentions-légales)

---

## Aperçu

- **Vitrine** : accueil éditorial, boutique filtrable, catégories, fiche produit avec variantes, recherche, favoris, panier.
- **Commande** : devis serveur, code promotionnel, livraison par zone, paiement à la réception (COD), confirmation et suivi.
- **Compte** : inscription, connexion, profil, historique et détail des commandes, carnet d’adresses avec adresse par défaut.
- **Administration** : tableau de bord, produits et variantes, catégories, commandes, promotions, zones et tarifs de livraison, réglages, messages, utilisateurs et rôles.
- **Sécurité serveur** : validation des prix et stocks côté serveur, décrément atomique du stock, lignes de commande figées, machine à états, RBAC, sessions et CSRF.

Le catalogue livré est **une démonstration** : références `DEMO-*`, photos d’illustration libres de droits (Unsplash/Pexels) qui ne représentent pas les articles réels, aucun avis, aucune certification et aucun faux partenariat. Un bandeau de démonstration est configurable dans l'administration.

### Adaptation Bénin / XOF réalisée

- Devise par défaut : `XOF`, pays par défaut : `BJ`.
- Prix de démonstration convertis en FCFA (ex. hoodie **22 900 FCFA**, sneakers **34 900 FCFA**).
- Zone de livraison **Bénin** avec deux modes de démonstration : **Cotonou** et **national**.
- Réglages boutique : nom, adresse, ville, pays, téléphone, WhatsApp, Instagram, Facebook, TikTok.
- Textes publics et légaux adaptés au Bénin (FCFA, droit béninois, APDP, RCCM/IFU à compléter).
- Le paiement Mobile Money reste affiché comme **non configuré** tant qu'aucun adaptateur serveur n'est branché.

> Les tarifs de livraison et le catalogue actuels sont des **données de démonstration**. Ils doivent être remplacés par les conditions réelles de la boutique avant mise en ligne.

---

## Écarts avec la stack cible

Cette section est volontairement explicite : le projet fonctionne, mais il ne faut pas le présenter comme déjà migré vers la stack finale.

| Élément demandé | État réel dans ce dépôt | Conséquence |
| --- | --- | --- |
| React + TypeScript + Vite | **Fait** | Frontend fonctionnel. |
| Tailwind CSS | **Non installé** ; CSS natif dans [`web/src/styles/main.css`](web/src/styles/main.css) | Le design est opérationnel, mais une migration Tailwind reste à faire si elle est obligatoire. |
| Node.js + Express + TypeScript | **Fait** | API REST modulaire. |
| PostgreSQL + Prisma | **Non branché** ; SQLite via `node:sqlite`, plus un schéma PostgreSQL/Supabase de préparation | Le runtime local est SQLite. Prisma n'est pas installé. |
| Migrations versionnées | **Fait** pour SQLite, SQL fourni pour PostgreSQL/Supabase | Les migrations PostgreSQL n'ont pas été exécutées contre un projet réel. |
| Mobile Money / FedaPay | **Préparé mais non intégré** ; option désactivée, serveur refuse | Aucune transaction réelle ne peut être créée. |
| Paiement à la livraison | **Fait** | COD actif. |
| PDF facture / reçu | **Partiel** : reçu de commande PDF non fiscal | Facture fiscale et numérotation légale non réalisées. |
| Notifications e-mail / WhatsApp | **Non fait** | Aucun fournisseur configuré ; aucun message n'est envoyé automatiquement. |
| Rôles fins (produits, commandes, commercial) | **Partiel** : `customer`, `staff`, `admin` | Les permissions détaillées par métier restent à ajouter. |
| Sitemap / robots / JSON-LD | **Fait** : `robots.txt`, `sitemap.xml`, Open Graph et JSON-LD produit | Les données structurées sont générées depuis le catalogue publié. |

**Recommandation** : décider explicitement entre (A) conserver le runtime SQLite/CSS qui fonctionne et ajouter les modules manquants, ou (B) migrer vers PostgreSQL/Prisma/Tailwind. La migration B est un chantier structurel : elle ne doit pas être lancée en écrasant la base sans sauvegarde.

---

## Fonctionnalités

### Boutique publique

| Page | Route |
| --- | --- |
| Accueil | `/` |
| Boutique + recherche + filtres | `/boutique` |
| Catégorie | `/categories/:slug` |
| Produit | `/produit/:slug` |
| Panier | `/panier` |
| Validation de commande | `/commander` |
| Confirmation | `/commande/:reference` |
| Suivi de commande | `/suivi` |
| Favoris | `/favoris` |
| Connexion / inscription | `/connexion`, `/inscription` |
| Compte et commandes | `/compte`, `/compte/commandes/:id` |
| Contact | `/contact` |
| FAQ | `/faq` |
| Livraison et retours | `/livraison` |
| CGV | `/cgv` |
| Confidentialité | `/confidentialite` |
| Mentions légales | `/mentions-legales` |

### Administration (`/admin`)

- Tableau de bord : chiffre d'affaires sur commandes non annulées/remboursées, commandes, clients, meilleures ventes, stock bas, derniers messages.
- Produits : création/édition, description, catégorie, prix FCFA, prix promo et fenêtre de promotion, seuil de stock, publication/archivage, images multiples, variantes taille/couleur/stock, historique des mouvements de stock.
- Catégories : contenu, image, ordre d'affichage, publication.
- Commandes : liste filtrable, détail, coordonnées, articles, historique, transitions de statut contrôlées, note interne, téléchargement du reçu PDF non fiscal.
- Promotions : codes pourcentage ou montant fixe, minimum d'achat, dates, limites d'utilisation.
- Livraison : zones par pays, méthodes, prix, seuil de gratuité, délais.
- Réglages : accueil, bandeau, seuil de livraison offerte, contacts, WhatsApp, réseaux, adresse, mention de démonstration, identité légale (RCCM, IFU, forme juridique, éditeur, hébergeur) et date de dernière mise à jour légale.
- Messages : boîte de contact, marquage lu/archivé.
- Utilisateurs : rôles client/staff/admin, activation/désactivation.
- Rapports : export CSV des commandes filtrées (statut, recherche) et rapport PDF de synthèse.
- Journal d’audit : connexions staff/admin, changements de mot de passe, modifications sensibles ; accès en lecture seule réservé à la permission `audit:read`.
- Diagnostic de production : checklist des données légales, sauvegardes, HTTPS, médias et configuration avant mise en ligne.

---

## Démarrage rapide

Prérequis :

- Node.js **22.13+**, npm **10+** (Node 24 et npm 11 testés).
- Ports **4000** (API) et **5173** (Vite) libres.

```bash
# 1. Dépendances
npm install

# 2. Configuration serveur (si server/.env n'existe pas déjà)
cp .env.example server/.env
# Windows PowerShell :
# Copy-Item .env.example server/.env

# 3. Secret de session à remplacer dans server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 4. Catalogue de démonstration (idempotent)
npm run seed

# 5. Développement (API + frontend)
npm run dev
```

Ouvrir ensuite :

- Boutique : <http://localhost:5173>
- API : <http://localhost:4000/api/health>
- Administration : <http://localhost:5173/admin> (après création d'un administrateur)

> Sous PowerShell, si `npm` est bloqué par la politique d'exécution, utilisez `npm.cmd` et `npx.cmd`.

Le serveur applique automatiquement les migrations SQLite au démarrage. La base et les uploads sont créés dans `server/data/` et `server/uploads/` (ignorés par Git).
Le build serveur copie les fichiers SQL dans `server/dist/db/migrations/` afin que `npm start` puisse appliquer les migrations en production.

---

## Reprise dans un autre IDE

1. **Ouvrir le dossier racine** `PROJET HP COLLECTION` (celui qui contient `package.json`), pas seulement `server/` ou `web/`.
2. Vérifier Node : `node -v` doit afficher une version **≥ 22.13** (Node 24 recommandé). Le fichier [`.nvmrc`](.nvmrc) indique `24`.
3. Installer les dépendances : `npm install`.
4. Vérifier `server/.env` :
   - s'il existe, garder le `SESSION_SECRET` et les chemins ;
   - sinon, copier `.env.example` vers `server/.env` et générer un secret.
5. Lancer `npm run seed` : sur une base neuve, cela crée les 8 catégories, 10 produits DEMO, les zones de livraison et `BIENVENUE10`.
6. Lancer `npm run dev`, puis ouvrir `http://localhost:5173`.
7. Pour l'administration, depuis `server/` :

   ```bash
   npm run admin:create -- --email admin@exemple.bj --name "Administrateur"
   ```

   Le script demande ou génère un mot de passe et l'affiche une seule fois.
8. Vérifier avant de continuer :

   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

9. Ne jamais versionner : `server/.env`, `server/data/`, `server/uploads/`, `web/dist/`, `server/dist/`.

> **Base existante** : la migration `002_benin_xof_demo.sql` convertit automatiquement les anciens produits DEMO en FCFA et ajoute la zone Bénin, sans supprimer les commandes historiques. Les anciennes zones France/UE sont désactivées. Pour repartir d'une base vierge : `cd server` puis `npm run db:reset -- --yes`, puis `npm run seed` — **opération destructive**, à faire uniquement après sauvegarde.

---

## Variables d'environnement

Copier [`.env.example`](.env.example) vers `server/.env`. Ne jamais versionner `server/.env`.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` ou `production`. En production : cookie `Secure`, HSTS et refus de démarrer sans secret. |
| `PORT` | `4000` | Port de l'API. |
| `APP_URL` | `http://localhost:5173` | Origine publique autorisée pour le CSRF. Doit être l'URL HTTPS exacte en production. |
| `SESSION_SECRET` | vide | Secret de développement par défaut ; **obligatoire et ≥ 32 caractères en production**. |
| `SESSION_TTL_DAYS` | `14` | Durée de vie d'une session client. |
| `ADMIN_SESSION_TTL_HOURS` | `12` | Durée de vie des sessions staff/admin, volontairement plus courte. |
| `DATA_MODE` | `local` | `local` uniquement dans cette version. `supabase` est refusé explicitement. |
| `DATABASE_PATH` | `./data/hp-collection.sqlite` | Fichier SQLite, relatif à `server/`. |
| `UPLOAD_DIR` | `./uploads` | Dossier des images produits, relatif à `server/`. |
| `MAX_UPLOAD_MB` | `5` | Taille maximale d'une image. |
| `BACKUP_DIR` | `./backups` | Dossier des sauvegardes locales, ignoré par Git. |
| `BACKUP_RETENTION_DAYS` | `14` | Âge maximal des lots conservés. |
| `BACKUP_KEEP` | `5` | Nombre minimal de lots récents à conserver, même au-delà de la rétention. |
| `CURRENCY` | `XOF` | Devise ISO 4217. |
| `DEFAULT_COUNTRY` | `BJ` | Pays proposé par défaut au checkout. |
| `LOW_STOCK_THRESHOLD` | `5` | Seuil global d'alerte de stock bas. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | vides | Réservés à une future intégration Supabase. **La clé `service_role` ne doit jamais être exposée au navigateur.** |
| `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET` | vides | Réservés à FedaPay ou à un autre prestataire Mobile Money. Sans valeurs, le serveur refuse les commandes Mobile Money. |

Les montants sont stockés en **centimes entiers**. Pour le XOF (devise sans décimale à l'affichage), `22 900 FCFA` est stocké `2 290 000` en base et divisé par 100 à l'affichage. Cette convention interne doit être conservée lors de toute migration de base.

---

## Scripts

Depuis la racine :

| Commande | Effet |
| --- | --- |
| `npm run dev` | Lance l'API (`tsx watch`) et Vite en parallèle. |
| `npm run dev:server` | API seule. |
| `npm run dev:web` | Frontend seul. |
| `npm run seed` | Installe le catalogue de démonstration si la base n'est pas déjà marquée comme initialisée. |
| `npm test` | Tests serveur avec le test runner Node. |
| `npm run typecheck` | TypeScript serveur + frontend. |
| `npm run build` | Compile l'API puis construit le frontend. |
| `npm run backup` | Crée un lot de sauvegarde cohérent (base SQLite via `VACUUM INTO` + uploads) et purge les anciens lots. |
| `npm run backup:verify` | Vérifie l'intégrité du dernier lot de sauvegarde. |
| `npm start` | Démarre l'API compilée (sert aussi `web/dist` en production). |
| `npm run admin:create` | Création/promotion d'un administrateur, **à lancer depuis `server/`** pour les arguments. |
| `npm run db:reset` | Suppression de la base locale, **avec `--yes`**. |

Exemples avec arguments (à exécuter dans `server/`) :

```bash
cd server
npm run db:reset -- --yes
npm run seed

npm run admin:create -- --email admin@exemple.bj --name "Prénom Nom"
# ou, pour promouvoir un compte existant :
npm run admin:create -- --email admin@exemple.bj --promote
```

`admin:create` génère un mot de passe aléatoire s'il n'est pas fourni et l'affiche une seule fois.
Un mot de passe fourni doit faire au moins 12 caractères. Éviter `--password` en clair dans l'historique du shell ; préférer `ADMIN_PASSWORD`.

---

## Base de données locale

- Schéma : [`server/src/db/migrations/001_init.sql`](server/src/db/migrations/001_init.sql).
- Migration Bénin/XOF : [`server/src/db/migrations/002_benin_xof_demo.sql`](server/src/db/migrations/002_benin_xof_demo.sql).
- Historique des mouvements de stock : [`server/src/db/migrations/003_stock_movements.sql`](server/src/db/migrations/003_stock_movements.sql).
- Carnet d’adresses client : [`server/src/db/migrations/004_customer_addresses.sql`](server/src/db/migrations/004_customer_addresses.sql).
- Photos produits locales : [`server/src/db/migrations/005_real_product_visuals.sql`](server/src/db/migrations/005_real_product_visuals.sql).
- Visuel éditorial de l’accueil : [`server/src/db/migrations/006_hero_editorial.sql`](server/src/db/migrations/006_hero_editorial.sql).
- Permission `audit:read` et index du journal : [`server/src/db/migrations/007_admin_audit_read.sql`](server/src/db/migrations/007_admin_audit_read.sql).
- Application automatique des migrations au démarrage, avec table `schema_migrations`.
- WAL activé, clés étrangères activées, `busy_timeout` à 5 s.
- `npm run seed` crée 8 catégories, 10 produits de démonstration, leurs variantes, une zone Bénin et deux modes de livraison, le code `BIENVENUE10` et les réglages publics.
- Le seed est idempotent : il ne réinstalle rien si `seeded_at` existe.
- `db:reset -- --yes` supprime le fichier SQLite et recrée le schéma ; le catalogue est ensuite vide jusqu'à `npm run seed`.

Sauvegarde : `npm run backup` crée un lot cohérent avec `VACUUM INTO` (même si le mode WAL est actif), copie les uploads, puis purge les lots au-delà de `BACKUP_RETENTION_DAYS` en conservant au minimum `BACKUP_KEEP` lots. `npm run backup:verify` contrôle le dernier lot. Les archives doivent être copiées hors du serveur. La procédure complète de restauration et de mise en production est décrite dans [`docs/PRODUCTION.md`](docs/PRODUCTION.md).

---

## Administration

1. Créer un compte via `/inscription` ou directement avec le script.
2. Créer/promouvoir l'administrateur :

   ```bash
   cd server
   npm run admin:create -- --email admin@exemple.bj --name "Administrateur"
   ```

3. Se connecter via `/connexion`, puis ouvrir `/admin`.
4. Renseigner l’identité légale et l’hébergeur dans **Paramètres**, puis contrôler les points bloquants dans **Mise en production** (`/admin/production`).
5. Consulter **Journal d’audit** (`/admin/audit`) pour les connexions staff/admin et les modifications sensibles. Le journal est en lecture seule.

Il n'existe **aucune route HTTP de bootstrap administrateur** : l'élévation de rôle passe uniquement par le script exécuté avec accès direct à la base. La promotion révoque les sessions existantes du compte concerné.

---

## Tests et vérifications

```bash
npm test
npm run typecheck
npm run build
```

Résultats observés le **12 novembre 2026** sur Node `v24.22.0` / npm `11.19.1` :

- `npm test` : **41 tests, 41 réussis, 0 échec** (`auth.test.ts`, `catalog.test.ts`, `addresses.test.ts`, `orders.test.ts`, `admin.test.ts`, `seo.test.ts`, `backups.test.ts`).
- `npm run typecheck` : serveur et frontend sans erreur.
- `npm run build` : compilation serveur + build Vite réussi.

Les tests utilisent une base SQLite **en mémoire**, initialisée et peuplée par fichier de test ; ils ne modifient pas la base de développement. `server/test/setup.mjs` force `CURRENCY=XOF`, `DEFAULT_COUNTRY=BJ` et `DATA_MODE=local` pour ne pas dépendre du `.env` local. Ils couvrent notamment :

- en-têtes de sécurité, CSRF, inscription/connexion, session, déconnexion, RBAC ;
- catalogue public, filtres, recherche, facettes, livraison Bénin, réglages ;
- CRUD d'administration : catégories, produits et variantes, archivage, promotions, zones et modes de livraison, réglages, rôles, messages ;
- devis serveur, prix recalculés, stock insuffisant, code promo, commande et suivi ;
- refus du paiement Mobile Money non configuré, transitions de statut invalides, restitution unique du stock à l'annulation ;
- enregistrement des mouvements de stock à la vente, à l'annulation et lors d'un ajustement manuel administrateur ;
- carnet d’adresses : CRUD, adresse par défaut, validation et isolation entre clients ;
- export CSV des commandes avec filtres et en-têtes UTF-8 ;
- rapport PDF de synthèse (CA, commandes, panier moyen, répartition, meilleures ventes) ;
- sauvegarde cohérente de la base et des médias, vérification d’intégrité et purge contrôlée ;
- accès protégé au journal d’audit et au diagnostic de production ;
- génération de `robots.txt` et du `sitemap.xml` sans exposer `/admin`.

Vérifications navigateur effectuées sur le serveur de développement : accueil, boutique, fiche produit, ajout au panier, checkout COD, confirmation, suivi, compte, favoris, contact, messages admin, tableau de bord et pages d'administration. Les pages légales, le diagnostic de production et le journal d’audit doivent encore être contrôlés après saisie des informations réelles de l’entreprise.

---

## Déploiement local

### Mode recommandé pour cette version : un seul serveur Node + SQLite

1. Construire :

   ```bash
   npm ci
   npm run build
   ```

2. Configurer `server/.env` :

   ```dotenv
   NODE_ENV=production
   PORT=4000
   APP_URL=https://www.votre-domaine.bj
   SESSION_SECRET=<secret aléatoire de 64+ caractères>
   DATA_MODE=local
   CURRENCY=XOF
   DEFAULT_COUNTRY=BJ
   DATABASE_PATH=/var/lib/hp-collection/hp-collection.sqlite
   UPLOAD_DIR=/var/lib/hp-collection/uploads
   ```

3. Démarrer :

   ```bash
   npm start
   ```

4. Placer un reverse proxy HTTPS devant l'API (Nginx, Caddy, etc.). En production, les cookies de session sont marqués `Secure` : **HTTPS est obligatoire**, sinon la connexion ne persiste pas.

5. Monter `DATABASE_PATH` et `UPLOAD_DIR` sur des volumes persistants et les sauvegarder.

6. Servir l'application sur un seul processus, ou prévoir un stockage partagé. La limitation de débit est en mémoire et SQLite accepte un seul écrivain : ce mode n'est pas conçu pour un déploiement multi-instances à fort trafic.

La checklist complète (HTTPS, variables de production, sauvegardes planifiées, restauration, durcissement, limites) se trouve dans [`docs/PRODUCTION.md`](docs/PRODUCTION.md).

Exemple Nginx minimal :

```nginx
server {
  listen 443 ssl http2;
  server_name www.votre-domaine.bj;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

L'API sert le frontend compilé depuis `web/dist` en production et renvoie `index.html` pour les routes React, hors `/api` et `/uploads`.

---

## Publication GitHub et CI

Dépôt cible : **<https://github.com/gratias123/HP-shopping>**.

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) s'exécute à chaque `push` sur `main` et sur chaque pull request. Il installe les dépendances avec `npm ci`, puis vérifie :

1. les types TypeScript (`npm run typecheck`) ;
2. les tests serveur (`npm test`) ;
3. le build de production (`npm run build`) ;
4. la présence des fichiers produits attendus (serveur, migration `007`, frontend, visuel d'accueil).

Ce workflow **vérifie et construit** le projet ; il ne déploie pas encore l'application sur un hébergeur public. Un déploiement en ligne nécessite une cible (VPS, conteneur, plateforme) et des secrets d'accès à configurer séparément.

Pour publier une version locale :

```bash
git remote add origin https://github.com/gratias123/HP-shopping.git
git push -u origin main
```

Ne jamais versionner `server/.env`, `server/data/`, `server/uploads/`, `server/backups/`, `node_modules/` ou `web/dist/`. Ces chemins sont couverts par [`.gitignore`](.gitignore).

---

## Base PostgreSQL / Supabase

Les fichiers suivants préparent une architecture PostgreSQL/Supabase :

| Fichier | Contenu |
| --- | --- |
| [`supabase/migrations/20261103000100_schema.sql`](supabase/migrations/20261103000100_schema.sql) | Tables, contraintes, index, triggers `updated_at`, profils liés à `auth.users`. |
| [`supabase/migrations/20261103000200_functions.sql`](supabase/migrations/20261103000200_functions.sql) | Création automatique du profil, helpers RBAC, `create_order`, `update_order_status`, `promote_first_admin`. |
| [`supabase/migrations/20261103000300_rls.sql`](supabase/migrations/20261103000300_rls.sql) | RLS, policies de lecture publique/authentifiée, grants minimaux. |
| [`supabase/migrations/20261111000100_customer_addresses.sql`](supabase/migrations/20261111000100_customer_addresses.sql) | Parité du carnet d’adresses client, index d’adresse par défaut et RLS. Migration rédigée mais non exécutée. |

### Application des migrations

Avec la CLI Supabase, dans un projet lié :

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Ou appliquer les quatre fichiers **dans l'ordre** via le SQL Editor du projet. Aucun de ces fichiers n'a été exécuté contre un projet Supabase réel dans cet environnement.

### Bootstrap du premier administrateur

1. Créer un utilisateur via Supabase Auth (inscription ou tableau de bord). Le trigger `handle_new_user` crée son profil.
2. Exécuter, avec la clé `service_role` ou depuis le SQL Editor :

   ```sql
   select public.promote_first_admin('admin@exemple.bj');
   ```

La fonction refuse de s'exécuter si un administrateur actif existe déjà. Elle n'est pas exécutable par `anon` ni `authenticated`.
Il faut ensuite renseigner le catalogue, les zones de livraison et les réglages (`settings`) via l'administration ou des insertions SQL contrôlées : les migrations ne créent volontairement aucune donnée commerciale factice.

### Ce qui est prêt / ce qui ne l'est pas

**Prêt dans les fichiers SQL :**

- schéma PostgreSQL avec contraintes de prix, stock, statuts, lignes de commande et index ;
- RLS activée sur toutes les tables ;
- lectures publiques limitées au catalogue publié, aux livraisons actives et aux réglages marqués publics ;
- profils, favoris et commandes limités à leur propriétaire ou aux rôles autorisés ;
- fonction `create_order` qui recalcule les prix, verrouille les variantes, valide le stock, applique le promo et la livraison, décrémente le stock et fige les lignes ;
- fonction `update_order_status` avec machine à états et restitution du stock à l'annulation ;
- bootstrap admin contrôlé.

**Non réalisé / non vérifié :**

- **Aucune migration Supabase n'a été exécutée contre un projet réel dans ce dépôt.** La syntaxe et les policies n'ont pas été validées par un run cloud.
- **L'adaptateur applicatif Supabase n'est pas implémenté.** Les routes et services utilisent `node:sqlite`. `DATA_MODE=supabase` est donc refusé au démarrage.
- **Prisma n'est pas installé** et aucun schéma Prisma n'est branché.
- L'authentification Supabase Auth n'est pas branchée sur l'API : le mode local utilise son propre stockage de sessions.
- Aucun stockage Supabase Storage n'est branché : les uploads restent locaux.

Pour rendre ce mode réellement exploitable, il reste à choisir entre Prisma et Supabase, écrire une couche de dépôt PostgreSQL côté serveur (avec la clé `service_role` **uniquement côté serveur**), mapper les DTO existants, puis exécuter et tester les migrations sur une base de recette.

---

## Sécurité

- Mots de passe : `scrypt` (`N=16384`, `r=8`, `p=1`, sel aléatoire, clé de 64 octets), comparaison à temps constant.
- Sessions : jeton aléatoire de 32 octets, **seul son hash SHA-256 est stocké**, cookie `hp_session` `HttpOnly` + `SameSite=Lax` (+ `Secure` en production), expiration et purge. Les sessions staff/admin expirent après `ADMIN_SESSION_TTL_HOURS` (12 h par défaut).
- CSRF : cookie `hp_csrf` lisible + en-tête `x-csrf-token` exigé sur les mutations, avec contrôle d'origine.
- Limitation de débit en mémoire sur les routes sensibles (connexion, inscription, contact, etc.). **Non partagée entre plusieurs instances.**
- RBAC en base : rôles `customer`, `staff`, `admin` et permissions (`catalog:*`, `orders:*`, `audit:read`, etc.), vérifiées côté serveur.
- Journal d’audit en lecture seule : connexions staff/admin, changements de mot de passe et modifications sensibles, consultable uniquement avec `audit:read`.
- Diagnostic de production : `/api/admin/readiness` et page `/admin/production` signalent les données légales manquantes, l’absence de sauvegarde récente et les configurations à corriger.
- Prix, promotions, frais de port et stocks **recalculés côté serveur** ; un prix envoyé par le navigateur n'est jamais accepté.
- Stock décrémenté dans la transaction de création de commande, avec verrouillage/conditions ; restitution unique en cas d'annulation.
- Lignes de commande figées (nom, référence, taille, couleur, prix unitaire, quantité) même si le catalogue change ensuite.
- Machine à états des commandes : `pending → confirmed → preparing → shipped → delivered`, annulation depuis `pending/confirmed/preparing`, remboursement depuis `delivered`. Toute autre transition est refusée.
- Aucune donnée de paiement sensible n'est collectée ni stockée. Le Mobile Money est désactivé tant qu'aucun prestataire n'est configuré ; le serveur refuse explicitement une commande Mobile Money dans ce cas.
- Uploads : types et taille contrôlés, noms aléatoires, dossier servi avec `X-Content-Type-Options: nosniff`.
- En-têtes : `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, HSTS en production.
- Bootstrap administrateur uniquement par script local / SQL service_role, jamais par HTTP.

---

## Limites connues et reste à faire

### Priorité 1 — avant toute mise en ligne

- **Remplacer les données de démonstration** : produits, prix, photos, stocks, frais et zones de livraison. Les photos actuelles sont des illustrations libres de droits, pas les articles réels.
- **Compléter les pages légales** : RCCM, IFU, adresse, téléphone, e-mail, éditeur, hébergeur et autorité de réclamation. Les pages CGV, confidentialité et mentions légales lisent les paramètres de l’administration et affichent explicitement `[À COMPLÉTER]` tant qu’un champ manque. Elles doivent être relues par un professionnel du droit béninois.
- **Configurer un vrai moyen de contact** : l'adresse `contact@hpcollection.example` est fictive.
- **Sauvegarder** la base SQLite et les uploads avant toute migration ou réinitialisation. `npm run backup` et `npm run backup:verify` sont disponibles, mais leur planification reste à configurer sur le serveur.
- **Double authentification administrateur (2FA)** : non implémentée. Les sessions admin sont plus courtes, mais un mot de passe compromis suffit encore à ouvrir l’administration.

### Priorité 2 — fonctionnalités demandées non terminées

- **Mobile Money / FedaPay** : créer la transaction côté serveur, vérifier les montants, vérifier la signature des webhooks, garantir l'idempotence, mettre à jour le statut uniquement après confirmation fiable. Ne jamais déduire un paiement réussi du simple retour sur une page.
- **PDF facture / reçu** : un **reçu de commande PDF non fiscal** est disponible depuis le compte client et l'administration (`/api/orders/:id/receipt.pdf`, `/api/admin/orders/:id/receipt.pdf`). Il reprend les instantanés de commande et les coordonnées configurées. Une **facture fiscale** avec numérotation légale reste à concevoir avec un professionnel compétent ; ne pas présenter le reçu comme une facture normalisée.
- **Mouvements de stock** : historique immuable des ventes, annulations, stocks initiaux et ajustements manuels, affiché dans la fiche produit. Les réservations/livraisons et un écran de réassort dédié restent à ajouter.
- **Rapports** : export CSV des commandes disponible depuis `/admin/commandes` (filtres statut/recherche, UTF-8, séparateur `;`) et endpoint `/api/admin/reports/orders.csv`. Un **rapport PDF de synthèse** est disponible via `/api/admin/reports/sales.pdf` (CA, commandes, panier moyen, répartition des statuts, meilleures ventes). Les ventes par catégorie, les rapports datés et les exports planifiés restent à ajouter.
- **Rôles fins** : gestionnaire produits, gestionnaire commandes, responsable commercial, avec permissions serveur.
- **Notifications** : in-app et future intégration WhatsApp Business ; ne rien envoyer tant qu'aucun fournisseur n'est configuré.
- **SEO** : sitemap dynamique, robots.txt et JSON-LD produit ajoutés ; prévoir un contrôle Search Console et des URLs canoniques définitives après choix du domaine.
- **Tests** : parcours FedaPay en sandbox, tests de webhook, tests de facture, tests de rapports.

### Priorité 3 — qualité et exploitation

- Migration éventuelle vers **PostgreSQL + Prisma** et **Tailwind CSS** si cette stack est obligatoire.
- CSP, audit d'accessibilité formel, tests de charge, planification des sauvegardes hors serveur, supervision.
- Intégration transporteur et numéros de suivi.

### Limites actuelles

- **Pas d'envoi d'e-mail transactionnel** : aucun fournisseur SMTP/API n'est configuré. La confirmation et le suivi sont affichés **dans l'application**.
- **Pas de paiement Mobile Money actif** : l'option est visible mais désactivée, et le serveur la refuse. Le COD est le seul moyen actif.
- **Pas d'intégration transporteur** : les statuts et numéros de suivi sont gérés manuellement dans l'administration.
- **SQLite et limitation de débit en mémoire** : adaptés à une boutique à trafic modéré sur une instance unique, pas à un cluster.
- **Pas de CSP** : les en-têtes de sécurité de base sont présents, mais aucune Content-Security-Policy n'est configurée.
- **Accessibilité** : structure sémantique, focus visibles, contrastes et libellés ARIA ont été travaillés, mais aucun audit formel RGAA/WCAG n'a été réalisé.
- **Recette visuelle** : les parcours publics et plusieurs pages admin ont été contrôlés dans le navigateur. Les pages légales, le diagnostic de production et le journal d’audit nécessitent une dernière recette après saisie des informations réelles.

---

## Structure du dépôt

```text
.
├─ server/
│  ├─ src/
│  │  ├─ db/migrations/001_init.sql
│  │  ├─ db/migrations/002_benin_xof_demo.sql
│  │  ├─ db/migrations/003_stock_movements.sql
│  │  ├─ db/migrations/004_customer_addresses.sql
│  │  ├─ db/migrations/005_real_product_visuals.sql
│  │  ├─ db/migrations/006_hero_editorial.sql
│  │  ├─ db/migrations/007_admin_audit_read.sql
│  │  ├─ db/seed/                     # catalogue de démonstration
│  │  ├─ lib/                         # auth, validation, erreurs, ids, monnaie, PDF
│  │  ├─ middleware/                  # sécurité, auth
│  │  ├─ routes/                      # API publique + admin
│  │  ├─ services/                    # catalogue, commandes, promos, livraison, sauvegardes, diagnostic
│  │  ├─ scripts/create-admin.ts      # bootstrap admin
│  │  ├─ scripts/backup.ts            # sauvegarde + purge
│  │  ├─ scripts/verify-backup.ts     # contrôle d’intégrité
│  │  ├─ app.ts / index.ts / config.ts
│  │  └─ ...
│  └─ test/                           # tests Node + setup.mjs
├─ web/
│  ├─ public/media/                   # photos d’illustration locales + crédits
│  ├─ src/components/                 # header, footer, panier, UI
│  ├─ src/lib/                        # API client, contextes, hooks, types
│  ├─ src/pages/                      # pages publiques
│  ├─ src/pages/admin/                # pages d'administration
│  └─ src/styles/main.css             # design system
├─ supabase/migrations/               # schéma PostgreSQL, RLS, RPC
├─ docs/PRODUCTION.md                 # checklist, sauvegardes, restauration, Nginx
├─ .github/workflows/ci.yml           # typecheck, tests et build sur GitHub
├─ .editorconfig
├─ .env.example
├─ .gitattributes
├─ .nvmrc
├─ package.json
└─ README.md
```

---

## Données de démonstration et mentions légales

- Les produits, prix et descriptions fournis par le seed sont **fictifs** et marqués `DEMO-*`. Ils ne doivent pas être présentés comme des produits réels.
- Aucun avis client, label, certification ou partenariat n'est inventé.
- Les photos sont des **illustrations libres de droits** téléchargées depuis Unsplash et Pexels, stockées localement. Elles ne représentent pas les articles réels HP COLLECTION. Les sources et licences sont documentées dans [`web/public/media/CREDITS.md`](web/public/media/CREDITS.md).
- Le code promotionnel de démonstration est `BIENVENUE10`.
- Les tarifs de livraison de démonstration (Cotonou / national) doivent être confirmés par la boutique.
- Les mentions de livraison, retours et paiement doivent être adaptées aux conditions réelles de la boutique.
- Les pages CGV, confidentialité et mentions légales sont des bases de travail à faire valider juridiquement. Elles reprennent les champs saisis dans l’administration et affichent `[À COMPLÉTER]` pour toute information manquante ; aucune donnée d’entreprise n’est inventée.

---

## Contact / support

Ce dépôt ne contient pas de coordonnées réelles. Remplacer le nom, l'adresse, l'e-mail, le téléphone et le WhatsApp dans l'administration avant toute mise en ligne.
