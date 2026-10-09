# Le Refuge

Jeu de gestion dans le navigateur, entre **Clash of Clans** et **Zoo Tycoon** : on agrandit un refuge pour animaux, on construit et améliore des bâtiments, on élève des animaux et on les fait se reproduire pour découvrir des pelages rares.

Vue isométrique, graphismes cartoon entièrement dessinés par le code (aucune image à télécharger). Fait avec [Phaser 4](https://phaser.io), TypeScript et [Vite](https://vite.dev).

## Lancer

Il faut [Node.js](https://nodejs.org) 22 ou plus.

```sh
npm install     # une seule fois
npm run dev     # puis ouvrir http://localhost:5190
npm test        # tests des règles (production, chantiers, génétique, reproduction)
npm run build   # version finale dans dist/
```

## Comment on joue

- **Glisser** pour se déplacer, **molette** ou **pincer** pour zoomer, **toucher** un bâtiment pour le sélectionner.
- **Boutique** (en bas à droite) : construire. Le bâtiment suit la souris ; on touche la carte pour le poser (vert = libre, rouge = occupé). **Échap** annule.
- Chaque chantier occupe un **bâtisseur**. Les **gemmes** terminent un chantier tout de suite (une par minute restante). On en trouve en retirant les sapins, buissons et rochers.
- La **ferme** produit la nourriture, la **billetterie** produit l'or. Quand une bulle apparaît au-dessus, on touche le bâtiment pour récolter. Les réserves sont limitées par le niveau de la **mairie**.
- Les **animaux** vivent dans des **enclos** (une espèce par enclos). Ils mangent de la nourriture et attirent des visiteurs, qui paient à la billetterie. Affamés, ils en attirent moitié moins.
- Les **décorations** près d'un enclos (2 cases ou moins) rendent ses animaux plus heureux, et ils rapportent plus.
- La partie est sauvegardée dans le navigateur, et le refuge **continue de tourner quand le jeu est fermé**.

## Génétique

Chaque animal a deux gènes, avec un allèle de chaque parent :

| Gène | Allèles, du plus dominant au plus récessif |
|---|---|
| Couleur | **G** doré › **N** normal › **v** variante (noir, argenté…) › **a** albinos |
| Motif | **T** tacheté › **t** uni |

Deux parents « normaux » porteurs (Na × Na) ont un quart de petits albinos. Le doré n'apparaît que par **mutation** (2 % par allèle transmis). Plus un pelage est rare, plus l'animal attire de visiteurs (doré : ×5). Le **bestiaire** recense les 48 variantes.

## Code

| Dossier | Rôle |
|---|---|
| `src/game/` | Les règles, sans affichage : `config.ts` (tout l'équilibrage), `sim.ts` (temps, production, actions), `genetics.ts`, `state.ts`, `store.ts` (partie en cours + sauvegarde). Testées avec `node --test`. |
| `src/art/` | Les dessins au canvas : outils isométriques, bâtiments selon leur niveau, animaux, sol. |
| `src/scene/` | La scène Phaser : carte, caméra, sélection, placement, animaux qui se promènent. |
| `src/ui/` | L'interface HTML par-dessus le jeu : ressources, boutique, enclos, bestiaire. |
| `src/app/bus.ts` | Les messages entre l'interface et la scène. |

Les durées sont volontairement courtes (quelques secondes à une heure) pendant le développement : on les règle dans `src/game/config.ts`.

En développement, `window.refuge` donne accès à la partie depuis la console (`refuge.store.state`, `refuge.sim`).
