# Boulangerie — site de démonstration

Exemple de site pour une boulangerie, à montrer aux commerçants pendant la prospection : horaires avec l'indication « ouvert / fermé » en temps réel, spécialités, commande de gâteaux en ligne, plan d'accès.

La boulangerie (« Le Fournil du Marché ») est **fictive**. Un bandeau en haut de page le dit toujours, et le site demande à ne pas être référencé par Google.

## Personnaliser pour un prospect

Le nom et la ville se changent dans l'adresse, sans rien recompiler :

```
https://boulangerie-demo.pages.dev/?nom=La%20Caisse%20à%20Pains&ville=La%20Ferté-Bernard
```

Le commerçant voit « son » site. À n'envoyer qu'à la boulangerie concernée : c'est un exemple, pas son vrai site.

## Lancer

```sh
npm install
npm run dev        # http://localhost:4322
npm run build      # version finale dans dist/
```

## Réglages (`src/config.ts`)

- `BOULANGERIE` : nom, ville, adresse et téléphone par défaut, point sur la carte.
- `HOURS` : horaires de la semaine (sert au tableau et à « ouvert maintenant »).
- `AUTHOR` : ton nom et ton contact, affichés dans le bandeau de démonstration.

## Mise en ligne (Cloudflare Pages)

Comme pour Les Ouessants de Croset, un projet Pages de plus sur le même dépôt :
*Project name* `boulangerie-demo`, *Root directory* `boulangerie_demo`, *Build command* `npm run build`, *Output* `dist`, variable `NODE_VERSION` = `22`, *Build watch paths* `boulangerie_demo/*`.

## Photos

Toutes en CC0 (libres, sans attribution obligatoire), trouvées via [Openverse](https://openverse.org) :

| Fichier | Source |
|---|---|
| `pains-artisanaux.jpg` | [rawpixel](https://www.rawpixel.com/image/3282923/free-photo-image-artisanal-bread-baguettes) |
| `baguettes.jpg` | [StockSnap](https://stocksnap.io/photo/bread-baguette-9J9OUZYDZ3) |
| `croissant.jpg` | [rawpixel](https://www.rawpixel.com/image/5911393/image-background-public-domain-food) |
| `eclairs.jpg` | [rawpixel](https://www.rawpixel.com/image/6016700/eclair-free-public-domain-cc0-photo) |
| `etageres-pains.jpg` | [rawpixel](https://www.rawpixel.com/image/3295925/free-photo-image-creative-commons-bread-bookcase) |

Pour un vrai client, les remplacer par des photos de sa boutique et de ses produits : c'est ce qui fait la différence.
