# Pokémon — Route 201

Une route Pokémon jouable dans le navigateur, dans le style de **Pokémon Diamant et Perle** : on part de Bonneville avec son Tiplouf, on explore la Route 201 et on affronte (ou capture) les Pokémon sauvages des hautes herbes.

Fait en TypeScript et canvas 2D avec [Vite](https://vite.dev), sans moteur de jeu. Premier morceau d'un futur jeu Pokémon.

## Lancer

Il faut [Node.js](https://nodejs.org) 20 ou plus, et le pack **Mystic Woods** (voir plus bas).

```sh
npm install     # une seule fois
npm run dev     # puis ouvrir l'adresse affichée (http://localhost:5173)
npm test        # tests des règles de combat
npm run build   # version finale dans dist/
```

## Commandes

| Touche | Action |
|---|---|
| Z Q S D / flèches | Se déplacer (un appui bref : se tourner) |
| Maj (maintenu) | Courir |
| Espace / Entrée / E | Valider, parler, lire un panneau (bouton A) |
| Échap / Retour arrière | Annuler (bouton B) |
| X (ou Échap sur la carte) | Menu : Pokédex, Pokémon, Sac, Sauvegarder |

## Contenu

- **La Route 201**, de Bonneville à Littorella, avec le chemin du Lac Vérité au nord : chemin de terre, hautes herbes, rebords d'où l'on saute, mare, clôture, panneaux et forêt tout autour.
- **Un starter** : Tiplouf niveau 5 (modifiable dans `src/state.ts`, constante `STARTER`).
- **8 vrais Pokémon** : Tiplouf, et 7 espèces sauvages dans les hautes herbes. À l'ouest : Étourmi, Keunotor, Chenipotte. À l'est : Lixy, Crikzik, Rozbouton, et parfois Abra (qui se téléporte !).
- **Combats** avec les règles de la 4e génération : formule de dégâts, STAB, table des 17 types, coups critiques, catégorie physique ou spéciale par attaque, crans de statistiques, précision et esquive, priorité (Vive-Attaque), poison et paralysie, Patience, Roulade, Vole-Vie… 22 capacités avec leurs valeurs de Diamant et Perle.
- **Capture** avec la formule officielle (plus facile quand le Pokémon a peu de PV ou un statut), secousses de la Poké Ball, et le PC quand l'équipe est pleine.
- **Expérience et niveaux** : courbes officielles, partage entre les Pokémon qui ont combattu, panneau des statistiques gagnées, nouvelles capacités (avec le choix de celle à oublier quand il y en a déjà 4).
- **Natures** (les 25, qui modifient les statistiques) et valeurs individuelles tirées au hasard.
- **Menus** : équipe (changer de Pokémon, ordre, résumé), Sac (Potions, Antidotes, Anti-Para, Poké Balls), Pokédex (vus / attrapés, descriptions), sauvegarde dans le navigateur.
- **Maman**, à l'entrée de la route, soigne l'équipe ; si tous tes Pokémon sont K.O., tu te réveilles près d'elle.

Les données (statistiques de base, taux de capture, capacités apprises par niveau, noms français) viennent de [PokeAPI](https://pokeapi.co), avec les valeurs d'époque de Diamant et Perle quand elles ont changé depuis.

## Graphismes

- **Décors et héros** : pack [Mystic Woods](https://game-endeavor.itch.io/mystic-woods) de Game Endeavor. Sa licence interdit de redistribuer les sprites : ils ne sont pas dans ce dépôt. `npm run dev` les copie automatiquement depuis `../mystic_woods/sprites/` (le dossier du pack, voir [mystic_woods/README.md](../mystic_woods/README.md)) vers `public/assets/mystic/`, ignoré par git.
- **Hautes herbes, interface et décor de combat** : dessinés par le code, dans le style de Diamant et Perle.
- **Pokémon** : les sprites de Diamant et Perle (face et dos) sont chargés au lancement depuis le dépôt de sprites de PokeAPI ; ils ne sont pas copiés ici. Sans connexion, une silhouette avec le nom les remplace.

Pokémon et les noms des Pokémon appartiennent à Nintendo, Game Freak et The Pokémon Company. Ceci est un projet de fan, non commercial.

## Structure

```
src/
├── main.ts          démarrage, mise à l'échelle de l'écran (256 × 192, comme une DS)
├── game.ts          boucle et pile d'écrans
├── state.ts         équipe, Sac, Pokédex, position ; sauvegarde
├── core/            touches, sprites, bruitages, tirages aléatoires
├── data/            types, capacités, espèces, natures, objets, rencontres
├── battle/          Pokémon (statistiques, expérience), formules et moteur de combat (+ tests)
├── world/           carte de la route et son rendu
├── scenes/          titre, carte, combat, équipe, résumé, Sac, Pokédex, menu
└── ui/              fenêtres, texte, boîte de dialogue, menus
```

Le moteur de combat (`src/battle/battle.ts`) ne dessine rien : chaque tour renvoie une liste d'événements (textes, barres de PV, K.O., Poké Ball…) que l'écran de combat anime ensuite. C'est ce qui permet de le tester (`npm test`, avec le lanceur de tests intégré à Node).
