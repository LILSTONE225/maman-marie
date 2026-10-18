# Les collations de Maman Tokpa

Site vitrine statique en HTML, CSS et JavaScript natif. Aucun compte client, base de données, fonction serveur ou API payante n'est nécessaire. Les commandes se font directement par WhatsApp ou par téléphone.

## Lancer le site en local

Ouvrir `index.html` dans un navigateur, ou lancer un serveur local depuis ce dossier :

```powershell
python -m http.server 8080
```

Puis ouvrir http://localhost:8080.

## Modifier le site

- Les numéros de contact et les produits sont définis dans `assets/js/config.js`.
- Les images du site sont dans `assets/img/`.
- Le contenu et les sections sont dans `index.html`.
- Les styles sont dans `assets/css/styles.css` et les interactions dans `assets/js/main.js`.

Les numéros de téléphone doivent être écrits uniquement avec des chiffres et l'indicatif pays. Les commandes WhatsApp ouvrent une conversation avec la vendeuse; le site ne traite pas de paiement.

## Publication

Le site est publié sur GitHub Pages par le workflow `.github/workflows/pages.yml`. Dans les paramètres du dépôt GitHub, choisir **Settings > Pages > Build and deployment > Source: GitHub Actions**.

Le workflow publie directement le dossier `maman-marie/`; aucune commande de build n'est nécessaire. Chaque mise à jour de ce dossier poussée sur `main` déclenche un déploiement. Le site sera disponible à l'adresse `https://lilstone225.github.io/maman-marie/` une fois GitHub Pages activé et le premier déploiement terminé.
