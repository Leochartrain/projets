# 24 Heures de la Bille — teaser vidéo

Teaser en motion design (vertical 1080×1920, 30 i/s, ~44 s) pour la 23e édition des
**24 Heures de la Bille** (21-23 mai 2027, Saint-Mars-de-Locquenay, Val-de-la-Hune, Sarthe),
organisées par le Comité des Fêtes. Réalisé gratuitement par Léo Chartrain pour se faire connaître.

Fait avec [Remotion](https://www.remotion.dev) : chaque image est du React, tout est animé par le code.

## Commandes

```bash
npm install
npm run dev        # Remotion Studio sur http://localhost:5210 (ou « lance bille »)
npm run sons       # régénère la musique et les bruitages (public/sons)
npm run render     # rend out/teaser-vertical.mp4 (qualité maximale, ~85 Mo, ~6 min)
node scripts/apercus.mjs 30 230 560   # images fixes dans out/apercus pour vérifier un cadrage
```

Version légère pour les réseaux (~25 Mo) :

```bash
npx remotion ffmpeg -i out/teaser-vertical.mp4 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k out/teaser-vertical-reseaux.mp4
```

## Photos et logo du club (non versionnés)

`public/club/` est ignoré par git : ce sont les images du Comité des Fêtes, prises sur
[24heuresdelabille-sarthe.com](https://www.24heuresdelabille-sarthe.com/). Fichiers attendus :
`joueur-45.jpg`, `pont-dunlop.jpg`, `vue-ensemble.jpg`, `logo.png` (la mascotte voiture orange).
Pour la version finale, demander au comité les originaux en haute définition et des rushes vidéo.

## Organisation

- `src/montage.json` : ordre, durée et transitions des scènes (lu aussi par `scripts/sons.mjs`
  pour caler la musique).
- `src/scenes/` : les 8 scènes (voir `docs/storyboard.md`).
- `src/components/` : bille en verre, sable, damier, voiture miniature, texte animé, grain pellicule.
- `src/transitions.tsx` : transitions maison (damier, balayage).
- Montage calé sur 120 BPM : un temps = 15 images (`TEMPS` dans `src/theme.ts`).

## Musique

La musique de `public/sons/musique.wav` est **synthétisée par le script** (provisoire, libre de droits).
Pour la version finale, la remplacer par un vrai morceau à 120 BPM libre de droits
(YouTube Audio Library, Pixabay Music…) en gardant le même nom de fichier, et caler le
premier temps fort sur 6,5 s (apparition du titre).

## Mentions

La marque « 24 Heures » appartient à l'Automobile Club de l'Ouest ; le comité l'utilise avec son
autorisation, d'où la mention en fin de vidéo. Ne pas utiliser les logos des 24 Heures du Mans.
