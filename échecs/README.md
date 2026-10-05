# Échecs du Bois

Jeu d'échecs contre des bots, en HTML/JavaScript sans dépendance. Ouvrir `index.html` dans un navigateur.

## Fonctionnalités

- 6 bots de 200 à 1000 Elo, chacun avec un avatar pixel art et une personnalité dans le chat.
- Classement Elo (départ à 400), gains et pertes selon l'Elo du bot, sauvegardé dans le navigateur.
- Toutes les règles : roque, prise en passant, promotion, pat, matériel insuffisant, triple répétition, 50 coups.
- Proposer / accepter la nulle, revanche, reprendre un coup, indice (ces deux derniers rendent la partie amicale).
- Revue des coups, export PGN, sons.

## Code

| Fichier | Rôle |
|---|---|
| `js/chess.js` | Moteur de règles (représentation 0x88), vérifié par des tests perft. |
| `js/ai.js` | IA : évaluation + recherche alpha-bêta ; le niveau dépend de la profondeur, du bruit et des gaffes volontaires. |
| `js/bots.js` | Les bots : niveau, avatars, répliques du chat. |
| `js/app.js` | Interface : échiquier, glisser-déposer, chat, Elo, modales. |
| `style.css` | Thème bois. |

Pour ajouter un bot, ajouter une entrée dans `BOTS` (`js/bots.js`).
