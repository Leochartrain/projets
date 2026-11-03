# Les recettes de Léo

Site vitrine des recettes de pâtisserie de Léo, pâtissier amateur, ouvert à tous (famille, amis, et n'importe qui via Google). Pas de compte, pas de base de données, pas de cookie. Sans lien avec le Carnet de famille (`../recettes`).

DA inspirée des grandes maisons parisiennes, style « galerie » : fond crème, Cormorant Garamond pour les titres, Jost en petites capitales espacées, une seule couleur d'accent (caramel). Relevé de DA : `D:\claude\prospection\da-patisseries-2026-11\SYNTHESE-DA.md`.

Site statique fait avec [Astro](https://astro.build), prévu pour Cloudflare Pages (gratuit).

## Lancer

Il faut Node.js 22 ou plus.

```sh
npm install
npm run dev        # http://localhost:4324 (ou « lance leo »)
npm run build      # version finale dans dist/
npx astro check    # vérifie les types et le format des recettes
```

## Ajouter une recette

Une recette = un fichier `src/content/recettes/<nom-de-la-recette>.md` (le nom du fichier devient l'adresse : `/recettes/<nom-de-la-recette>`) et sa photo dans `src/assets/recettes/`. Le plus simple : donner la recette à Claude (texte, notes ou photo de la fiche) avec la photo.

Le format est vérifié à la compilation (`src/content.config.ts`). Les points importants :

- **Ingrédients** groupés par préparation. Avec `quantite` (un nombre) + `unite` (`g`, `ml`, `c. à café`… ou rien pour des pièces), la quantité suit le calcul des portions. Avec `texte` (« 1 pincée », « quelques »), elle reste fixe.
- **Étapes** à l'infinitif (« Mélanger… »), sans quantité chiffrée dedans : elles ne seraient pas recalculées.
- `parts` = nombre de parts de la recette de base ; `cercle` = diamètre du moule rond en cm (facultatif), recalculé à hauteur égale.
- `categorie` : une des catégories de `src/config.ts`. Une catégorie sans recette n'apparaît nulle part.
- En YAML, une phrase qui contient « : » doit être entre guillemets.
- **Recette d'un autre pâtissier** (vidéo Instagram, YouTube, livre…) : la créditer avec `source` (`auteur`, `compte`, `plateforme`, `url`). Le site affiche « Recette de … » sous le titre, un lien vers la publication en bas de page, et la liste dans les mentions légales. Réécrire les étapes avec ses propres mots, ne pas reprendre ses photos ni ses vidéos.
- `moule` : moule non rond, affiché tel quel (« Moule à cake de 25 × 8 cm »).
- Photo : celle de Léo de préférence. Sinon une photo libre de droits, avec `photoCredit` (repris dans les mentions légales).

## Référencement

Chaque recette porte une fiche « Recipe » (schema.org) : Google peut afficher la photo, les temps et les ingrédients dans ses résultats. Plan du site : `/sitemap-index.xml`.

**Tant qu'il reste une recette avec `exemple: true`, tout le site est en `noindex`** : Google ne référence pas une version de démonstration. Supprimer la recette d'exemple (ou retirer `exemple: true`) lève le blocage au déploiement suivant.

## Mettre en ligne (Cloudflare Pages)

En ligne depuis le 2026-11-03 : **https://les-recettes-de-leo.pages.dev**. Projet Pages `les-recettes-de-leo` en **envoi direct** (pas relié à GitHub) :

```sh
npm run deploy     # compile puis envoie dist/ avec wrangler
```

Un push ne redéploie donc pas le site : après chaque nouvelle recette, il faut relancer `npm run deploy`. Le site reste en ligne même PC éteint, il est hébergé chez Cloudflare.

`wrangler.toml` (avec `pages_build_output_dir`) est indispensable : sans lui, les wrangler récents convertissent les commandes Pages en Workers.

## Structure

```
src/
├── config.ts                 nom du site, catégories
├── content.config.ts         format d'une recette (vérifié à la compilation)
├── content/recettes/         une recette par fichier .md
├── assets/recettes/          photos (redimensionnées et converties en WebP par Astro)
├── layouts/Base.astro        en-tête, pied de page, balises de partage, noindex
├── components/               CarteRecette, Partage (WhatsApp, SMS, copier le lien)
├── lib/                      tri et formats (recettes.ts), quantités (quantite.ts), recherche (texte.ts)
└── pages/
    ├── index.astro           accueil : dernière recette, la carte, dernières recettes
    ├── recettes.astro        toutes les recettes, recherche et filtres par catégorie
    ├── recettes/[slug].astro page recette : portions, étapes, astuces, fiche Google
    ├── categorie/[slug].astro
    ├── a-propos.astro        (portrait et texte à compléter par Léo)
    ├── mentions-legales.astro
    └── 404.astro
```
