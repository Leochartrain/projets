// Rend des images fixes du teaser pour vérifier le cadrage : node scripts/apercus.mjs 30 230 560 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const id = Number.isNaN(Number(args[0])) ? args.shift() : 'Teaser';
const images = args.map(Number);
const racine = path.resolve(import.meta.dirname, '..');
const sortie = path.join(racine, 'out', 'apercus');
mkdirSync(sortie, {recursive: true});

const serveUrl = await bundle({entryPoint: path.join(racine, 'src', 'index.ts')});
const composition = await selectComposition({serveUrl, id});
for (const frame of images) {
	const fichier = path.join(sortie, `f${String(frame).padStart(4, '0')}.png`);
	await renderStill({composition, serveUrl, frame, output: fichier, scale: 0.5, chromiumOptions: {gl: 'angle'}});
	console.log(fichier);
}
