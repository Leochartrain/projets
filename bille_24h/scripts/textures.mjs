// Précalcule les textures (sable, grain) en PNG dans public/textures.
// Les filtres SVG sont trop lourds pour être recalculés à chaque image du film.
// Lancer : npm run textures (ajouter --force pour tout refaire).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';

const IMAGES_GRAIN = 6;
const racine = path.resolve(import.meta.dirname, '..');
const dossier = path.join(racine, 'public', 'textures');
mkdirSync(dossier, {recursive: true});

const travaux = [
	{id: 'TextureSable', fichier: 'sable.png', props: {}},
	...Array.from({length: IMAGES_GRAIN}, (_, i) => ({id: 'TextureGrain', fichier: `grain-${i}.png`, props: {graine: i + 1}})),
].filter((t) => process.argv.includes('--force') || !existsSync(path.join(dossier, t.fichier)));

if (travaux.length === 0) {
	console.log('Textures déjà à jour.');
} else {
	const serveUrl = await bundle({entryPoint: path.join(racine, 'src', 'index.ts')});
	for (const t of travaux) {
		const composition = await selectComposition({serveUrl, id: t.id, inputProps: t.props});
		await renderStill({composition, serveUrl, inputProps: t.props, output: path.join(dossier, t.fichier), imageFormat: 'png'});
		console.log(`textures/${t.fichier}`);
	}
}
