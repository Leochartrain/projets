# Sillon

Lecteur de musique local pour une bibliothèque FLAC, sans compte, sans serveur, sans abonnement.

- **Ordinateur (Windows)** : Tauri 2, moteur audio en Rust (Symphonia + cpal), base SQLite.
- **Téléphone** : la même interface en application web installable (PWA), voir plus bas.

## Ordinateur

```sh
npm install
npm run tauri dev      # développement (port 5260)
npm run tauri build    # installateur Windows : src-tauri/target/release/bundle/nsis/Sillon_x.y.z_x64-setup.exe
```

L'installateur s'installe sans droits administrateur (dans le profil de l'utilisateur), crée un raccourci
dans le menu Démarrer et sur le bureau. Au premier lancement, le dossier **Musique** de Windows est ajouté
à la bibliothèque (on peut le retirer et en ajouter d'autres dans Réglages).

La compilation Rust utilise la chaîne GNU (`stable-x86_64-pc-windows-gnu`).

## Téléphone
Voir [`mobile/README.md`](mobile/README.md).
