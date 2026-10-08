# Projets

Mes petits projets, un dossier par projet.

| Projet | Description | Lancer |
|---|---|---|
| [Mystic Woods](mystic_woods/) | Action-RPG pixel art en vue de dessus : vagues de monstres, épée, AK-47, minimap. | `mystic_woods/game/index.html` (sprites à ajouter, voir le README) |
| [Échecs du Bois](échecs/) | Échecs contre 6 bots (Elo 200 à 1000) avec chat, classement Elo, nulle, revanche. | `échecs/index.html` |
| [FPS1](FPS1/) | FPS inspiré de CS: Source, en Three.js + TypeScript, avec un 1 contre 1 en ligne. | `npm install` puis `npm run dev` dans `FPS1/` |
| [Pokémon — Route 201](pokemon/) | Une route Pokémon façon Diamant et Perle : hautes herbes, 8 vrais Pokémon, combats et captures. | `npm install` puis `npm run dev` dans `pokemon/` (sprites Mystic Woods requis) |
| [Carnet de famille](recettes/) | Recettes de famille partagées en groupes privés (React, Supabase), en cours. | `npm install` puis `npm run dev` dans `recettes/` (projet Supabase requis) |
| [Repair Café](repair_cafe/) | Gestion d'un Repair Café : séances, rendez-vous en ligne, accueil, suivi des réparations, statistiques (React, Hono, SQLite). | `npm install` puis `npm run dev` dans `repair_cafe/` |
| [Les Ouessants de Croset](ouessants_de_croset/) | Site vitrine d'une association d'éco-pâturage (moutons d'Ouessant, chèvres des fossés), en Astro. | `npm install` puis `npm run dev` dans `ouessants_de_croset/` |

Les projets sont en HTML/JavaScript sans dépendance : il suffit d'ouvrir le fichier `index.html` dans un navigateur. Exceptions : FPS1, Pokémon, Carnet de famille, Repair Café et Les Ouessants de Croset, qui demandent Node.js (voir leur README).

## Ajouter un nouveau projet

1. Créer un dossier à la racine (`mon_projet/`) avec un `README.md`.
2. L'ajouter au tableau ci-dessus.
3. Commiter :

```sh
git add mon_projet README.md
git commit -m "Ajoute mon_projet"
git push
```
