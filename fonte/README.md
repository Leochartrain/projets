# Fonte

Carnet de musculation Android personnel : modèles de séance, saisie des séries, minuteur de repos, records, statistiques et mensurations. Pas de compte, pas de serveur, pas de limite : tout reste sur le téléphone (IndexedDB), avec sauvegarde et restauration en fichier JSON.

Application indépendante, écrite de zéro (code, nom, design, catalogue d'exercices). Elle reprend l'usage d'un carnet de musculation, sans code ni contenu d'une autre app.

## Développement

```powershell
npm install
npm run dev     # http://localhost:5240, ou « lance fonte »
npm test        # logique : volume, records, 1RM, sauvegarde…
node scripts/e2e.mjs http://localhost:5240/ <dossier-captures>   # parcours complet au format téléphone (Edge)
```

## APK

Première fois seulement, dans une fenêtre PowerShell (les licences Android sont à accepter soi-même) :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\installer-outils.ps1
```

Le JDK 21 et le SDK Android vont dans `D:\claude\outils`, sans rien changer au système.

Ensuite :

```powershell
npm run apk                 # crée Fonte.apk (non versionné)
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Install   # compile et installe en USB
```

L'APK est signé avec la clé de débogage de ce PC : les mises à jour s'installent par-dessus tant qu'elles sont compilées ici. Depuis un autre PC, il faudrait désinstaller l'app, ce qui efface ses données : exporter une sauvegarde avant.
