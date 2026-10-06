// Copie les sprites Mystic Woods utilisés par le jeu depuis ../mystic_woods/sprites
// vers public/assets/mystic/. Ils ne sont pas dans le dépôt : leur licence en
// interdit la redistribution (voir le README).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, '..', 'mystic_woods', 'sprites');
const target = join(root, 'public', 'assets', 'mystic');

const FILES = [
  'characters/player.png',
  'objects/objects.png',
  'tilesets/grass.png',
  'tilesets/plains.png',
  'tilesets/decor_16x16.png',
  'tilesets/fences.png',
  'tilesets/water1.png',
];

const missing = FILES.filter((file) => !existsSync(join(source, file)));
if (missing.length > 0) {
  if (FILES.every((file) => existsSync(join(target, file)))) process.exit(0);
  console.error(`Sprites Mystic Woods introuvables dans ${source} :\n  ${missing.join('\n  ')}`);
  console.error("Télécharge le pack (https://game-endeavor.itch.io/mystic-woods) et copie son dossier sprites/ dans mystic_woods/.");
  process.exit(1);
}
for (const file of FILES) {
  mkdirSync(dirname(join(target, file)), { recursive: true });
  copyFileSync(join(source, file), join(target, file));
}
console.log(`${FILES.length} sprites Mystic Woods copiés dans public/assets/mystic/`);
