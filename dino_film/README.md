# Crétacé — film de 15 s généré par le code

Une scène de dinosaures de 15 secondes (6 plans, cadre 2.39:1, 30 i/s) dont **tout** est produit par le code :
terrain, rivière, végétation, dinosaures, animations, lumière, caméra et bande-son. Aucune image, vidéo ni son préexistant.

## Lancer

```
npm install          # playwright-core + ffmpeg-static (une fois)
npm run dev          # http://localhost:5250 : lecture en temps réel, avec le son
npm run stills       # out/stills/plan1…6.png : une image par plan, pour validation
npm run render       # out/dinosaures.mp4 : 450 images + bande-son (H.264, AAC 48 kHz)
```

Options de `render.mjs` : `--samples=8` (sous-images par image), `--t=9.3,11` (images isolées),
`--audio` (bande-son seule + niveaux), `--from=0 --to=450`, `--headed`.

Le rendu passe par Microsoft Edge sans interface (moteur Chromium, piloté par Playwright) : il utilise la carte graphique.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de lecture (Three.js 0.170.0 épinglé, chargé depuis jsDelivr) |
| `src/main.js` | Construction du monde, lecture temps réel, interface du rendu image par image |
| `src/world.js` | Ciel, brume de vallée, soleil et ombres, terrain érodé, rivière, rochers, boue du gros plan |
| `src/flora.js` | Fougères arborescentes, fougères, cycas, conifères, prêles : textures dessinées, instances, vent |
| `src/creature.js` | Squelette, peau lissée sur profils, shader d'écailles, marche à pieds ancrés, cou par CCD |
| `src/species.js` | Les trois espèces : théropode, cératopsien (jeune et adultes), sauropode |
| `src/fx.js` | Particules : brume, pollen, vapeur, éclaboussures, terre, feuilles |
| `src/post.js` | Profondeur de champ anamorphique, flou de mouvement, rayons, flare, ACES, étalonnage, grain |
| `src/shots.js` | Les 6 plans : caméra, jeu des animaux, instants clés partagés avec le son |
| `src/audio.js` | Bande-son synthétisée (ambiance, orchestre, bruitages), calée sur les appuis précalculés |
| `render.mjs` | Rendu déterministe (1/30 s par image) et assemblage ffmpeg |

## Principe du rendu déterministe

Chaque instant du film est une fonction pure du temps : aucune simulation ne garde d'état d'une image à l'autre.
Les appuis des pattes sont précalculés au chargement ; ils déclenchent à la fois les éclaboussures et les sons,
ce qui garantit la synchro. Chaque image finale est la moyenne de 8 sous-images réparties sur un obturateur à 180°
(flou de mouvement réel et anticrénelage).

## Compromis assumés

- Dinosaures modélisés par profils lissés : silhouettes crédibles, pas le niveau d'un film d'effets spéciaux.
- Diffusion sous la peau simulée (enveloppement de la lumière, liseré à contre-jour, translucidité de la collerette).
- Eau : reflet plan réel et transparence selon la profondeur ; pas de réfraction en espace écran.
- Érosion : éboulement thermique + bruit en crêtes, pas de simulation hydraulique.
- Rayons de lumière : flou radial à l'écran + brume analytique, pas de volumétrie par lancer de rayons.
- Feuillages : rubans texturés (textures dessinées par le code), pas de feuilles en géométrie.
