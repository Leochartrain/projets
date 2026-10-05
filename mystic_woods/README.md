# Mystic Woods

Petit action-RPG en vue de dessus (PMV), en HTML/JavaScript sans dépendance.

Survis à 3 vagues de slimes et de squelettes, puis ouvre le coffre de la clairière.

## Commandes

| Touche | Action |
|---|---|
| ZQSD / flèches | Se déplacer |
| Souris | Viser |
| Clic gauche / Espace | Attaquer à l'épée ou tirer (maintenu) |
| 1 / 2 / Tab | Épée / AK-47 |
| E | Ouvrir le coffre |
| R | Recommencer |

## Sprites (non inclus)

Les graphismes viennent du pack **Mystic Woods** de Game Endeavor :
https://game-endeavor.itch.io/mystic-woods

Sa licence interdit de redistribuer les sprites, ils ne sont donc pas dans ce repo.
Pour jouer :

1. Télécharger le pack (version 2.2) depuis itch.io.
2. Copier son dossier `sprites/` dans `mystic_woods/`, à côté de `game/` :

```
mystic_woods/
  game/
    index.html
    game.js
  sprites/
    characters/  objects/  particles/  tilesets/
```

3. Ouvrir `game/index.html` dans un navigateur.

La version gratuite du pack fonctionne aussi, mais ses sprites portent un filigrane « Premium Version! ».

## Code

- `game/game.js` : tout le jeu (carte, joueur, monstres, vagues, rendu, minimap).
- Les réglages (vitesse, vagues, cadence de tir…) sont en haut du fichier.
