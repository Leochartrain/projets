# Les Ouessants de Croset

Site vitrine de l'association d'éco-pâturage **Les Ouessants de Croset** (moutons d'Ouessant et chèvres des fossés) : une page d'accueil qui présente l'association, le troupeau et l'éco-pâturage, une page contact et les mentions légales.

Site statique fait avec [Astro](https://astro.build) : pas de serveur, pas de base de données, pas de cookie. Prévu pour être hébergé gratuitement sur Cloudflare Pages.

## Lancer

Il faut [Node.js](https://nodejs.org) 22 ou plus.

```sh
npm install
npm run dev        # http://localhost:4321, rechargé à chaque modification
npm run build      # version finale dans dist/
npm run preview    # sert dist/ sur http://localhost:4321
```

## Avant la mise en ligne

Tout ce qui manque s'affiche sur le site en **[à compléter : …]** surligné en jaune.

Tant qu'il manque une information, le site demande à Google et aux autres moteurs de **ne pas le référencer** (balise `noindex` sur toutes les pages). Le blocage se lève tout seul au déploiement suivant, une fois tout rempli. La liste de ce qui manque est `MISSING`, dans `src/config.ts`.

1. **`src/config.ts`** : téléphone, e-mail, secteur, texte de présentation (`about`), adresse du siège, numéro RNA ou SIRET, responsable de la publication, chiffres du troupeau, réseaux sociaux (facultatifs).
2. **Formulaire de contact** : créer une clé gratuite sur [web3forms.com](https://web3forms.com) avec l'e-mail de l'association (250 messages par mois offerts), puis la mettre dans `WEB3FORMS_KEY` (`src/config.ts`). Sans clé, le formulaire invite à écrire par e-mail ou à téléphoner.
3. **Logo** : `src/assets/logo.jpg` ne fait que 150 × 150 px ; le remplacer par l'original.
4. **Adresse du site** : une fois le nom de domaine acheté, la mettre dans `site` (`astro.config.mjs`) ; elle sert aux aperçus de partage sur les réseaux.

## Mettre en ligne (Cloudflare Pages, gratuit)

1. Sur [dash.cloudflare.com](https://dash.cloudflare.com), créer un compte (de préférence au nom de l'association).
2. *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → choisir le dépôt `projets`.
3. Réglages de build :
   - *Root directory* : `ouessants_de_croset`
   - *Build command* : `npm run build`
   - *Build output directory* : `dist`
4. Le site est en ligne sur `https://<nom>.pages.dev`, puis remis à jour à chaque `git push`.
5. Nom de domaine : l'acheter en `.fr` chez un registraire français, au nom de l'association, puis l'ajouter dans *Custom domains*. Cloudflare Email Routing (gratuit) peut faire arriver `contact@…` dans une boîte existante.

## Photos et vidéos

- **Photos** : dans `src/assets/photos/`. Toutes sont de l'association, sauf `belier-brun.jpg` (haut de l'accueil), une photo du domaine public trouvée sur [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Landwirtschaftliches_Hauptfest_Ouessant-Schaf.jpg) et créditée dans les mentions légales. Astro les redimensionne et les convertit en WebP à la compilation : le navigateur ne charge que la taille dont il a besoin. Pour en ajouter une : la déposer dans ce dossier, puis l'importer dans la page comme les autres.
- **Vidéos** : les fichiers d'origine (filmés au téléphone) sont compressés par `npm run videos -- "<dossier des vidéos d'origine>"` dans `public/videos/` (480 px de large, sans son, 1,5 à 3 Mo), avec une image d'attente. La liste est en haut de `scripts/videos.mjs`. Elles ne se lancent que lorsqu'elles sont visibles, et jamais si le visiteur a demandé à réduire les animations.

## Structure

```
src/
├── config.ts              coordonnées et infos de l'association (à compléter)
├── layouts/Base.astro     en-tête, pied de page, balises de partage
├── pages/
│   ├── index.astro        accueil : association, éco-pâturage, troupeau, album
│   ├── contact.astro      formulaire (Web3Forms) et coordonnées
│   ├── mentions-legales.astro
│   └── 404.astro
├── components/            Clip (vidéo en boucle), Todo (info manquante)
├── styles/global.css      couleurs, polices, polaroïds
└── assets/                photos et logo
public/videos/             vidéos compressées
scripts/videos.mjs         compression des vidéos (ffmpeg)
```

Polices (Fraunces, Caveat, Source Sans 3) hébergées avec le site via Fontsource : aucun appel à Google.
