# Salon de coiffure — site de démonstration

Exemple de site pour un salon de coiffure, à montrer pendant la prospection : « ouvert / fermé » en temps réel, prestations, tarifs, **prise de rendez-vous en ligne** (prestation, coiffeur, jour, créneaux libres), horaires et plan d'accès.

Le salon (« Votre Salon » par défaut) est **fictif**. Un bandeau en haut de page le dit toujours, et le site demande à ne pas être référencé par Google. La réservation est une démonstration : rien n'est envoyé, les créneaux « pris » sont tirés au hasard (toujours les mêmes pour un jour et une heure).

## Personnaliser pour un prospect

Le nom et la ville se changent dans l'adresse, sans rien recompiler :

```
https://coiffure-demo.pages.dev/?nom=Nom%20du%20salon&ville=Sa%20ville
```

L'outil de prospection affiche ce lien (bouton « Site d'exemple personnalisé ») sur les fiches du secteur Coiffure.

## Lancer

```sh
npm install
npm run dev        # http://localhost:4323
npm run build      # version finale dans dist/
```

## Réglages (`src/config.ts`)

- `SALON` : nom, ville, adresse et téléphone par défaut, point sur la carte.
- `HOURS` : horaires de la semaine (tableau, « ouvert maintenant » et créneaux de rendez-vous).
- `PRESTATIONS` : tarifs par catégorie, avec la durée (sert aux créneaux).
- `TEAM` : prénoms proposés au moment de réserver.
- `AUTHOR` : ton nom et ton contact, affichés dans le bandeau de démonstration.

## Mise en ligne (Cloudflare Pages)

Projet Pages `coiffure-demo` (en ligne depuis le 2026-10-19), en **envoi direct** (pas relié à GitHub) : `npm run deploy` (compile puis envoie `dist/` avec wrangler). Un push ne le redéploie donc pas. Le site reste en ligne PC éteint : il est hébergé chez Cloudflare.

`wrangler.toml` (avec `pages_build_output_dir`) est indispensable : sans lui, les wrangler récents « convertissent » les commandes Pages en Workers et ajoutent un adaptateur Cloudflare au projet.

## Photos

Toutes en CC0 (libres, sans attribution obligatoire), trouvées via [Openverse](https://openverse.org), converties en JPEG sans métadonnées :

| Fichier | Source |
|---|---|
| `salon-fauteuils.jpg` | [rawpixel](https://www.rawpixel.com/image/6023213/photo-image-public-domain-plant-house) |
| `coupe-femme.jpg` | [rawpixel](https://www.rawpixel.com/image/5924894/photo-image-public-domain-person-woman) |
| `coupe-homme.jpg` | [rawpixel](https://www.rawpixel.com/image/5923938/photo-image-public-domain-black-person) |
| `brushing.jpg` | [rawpixel](https://www.rawpixel.com/image/5907502/image-public-domain-woman-beauty) |
| `chignon.jpg` | [rawpixel](https://www.rawpixel.com/image/5924738/photo-image-public-domain-wedding-beauty) |
| `comptoir.jpg` | [rawpixel](https://www.rawpixel.com/image/5919224/hair-salon-free-public-domain-cc0-photo) |

Pour un vrai client, les remplacer par des photos de son salon et de son équipe : c'est ce qui fait la différence.
