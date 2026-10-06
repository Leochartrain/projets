# Carnet de famille (nom provisoire)

Application web (installable sur téléphone) pour sauver les recettes de famille et les partager entre proches, dans des groupes privés : « Famille Richard », « Les potes du lycée »…

Fiche projet et maquettes : voir les liens partagés dans la conversation de cadrage.

## Lancer

Il faut [Node.js](https://nodejs.org) 20 ou plus et un projet [Supabase](https://supabase.com) (offre gratuite).

```sh
npm install
cp .env.example .env.local   # puis remplir l'adresse et la clé du projet Supabase
npm run dev                  # http://localhost:5173
```

Sans `.env.local`, l'appli affiche comment la configurer.

### Base de données

Le schéma, les règles d'accès et le stockage des photos sont dans `supabase/migrations/`. Pour les envoyer au projet Supabase :

```sh
npx supabase login           # une seule fois (ouvre le navigateur)
npx supabase link            # choisir le projet
npm run db:push              # applique les migrations
npm run db:types             # régénère src/lib/database.types.ts
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification des types puis version finale dans `dist/` |
| `npm test` | Tests (règles d'accès de la base dans PGlite, lecture des ingrédients, formulaire) |
| `npm run typecheck` | Vérification des types seule |

## Technique

- **React 19**, **TypeScript**, **Vite 8**, **Tailwind CSS 4** (couleurs et polices des maquettes, mode sombre automatique).
- **React Router 8** : les écrans sont chargés à la demande, seul l'accueil est dans le paquet principal.
- **TanStack Query** : cache des données, favoris mis à jour sans attendre le serveur, recherche qui garde la liste pendant la frappe.
- **Supabase** (hébergé en Europe) : comptes, base Postgres, stockage des photos.
- **Zod (mini)** pour la validation des formulaires.

### Sécurité : tout est vérifié par la base

Les règles d'accès (Row Level Security) sont dans la migration et testées (`tests/db.test.ts`) :

- une recette n'est visible que par son auteur, et par les membres des groupes où il la partage ;
- seul l'auteur modifie, supprime ou partage sa recette ;
- on ne rejoint un groupe qu'avec un code d'invitation valable (7 jours), créé par un administrateur ;
- avis et commentaires ne sont visibles que dans leur groupe ;
- les photos sont privées, rangées par auteur et par recette, visibles avec la recette ;
- supprimer son compte efface ses données en cascade.

Les tests jouent les migrations dans [PGlite](https://pglite.dev) (Postgres en WebAssembly) avec une imitation minimale de Supabase (`tests/supabase-stub.sql`) : pas besoin de Docker.

### Structure

```
src/
├── main.tsx, router.tsx    démarrage et écrans
├── components/             interface commune (boutons, champs, mise en page, icônes)
├── features/
│   ├── auth/               connexion, inscription, protection des écrans
│   ├── groups/             groupes, invitations, rejoindre
│   ├── recipes/            accueil, recette, éditeur, photos, mode cuisine, favoris
│   ├── reviews/            notes et commentaires
│   └── profile/            profil, suppression du compte
└── lib/                    Supabase, types de la base, ingrédients, photos, formats
supabase/migrations/        schéma et règles d'accès
tests/                      tests (node --test)
```

## Où on en est (V1)

Fait : comptes, groupes et invitations, recettes (brouillons privés, partage par groupe, photos du plat et de la fiche d'origine), recherche, favoris, notes et commentaires, mode cuisine, suppression du compte.

À venir : le scan des fiches manuscrites par IA, puis l'essai en famille.

Comptes : e-mail (mot de passe ou lien) et Google (à activer dans Supabase, puis `VITE_AUTH_GOOGLE=1`). « Se connecter avec Apple » demande un compte développeur Apple payant : il sera ajouté avec la publication sur l'App Store.
