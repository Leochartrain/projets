# Repair Café

Appli web de gestion d'un Repair Café : séances, prise de rendez-vous en ligne, accueil des visiteurs, suivi des réparations à l'atelier et statistiques.

Premier jet fonctionnel (PMV), pensé pour une petite équipe de bénévoles sur un ordinateur ou une tablette à l'accueil.

## Lancer

Il faut [Node.js](https://nodejs.org) 22.18 ou plus (pour SQLite et TypeScript intégrés).

```sh
npm install     # une seule fois
npm run dev     # puis ouvrir http://localhost:5180
```

Au premier lancement, la base `data/repair-cafe.db` est créée avec des données d'exemple : 7 bénévoles, 16 visiteurs, 3 séances passées, une séance aujourd'hui en cours et 2 à venir.

| Commande | Rôle |
|---|---|
| `npm run dev` | API (port 3001) et interface (port 5180), rechargées à chaque modification |
| `npm test` | Tests de l'API (créneaux, parcours d'une réparation, réservation, RGPD) |
| `npm run build` puis `npm start` | Version finale : tout sur http://localhost:3001 |
| `npm run db:demo` | Remet les données d'exemple (serveur arrêté) |
| `npm run db:vide` | Vide la base pour un vrai démarrage (serveur arrêté) |

## Ce que fait l'appli

**Tableau de bord** : séance du jour ou prochaine séance, objets réparés et taux de réussite, kilos de déchets évités, visiteurs, participations libres, résultats par catégorie, dernières réparations.

**Séances** : les permanences (date, horaires, lieu), découpées en créneaux (30 min par défaut) avec un nombre de rendez-vous par créneau (en gros, le nombre de réparateurs).

**Le jour J** (page d'une séance), l'écran de l'accueil :
- à gauche le planning : on pointe les arrivées (« Arrivé », « Absent ») et on ajoute des rendez-vous ;
- à droite l'atelier : file d'attente (avec le temps d'attente), réparations en cours (avec le réparateur), terminées ;
- « Passage sans rendez-vous » pour les visiteurs qui viennent sans réserver : on cherche la personne (elle est peut-être déjà venue) ou on crée sa fiche ;
- « Prendre en charge » propose d'abord les bénévoles qui ont la compétence ;
- « Terminer » enregistre le résultat, le diagnostic, le poids et la participation.
- La page se met à jour toute seule toutes les 15 secondes, pour plusieurs postes à l'accueil.

**Réservation en ligne** (`/reserver`, page publique sans le menu) : choix de la séance et du créneau (les créneaux pleins sont barrés), description de l'objet, coordonnées, acceptation de la charte. Un visiteur déjà connu (même e-mail ou même téléphone) est retrouvé, sans créer de doublon.

**Réparations** : toutes les fiches, avec recherche et filtres (étape, catégorie, résultat), et export CSV (point-virgule, s'ouvre directement dans Excel).

**Adhésion annuelle** : obligatoire pour faire réparer un objet, valable pour l'année civile. Tarif réduit (8 € par défaut) pour les habitants de certaines communes, tarif normal (50 €) pour les autres ; il y a aussi « Offerte ». Les montants et la liste des communes se règlent dans **Réglages** (la liste des données d'exemple est fictive). Le tarif est proposé d'après la commune du visiteur et reste modifiable.
- À la création d'un visiteur (accueil ou page Visiteurs) : on encaisse l'adhésion dans la foulée, ou on la laisse « à régler ».
- À l'accueil, une pastille « Adhésion à régler » signale les visiteurs qui ne l'ont pas encore payée cette année, et « Prendre en charge » propose de l'encaisser avant de commencer.
- Sur la page de réservation, les tarifs sont affichés (avec celui qui correspond à la commune saisie) ; l'adhésion se règle sur place.
- Tableau de bord : nombre d'adhérents et montant des adhésions de l'année.

**Visiteurs** : fiche (avec la commune), adhésion de l'année et historique, objets apportés, charte signée ou non. Le bouton « Effacer ses données » applique le droit à l'effacement (RGPD) : nom et coordonnées supprimés, réparations gardées anonymement pour les statistiques.

**Bénévoles** : coordonnées, spécialités, actif ou non, nombre d'interventions et d'objets réparés.

### Le parcours d'un objet

```
Rendez-vous ─┬─ Arrivé (en attente) ── En réparation ── Terminé : Réparé / À poursuivre / Non réparable / Conseil donné
             ├─ Absent
             └─ Annulé
Passage sans rendez-vous ── Arrivé (en attente) ── …
```

Chaque étape est horodatée. Les résultats et les champs (catégorie, marque, modèle, âge, panne, diagnostic) reprennent ceux de la fiche Repair Monitor de la fondation Repair Café. Les déchets évités comptent le poids pesé, ou à défaut une moyenne par catégorie (`shared/domain.ts`).

## Technique

- **Interface** : React 19, React Router, TanStack Query, Tailwind CSS 4, Vite.
- **Serveur** : [Hono](https://hono.dev) sur Node.js, base **SQLite** intégrée à Node (`node:sqlite`), validation avec Zod. Node exécute le TypeScript directement, sans compilation.
- `shared/domain.ts` : vocabulaire commun (catégories, étapes, résultats, charte) et types des réponses de l'API.

```
server/
├── index.ts     démarrage (API + interface compilée)
├── app.ts       routes de l'API (/api/…)
├── db.ts        schéma SQLite
├── seed.ts      données d'exemple
└── reset.ts     db:demo et db:vide
shared/domain.ts
src/
├── pages/       un fichier par écran
├── components/  interface commune, formulaires, fenêtres de l'atelier
└── api.ts       appels à l'API
tests/api.test.ts
```

## Pas encore fait

- **Connexion de l'équipe** : pour l'instant, quiconque accède à l'adresse voit tout. À ajouter avant de mettre l'appli en ligne (un mot de passe partagé suffirait pour commencer).
- E-mails de confirmation et de rappel la veille du rendez-vous.
- Annulation d'un rendez-vous par le visiteur lui-même (lien dans l'e-mail).
- Envoi automatique au Repair Monitor (l'export CSV permet de le faire à la main).
