# Les collations de Maman Marie

Site statique (HTML/CSS/JS natif). Aucun build requis.

## Lancer
Ouvrir `index.html`, ou : `python3 -m http.server 8080` puis http://localhost:8080

## À renseigner (`assets/js/config.js`)
- `phoneCall`, `phoneWhatsapp` : chiffres uniquement avec indicatif (ex. `225XXXXXXXXXX`). Tant qu'ils sont vides/invalides, les boutons sont désactivés et un message s'affiche.
- `price` (nombre en FCFA), `unit` (ex. "sachet") et `image` (ex. `assets/img/cracky.jpg`, ratio 4:3) par produit. Sans prix : « Prix sur demande ».

## Publication
Déposer le dossier tel quel sur tout hébergement statique (Netlify, Vercel, Cloudflare Pages, o2switch…). Polices chargées via Google Fonts.
