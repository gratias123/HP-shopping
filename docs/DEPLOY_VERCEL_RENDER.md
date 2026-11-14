# Déploiement Vercel + Render

Architecture retenue :

- **Vercel** sert le frontend React compilé et joue le rôle de reverse proxy pour `/api/*` et `/uploads/*`.
- **Render** exécute l’API Express et conserve la base SQLite et les images sur un **disque persistant**.
- Le navigateur reste sur le domaine Vercel : cookies de session, CSRF et uploads fonctionnent sans CORS supplémentaire.

Liens directs :

- Render : <https://render.com/deploy?repo=https://github.com/gratias123/HP-shopping>
- Vercel : <https://vercel.com/new>

## 1. Créer le service Render

1. Pousser le dépôt sur GitHub.
2. Dans Render : **New → Blueprint**, sélectionner le dépôt `gratias123/HP-shopping`.
3. Render lit [`render.yaml`](../render.yaml) et propose le service `hp-collection-api`.
4. Renseigner `APP_URL` avec l’URL publique Vercel **sans slash final**, par exemple `https://hp-shopping.vercel.app` ou le domaine personnalisé.
5. Vérifier que le disque `hp-collection-data` est monté sur `/var/data` (1 Go).
6. Déployer.

Le plan avec disque persistant est un plan payant. Sans disque, les commandes, comptes et images seraient perdus à chaque redéploiement.

Une fois le service en ligne, noter son URL, par exemple `https://hp-collection-api.onrender.com`.

## 2. Créer le projet Vercel

1. Dans Vercel : **Add New → Project**, importer le dépôt GitHub.
2. Laisser la racine du projet sur la racine du dépôt.
3. Le build est défini par [`vercel.json`](../vercel.json) : `npm ci`, `npm run build -w web`, sortie `web/dist`.
4. Ajouter la variable d’environnement **`BACKEND_URL`** :
   - valeur : URL Render, sans slash final ;
   - environnements : Production (et Preview si vous acceptez les limites ci-dessous).
5. Déployer.

`vercel.json` redirige :

- `/api/*` vers `${BACKEND_URL}/api/*` ;
- `/uploads/*` vers `${BACKEND_URL}/uploads/*` ;
- les autres routes vers le frontend React.

## 3. Initialiser la boutique

Dans le **Shell** Render du service :

```bash
npm run seed
npm run admin:create -- --email admin@votre-domaine.com --name "Administrateur"
```

`npm run seed` installe le catalogue de démonstration et les réglages. Si la boutique doit démarrer sans données fictives, créer d’abord l’administrateur, puis saisir le catalogue réel depuis `/admin`.

Conserver le mot de passe généré par `admin:create` : il n’est affiché qu’une fois.

## 4. Vérifications après déploiement

- `https://<domaine-vercel>/api/health` doit renvoyer `{"ok":true,...}`.
- La page d’accueil et les images `/media/*` doivent s’afficher.
- Une connexion client doit persister après rechargement.
- Le panier et le checkout COD doivent créer une commande.
- L’administration doit être accessible et le téléchargement d’un reçu PDF doit fonctionner.
- Une image produit téléversée doit s’afficher via `/uploads/...`.

## 5. Domaines et cookies

`APP_URL` côté Render doit correspondre **exactement** au domaine utilisé dans le navigateur, sans slash final. En production, l’API exige HTTPS et les cookies sont `Secure`.

Si un domaine personnalisé est ajouté :

1. l’ajouter dans Vercel ;
2. mettre à jour `APP_URL` sur Render avec ce domaine ;
3. redéployer Render, puis Vercel si nécessaire.

## 6. Preview Vercel

Les déploiements de prévisualisation utilisent la même variable `BACKEND_URL` et le même backend. Le contrôle CSRF compare l’origine du navigateur à `APP_URL` : une preview sur un domaine différent peut donc refuser les connexions et mutations.

Pour tester l’administration, utiliser le déploiement de production. Une vraie préproduction demande un second service Render avec sa propre base et son propre `APP_URL`.

## 7. Sauvegardes

Les données sont sur le disque Render :

- `/var/data/hp-collection.sqlite`
- `/var/data/uploads/`
- `/var/data/backups/`

Commandes utiles dans le Shell Render :

```bash
npm run backup
npm run backup:verify
```

La sauvegarde reste sur le disque Render. Pour une copie hors site, prévoir un stockage externe chiffré ou un job de copie vers un bucket S3 compatible. Cette copie externe n’est pas encore implémentée.

## 8. Limites

- **Une seule instance** : le disque persistant empêche l’autoscaling et le multi-instance.
- **SQLite** : adapté à une boutique à trafic modéré ; pas de cluster.
- **Sauvegarde hors site** : à ajouter avant une exploitation réelle.
- **Mobile Money** : toujours non configuré ; seul le paiement à la réception est actif.
- **Vercel** : la plateforme sert le frontend et proxyfie l’API ; elle ne stocke aucune donnée métier.
