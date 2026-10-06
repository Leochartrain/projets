# Projets

Mes petits projets, un dossier par projet.

| Projet | Description | Lancer |
|---|---|---|
| [Mystic Woods](mystic_woods/) | Action-RPG pixel art en vue de dessus : vagues de monstres, épée, AK-47, minimap. | `mystic_woods/game/index.html` (sprites à ajouter, voir le README) |
| [Échecs du Bois](échecs/) | Échecs contre 6 bots (Elo 200 à 1000) avec chat, classement Elo, nulle, revanche. | `échecs/index.html` |
| [FPS1](FPS1/) | FPS inspiré de CS: Source, en Three.js + TypeScript, avec un 1 contre 1 en ligne. | `npm install` puis `npm run dev` dans `FPS1/` |
| [Pokémon — Route 201](pokemon/) | Une route Pokémon façon Diamant et Perle : hautes herbes, 8 vrais Pokémon, combats et captures. | `npm install` puis `npm run dev` dans `pokemon/` (sprites Mystic Woods requis) |

Les projets sont en HTML/JavaScript sans dépendance : il suffit d'ouvrir le fichier `index.html` dans un navigateur. Exceptions : FPS1 et Pokémon, qui demandent Node.js (voir leur README).

## Ajouter un nouveau projet

1. Créer un dossier à la racine (`mon_projet/`) avec un `README.md`.
2. L'ajouter au tableau ci-dessus.
3. Commiter :

```sh
git add mon_projet README.md
git commit -m "Ajoute mon_projet"
git push
```
