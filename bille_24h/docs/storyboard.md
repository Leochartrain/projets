# Storyboard — teaser 2027

Format vertical 9:16 (Instagram, TikTok, Facebook), 44 s, 120 BPM. Ton : la mise en scène
d'une grande course d'endurance, appliquée à un jeu de billes. Sérieux dans la forme, drôle dans le fond.

Palette : la mascotte du club (voiture orange, billes de couleur) + le sable mouillé + la nuit de course.
Typo : Anton (titres d'affiche), JetBrains Mono (écrans de chronométrage), Inter (textes).

Finition : rendu 60 i/s, 3D temps réel (three.js) avec profondeur de champ et halo, pulsation de l'image
sur chaque temps de la musique, textes qui arrivent avec un flou de mouvement, grain pellicule.

Identité de mouvement (personnalité « énergique ») : trois courbes communes (`courbes` dans `src/theme.ts`) —
arrivée qui se pose en douceur, départ qui accélère, transitions lentes aux bords et fulgurantes au milieu
(flou et étirement calés sur la vitesse). Aucun texte ne met plus d'une demi-seconde à s'écrire. Les objets
ont du poids : les billes tombent avec la gravité, s'écrasent au contact et rebondissent de moins en moins haut,
le plan tremble quand le « 24 » s'écrase.

| # | Scène | Durée | Ce qu'on voit | Son |
|---|---|---|---|---|
| 1 | Ouverture | 6,5 s | **3D** : gros plan d'une bille en verre (réfraction, profondeur de champ) sur le sable, de nuit, travelling lent, autres billes floues au fond. Chrono « SAMEDI · 14:29:57 ». « AU MANS, ILS ONT DES MOTEURS. » À 14:30:00 pile, la bille est tirée vers le fond : flash, secousse, gerbe de grains de sable en 3D. « À SAINT-MARS-DE-LOCQUENAY, ON A DES BILLES. » | Tic du chrono, nappe qui monte, tir |
| 2 | Titre | 4 s | Coupe franche sur fond orange : « 24 HEURES DE LA BILLE » qui s'écrase, bandes de course, 5 billes qui tombent et rebondissent. « 23e ÉDITION ». | Impact, la musique démarre |
| 3 | La piste | 7 s | **3D** : la piste sur ses tables, plan large en grue puis plongée en caméra embarquée derrière la bille (pont Dunlop, voitures des équipages, arrivée en damier), compteur de distance. « 77 MÈTRES DE SABLE MOUILLÉ », « NOUVEAU TRACÉ CHAQUE ANNÉE ». | Balayage, tir |
| 4 | Les chiffres | 6 s | Un chiffre plein écran tous les deux temps, fond de couleur qui balaie : 45 équipages, 135 joueurs, 10 manches, 7 h de tir par joueur. « ET UN SEUL VAINQUEUR. » | Impact sur chaque chiffre |
| 5 | Les photos | 7 s | Quatre vraies photos du club, une par 1,5 s (joueur n°45, joueur n°5, pont Dunlop, vue d'ensemble), zoom lent, cadre de caméra « EN DIRECT », bandeaux façon télé. « SÉRIEUX. MAIS PAS TROP. » | Déclencheur photo |
| 6 | 24 heures | 7 s | Cadran de 24 h : la bille fait le tour de 14h30 à 16h30 le lendemain, le ciel passe du jour à la nuit étoilée puis à l'aube, pins et fanions en silhouette. Les rendez-vous défilent : guinguette, bal, DJ, petit-déj', vide-grenier, banda, finale. « 24 HEURES. ON NE DORT PAS. » | Groove |
| 7 | Les dates | 4 s | Drapeau à damier qui flotte. « 21 · 22 · 23 MAI 2027 », Saint-Mars-de-Locquenay, Val-de-la-Hune. | Respiration puis 3 impacts |
| 8 | Fin | 5 s | La mascotte du club, entourée des cinq billes en **3D** qui font un tour d'honneur sur le sable. « INSCRIPTIONS BIENTÔT OUVERTES », site, #24HBILLE2027, mentions (comité, ACO, vidéo : Léo Chartrain). | Accord final |

## Pistes pour la version finale

- Rushes vidéo réels de l'édition 2026 (tir au ralenti, passage du pont, foule, nuit) à intégrer
  dans la scène 5, voire en fond des scènes 4 et 6.
- Vraie musique libre de droits à 120 BPM.
- Déclinaison 16:9 pour YouTube et l'écran du site.
- Une fois les inscriptions ouvertes : changer le carton final (date limite, lien HelloAsso).
