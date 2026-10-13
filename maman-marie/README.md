# Les collations de Maman Tokpa

Site statique (HTML/CSS/JS natif). Aucun build requis.

## Lancer
Ouvrir `index.html`, ou : `python3 -m http.server 8080` puis http://localhost:8080

## À renseigner (`assets/js/config.js`)
- `phoneCall`, `phoneWhatsapp` : chiffres uniquement avec indicatif (ex. `225XXXXXXXXXX`). Tant qu'ils sont vides/invalides, les boutons sont désactivés et un message s'affiche.
- `price` (nombre en FCFA), `unit` (ex. "sachet") et `image` (ex. `assets/img/cracky.jpg`, ratio 4:3) par produit. Sans prix : « Prix sur demande ».

## Administration hébergée sans frais

L'administration est un petit site statique avec quelques fonctions Cloudflare Pages. Il n'y a **ni Supabase, ni base de données, ni frais d'API obligatoires** : les données du catalogue sont le fichier `data/catalog.json` du dépôt. L'API REST gratuite de GitHub sert uniquement au panneau de gestion pour lire/modifier ce fichier et ajouter les photos au dépôt. Les visiteurs chargent le JSON statique et commandent directement par WhatsApp, sans compte.

Le panneau permet de modifier les coordonnées et le catalogue (produits, offres, variantes, prix, photos, disponibilité). Il ne modifie pas encore les textes fixes des sections d'accueil/présentation, le logo, la mise en page ou le style visuel; ceux-ci restent des changements de code à publier depuis GitHub.

L'accès au panneau utilise un mot de passe administrateur stocké comme secret Cloudflare. Après connexion, une session signée et temporaire est conservée dans un cookie `HttpOnly`, `Secure` et `SameSite=Strict`. Le jeton GitHub, le mot de passe et la clé de signature restent côté serveur; aucun n'est inclus dans les fichiers publics.

### Mise en ligne initiale

1. Garder le dépôt sur GitHub, puis dans Cloudflare ouvrir **Workers & Pages → Create application → Pages → Connect to Git**. Autoriser l'accès au dépôt `LILSTONE225/maman-marie` et utiliser le nom de projet `maman-tokpa-site` (celui indiqué dans `wrangler.toml`).
2. Dans les réglages de build, définir le dossier racine du projet sur `maman-marie`, la branche de production sur `main`, le framework sur **None**, la commande de build vide et le dossier de sortie sur `.`. Ainsi Cloudflare publie ce sous-dossier du dépôt, où se trouvent `functions/` et `wrangler.toml`. Utiliser une intégration Git, pas un téléversement direct.
3. Cloudflare attribue une adresse gratuite de la forme `nom-du-projet.pages.dev`. Pour les Pages Functions, le forfait Free indique actuellement une limite de 100 000 requêtes Worker par jour; les ressources et quotas des forfaits peuvent évoluer.
4. Sur GitHub, créer un jeton **Fine-grained personal access token** limité à ce seul dépôt, avec **Contents: Read and write**. Ne pas créer de jeton classique à tous les dépôts. Sa durée d'expiration impose éventuellement un renouvellement.
5. Dans Cloudflare Pages → **Settings → Variables and Secrets**, ajouter ces variables de production :
   - Variables ordinaires : `GITHUB_OWNER` = `LILSTONE225`, `GITHUB_REPO` = `maman-marie`, `GITHUB_PROJECT_DIR` = `maman-marie`, `GITHUB_BRANCH` = `main`.
   - Secrets : `GITHUB_TOKEN` = le jeton GitHub; `ADMIN_PASSWORD` = un mot de passe fort réservé à la cliente; `SESSION_SECRET` = au moins 32 caractères aléatoires. Générer ce dernier localement avec `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` et le coller directement dans Cloudflare, jamais dans GitHub ou dans une conversation.
6. Redéployer le site après la configuration des variables et secrets.
7. Tester `/api/auth/session` (doit répondre `{"authenticated":false}` sans connexion), `/api/catalog`, puis se connecter à `/admin.html`. Enregistrer un changement de test; il doit créer un commit dans GitHub et lancer le déploiement Cloudflare.

Cloudflare Pages Functions utilise le forfait Workers Free dans les limites affichées; les fichiers statiques sont gratuits selon la tarification actuelle. GitHub REST API a aussi des quotas. Cela évite un abonnement et une API payante au démarrage, **mais ce n'est pas une promesse d'usage illimité ou de coût futur nul**. Ne passez pas à un forfait payant; vérifiez les quotas et conditions des deux services avant d'accepter chaque nouveau site.

GitHub Pages fournit une adresse `github.io`, mais ses [limites officielles](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) disent que l'hébergement gratuit n'est pas destiné aux sites d'entreprise ou facilitant les transactions. Pour ce site commercial, GitHub héberge le code; Cloudflare Pages héberge le site avec `pages.dev`. Un domaine personnalisé `.com` ou `.ci` est normalement payant.

### Utilisation par la cliente

1. Ouvrir `/admin.html`, saisir le mot de passe reçu en privé, puis modifier les produits, prix, textes, offres et disponibilité.
2. Pour remplacer une photo, sélectionner une image JPEG/PNG/WebP/GIF de 2 Mo maximum. L'image est envoyée dans `assets/img/` du dépôt.
3. Cliquer **Enregistrer et publier les changements**. L'API gratuite de GitHub crée un commit pour le catalogue; Cloudflare Pages reconstruit automatiquement le site. Attendre la fin du déploiement avant de vérifier les modifications publiques.

La cliente n'a pas besoin d'un compte visiteur; il y a un seul mot de passe d'administration. Pour le changer, modifier le secret `ADMIN_PASSWORD` dans Cloudflare et redéployer. Pour révoquer l'accès, changer ce mot de passe et le secret `SESSION_SECRET`. Le jeton GitHub reste un secret Cloudflare et doit être renouvelé avant sa date d'expiration.

### Refaire ce modèle sur un autre projet

1. Conserver le même principe : catalogue JSON public, pas de données personnelles de clients, ni panier/paiement.
2. Adapter les champs dans `data/catalog.json`, l'éditeur `admin.html` / `assets/js/admin.js` et le rendu du catalogue.
3. Limiter les routes serveur aux actions strictement nécessaires. Garder les identifiants GitHub dans les secrets Cloudflare et écrire via l'API uniquement dans les chemins du projet; ne jamais exposer le jeton au navigateur.
4. Pour chaque nouveau dépôt, créer un jeton finement limité à ce seul dépôt et configurer ses variables/secrets dans un nouveau projet Pages. Ne pas réutiliser le jeton d'un client chez un autre.
5. Tester les refus sans session, l'enregistrement autorisé, les erreurs/quota GitHub, le téléversement et le déploiement avant de remettre l'accès à la cliente.
