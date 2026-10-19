# Espace propriétaire — mise en service

URL : `https://lilstone225.github.io/maman-marie/admin/` (aucun lien depuis la vitrine).

## 1. Supabase (projet de test d'abord)
1. Créer un projet. **Authentication > Sign In / Providers** : désactiver *Allow new users to sign up* et *Allow anonymous sign-ins*. Régler la durée de session dans *Sessions*.
2. **Authentication > Users > Add user** : e-mail propriétaire + clé secrète longue (le mot de passe). Cocher *Auto Confirm*. Cet e-mail est un identifiant, pas un secret.
3. **SQL Editor** : exécuter dans l'ordre `supabase/migrations/20261018000000_owner_space.sql`, `supabase/migrations/20261018000100_content_validation.sql`, puis l'unique bloc `DO` de `supabase/seed.sql` (généré par `node supabase/make-seed.mjs` depuis `config.js`). Le bloc crée les tables manquantes et importe les données dans une même commande : ne sélectionnez pas seulement une ligne `INSERT`.
   Si Supabase signale encore `relation "public.site_published" does not exist`, vérifier que le bloc `DO` complet a été collé et exécuté, depuis `DO $seed$` jusqu'à `$seed$;`.
4. **Autoriser le compte à accéder à l'espace propriétaire** (créer l'utilisateur à l'étape 2 ne suffit pas). Dans le SQL Editor, remplacer l'e-mail par celui du compte créé et exécuter :
   ```sql
   insert into public.app_owner (user_id)
   select id from auth.users where email = 'EMAIL_PROPRIETAIRE'
   on conflict (user_id) do nothing;
   ```
   Vérifier qu'une ligne a été insérée ou que le compte est déjà propriétaire :
   `select u.email, o.user_id is not null as proprietaire from auth.users u left join public.app_owner o on o.user_id = u.id where u.email = 'EMAIL_PROPRIETAIRE';`
5. **Project Settings > API** : copier l'URL et la clé *publishable/anon* dans `assets/js/env.js`. Ne jamais y mettre `service_role`.

## 2. Parité de l'import
`node supabase/make-seed.mjs` affiche 9 produits / 12 variantes. Vérifier dans Supabase :
`select jsonb_array_length(data->'products') from site_published;` → 9.

## 3. Déploiement
Commit + push sur `main` : le workflow existant publie `maman-marie/` (admin inclus). Si `env.js` est vide ou Supabase injoignable (4 s), la vitrine retombe sur `config.js`.

## 4. Usage
Rubriques : Catalogue, Textes (34 textes du site), Sections et apparence (ordre, visibilité, 5 couleurs officielles), Images (logo, visuels, QR), Contacts, Légal (vide par défaut : vos textes validés uniquement).
Modifier → cliquer sur « Enregistrer » (sauvegarde le brouillon privé et affiche « Brouillon enregistré ») → « Aperçu du brouillon » → « Publier » (met réellement les changements en ligne). L'aperçu et la publication restent désactivés tant qu'il y a des modifications non enregistrées. L'enregistrement seul ne modifie pas encore le site public. Historique : restaurer charge une version dans le brouillon, puis Publier la remet en ligne.

## 5. Récupération / retour arrière
Réinitialiser la clé : Authentication > Users > Reset password. Retour à l'ancien rendu : vider `SUPABASE_URL` dans `env.js` (la vitrine lit `config.js`).
