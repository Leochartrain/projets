// Compresse les vidéos de l'association pour le web et en tire une image d'attente.
// Usage : npm run videos -- "<dossier des vidéos d'origine>"
// Chaque vidéo listée dans VIDEOS devient public/videos/<nom>.mp4 (sans son, 1,5 à 3 Mo)
// et public/videos/<nom>.jpg (image affichée avant la lecture).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const VIDEOS = {
  'descente-remorque': '70df9db8-a398-492c-a7bd-17b37f344658.mp4',
  'belier-parc-urbain': '87ffe2d9-d66f-41a0-990f-365a17401f38.mp4',
};

const source = process.argv[2];
if (!source) {
  console.error('Indique le dossier des vidéos : npm run videos -- "D:\\…\\IMAGES POUR SITE WEB"');
  process.exit(1);
}
const out = join(import.meta.dirname, '..', 'public', 'videos');
mkdirSync(out, { recursive: true });

for (const [name, file] of Object.entries(VIDEOS)) {
  const input = join(source, file);
  // 480 px de large (vidéos verticales), 30 images/s, H.264 lisible partout, sans son,
  // lecture dès le début du téléchargement (faststart).
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', input, '-an', '-vf', 'scale=480:-2,fps=30', '-c:v', 'libx264', '-crf', '32', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, `${name}.mp4`)]);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '1', '-i', input, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', join(out, `${name}.jpg`)]);
  console.log(`✔ ${name}`);
}
