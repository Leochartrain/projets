# Sillon sur téléphone

La version téléphone est **la même interface** que l'application de bureau, compilée en application web
installable (PWA). Elle marche sur Android (Chrome) et iPhone (Safari).

## Comment ça marche

- Les modules Tauri (`@tauri-apps/*`) sont remplacés à la compilation par `src/web/shims/`
  (voir `vite.mobile.config.ts`). L'interface ne change pas : elle croit parler au cœur Rust.
- `src/web/backend.ts` répond aux mêmes commandes que le cœur Rust, avec IndexedDB (`src/web/idb.ts`).
- `src/web/engine.ts` : moteur audio web (deux lecteurs HTML5 pour le fondu enchaîné, égaliseur 10 bandes,
  limiteur, visualiseur), mêmes événements que le moteur Rust.
- `src/web/importer.ts` : les morceaux choisis sont **copiés dans l'application** (tags et pochettes lus avec
  `music-metadata`). Ils restent lisibles sans réseau. Rien n'est envoyé nulle part.
- Écran de verrouillage et écouteurs Bluetooth : API Media Session (titre, pochette, lecture/pause, suivant).
- Hors ligne : `mobile/public/sw.js` met toute l'application en cache.
- Mise en page téléphone (écran < 760 px) : barre d'onglets, mini-lecteur, écran de lecture en une colonne
  (`src/components/MobileNav.tsx`, `src/lib/compact.ts`).

Différences avec le bureau : pas de surveillance de dossiers (on importe des fichiers), pas d'analyse audio
(BPM, énergie : les mix « Calme / Énergie » ont donc moins de matière), les modifications de tags restent dans
l'application (les fichiers d'origine ne sont pas réécrits), pas de choix de sortie audio ni de mini-lecteur.

## Commandes

```sh
npm run dev:mobile      # développement, http://localhost:5261 (et sur le réseau local)
npm run build:mobile    # compile dans dist-mobile/
npm run deploy:mobile   # compile et met en ligne sur Cloudflare Pages (projet sillon-musique)
```

## Installer sur le téléphone

1. Ouvrir l'adresse du site en ligne dans Chrome (Android) ou Safari (iPhone).
2. Android : menu ⋮ → **Ajouter à l'écran d'accueil** → Installer. iPhone : bouton Partager →
   **Sur l'écran d'accueil**.
3. Ouvrir Sillon depuis l'icône, puis **Importer des morceaux** et choisir ses fichiers.

Le site ne contient aucune musique et n'est pas référencé (noindex) : chaque téléphone a sa propre bibliothèque.
