// Génère la musique provisoire et les bruitages du teaser (WAV 44,1 kHz) dans public/sons.
// Tout est synthétisé ici : aucun droit à gérer. Lancer : npm run sons
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const SR = 44100;
const DOSSIER = new URL('../public/sons/', import.meta.url);
const montage = JSON.parse(readFileSync(new URL('../src/montage.json', import.meta.url), 'utf8'));

// Début (en secondes) de chaque scène, transitions comprises.
const debuts = {};
let curseur = 0;
for (const s of montage.scenes) {
	curseur -= s.transition?.duree ?? 0;
	debuts[s.id] = curseur / montage.fps;
	curseur += s.duree;
}
const DUREE = curseur / montage.fps;

// --- outils ---------------------------------------------------------------
let graine = 7;
const alea = () => {
	graine = (graine * 1664525 + 1013904223) >>> 0;
	return graine / 4294967296;
};
const bruit = () => alea() * 2 - 1;
const tampon = (sec) => new Float32Array(Math.ceil(sec * SR));
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

const ecrireWav = (nom, gauche, droite = gauche) => {
	const n = gauche.length;
	const buf = Buffer.alloc(44 + n * 4);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 4, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(2, 22);
	buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(SR * 4, 28);
	buf.writeUInt16LE(4, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 4, 40);
	for (let i = 0; i < n; i++) {
		buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, gauche[i])) * 32767), 44 + i * 4);
		buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, droite[i])) * 32767), 46 + i * 4);
	}
	writeFileSync(new URL(nom, DOSSIER), buf);
};

const normaliser = (b, crete = 0.89) => {
	let m = 0;
	for (const v of b) m = Math.max(m, Math.abs(v));
	if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= crete / m;
	return b;
};

// Filtre passe-bas résonant (state variable), fréquence éventuellement variable.
const passeBas = (b, freq, q = 0.7) => {
	let low = 0;
	let band = 0;
	const out = new Float32Array(b.length);
	for (let i = 0; i < b.length; i++) {
		const fc = typeof freq === 'function' ? freq(i / SR) : freq;
		const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
		low += f * band;
		const high = b[i] - low - band / q;
		band += f * high;
		out[i] = low;
	}
	return out;
};
const passeHaut = (b, freq) => {
	const lp = passeBas(b, freq);
	return b.map((v, i) => v - lp[i]);
};

// Réverbe de Schroeder simple, pour donner de l'espace.
const reverbe = (b, mix = 0.25, taille = 1) => {
	const combs = [1557, 1617, 1491, 1422].map((d) => Math.round(d * taille));
	const out = new Float32Array(b.length);
	for (const d of combs) {
		const ligne = new Float32Array(d);
		let k = 0;
		for (let i = 0; i < b.length; i++) {
			const y = ligne[k];
			ligne[k] = b[i] + y * 0.8;
			out[i] += y / combs.length;
			k = (k + 1) % d;
		}
	}
	for (const d of [225, 556]) {
		const ligne = new Float32Array(d);
		let k = 0;
		for (let i = 0; i < out.length; i++) {
			const y = ligne[k];
			const x = out[i];
			ligne[k] = x + y * 0.5;
			out[i] = y - x * 0.5;
			k = (k + 1) % d;
		}
	}
	return b.map((v, i) => v * (1 - mix) + out[i] * mix);
};

const ajouter = (dest, src, aSec, gain = 1) => {
	const d = Math.round(aSec * SR);
	for (let i = 0; i < src.length && d + i < dest.length; i++) if (d + i >= 0) dest[d + i] += src[i] * gain;
};

// --- instruments --------------------------------------------------------------
const kick = () => {
	const b = tampon(0.45);
	let phase = 0;
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		const f = 45 + 120 * Math.exp(-t * 28);
		phase += (2 * Math.PI * f) / SR;
		b[i] = Math.tanh(Math.sin(phase) * Math.exp(-t * 7) * 2.2) + bruit() * Math.exp(-t * 300) * 0.3;
	}
	return b;
};
const clap = () => {
	const b = tampon(0.35);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		const rafale = [0, 0.011, 0.022].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) * (d === 0.022 ? 18 : 120)) : 0), 0);
		b[i] = bruit() * rafale * 0.5;
	}
	return reverbe(passeHaut(passeBas(b, 2600, 1.2), 700), 0.35, 0.7);
};
const charleston = (ouvert) => {
	const b = tampon(ouvert ? 0.28 : 0.06);
	for (let i = 0; i < b.length; i++) b[i] = bruit() * Math.exp(-(i / SR) * (ouvert ? 14 : 70));
	return passeHaut(b, 7500);
};
const basse = (note, duree) => {
	const b = tampon(duree);
	const f = midi(note);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		const saw = 2 * ((t * f) % 1) - 1;
		const sq = Math.sign(Math.sin(2 * Math.PI * f * 0.5 * t)) * 0.4;
		b[i] = (saw + sq) * Math.min(1, t * 200) * Math.exp(-t * 3);
	}
	return passeBas(b, (t) => 180 + 1400 * Math.exp(-t * 18), 1.6);
};
const accord = (notes, duree) => {
	const b = tampon(duree + 0.8);
	for (const n of notes) {
		for (const des of [-0.08, 0, 0.08]) {
			const f = midi(n + des);
			let ph = alea();
			for (let i = 0; i < b.length; i++) {
				const t = i / SR;
				ph = (ph + f / SR) % 1;
				const env = t < duree ? Math.min(1, t * 30) : Math.exp(-(t - duree) * 6);
				b[i] += (2 * ph - 1) * env * 0.12;
			}
		}
	}
	return reverbe(passeBas(b, (t) => 900 + 2200 * Math.exp(-t * 4), 1.1), 0.3);
};

// --- bruitages -----------------------------------------------------------------
const tic = () => {
	const b = tampon(0.12);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		b[i] = (Math.sin(2 * Math.PI * 2400 * t) * 0.6 + bruit() * 0.4) * Math.exp(-t * 90);
	}
	return reverbe(b, 0.2, 0.5);
};
// Choc de verre : partiels inharmoniques très aigus.
const verre = (hauteur = 1) => {
	const b = tampon(0.5);
	const partiels = [3100, 5230, 7410, 9800].map((f) => f * hauteur);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		let v = 0;
		partiels.forEach((f, k) => (v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (18 + k * 9)) / (k + 1)));
		b[i] = v + bruit() * Math.exp(-t * 400) * 0.5;
	}
	return reverbe(b, 0.18, 0.6);
};
const souffle = (duree = 0.55, montee = 0.6) => {
	const b = tampon(duree);
	for (let i = 0; i < b.length; i++) {
		const t = i / duree / SR;
		const env = t < montee ? (t / montee) ** 2 : Math.exp(-(t - montee) * 9);
		b[i] = bruit() * env;
	}
	return passeBas(b, (t) => 400 + 5000 * Math.sin(Math.min(1, t / duree) * Math.PI), 2.2);
};
const tir = () => {
	const b = tampon(0.9);
	ajouter(b, verre(1.1), 0, 1);
	ajouter(b, souffle(0.6, 0.15), 0.01, 0.8);
	// Gerbe de sable : grésillement granuleux.
	const sable = tampon(0.5);
	for (let i = 0; i < sable.length; i++) sable[i] = (alea() < 0.04 ? bruit() : 0) * Math.exp(-(i / SR) * 7);
	ajouter(b, passeHaut(sable, 1800), 0.02, 0.9);
	return b;
};
const impact = () => {
	const b = tampon(1.6);
	let ph = 0;
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		ph += (2 * Math.PI * (38 + 90 * Math.exp(-t * 12))) / SR;
		b[i] = Math.tanh(Math.sin(ph) * Math.exp(-t * 2.6) * 3) * 0.8 + bruit() * Math.exp(-t * 25) * 0.4;
	}
	return reverbe(b, 0.3, 1.3);
};
const bip = () => {
	const b = tampon(0.25);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		const f = t < 0.07 ? 1320 : 1760;
		b[i] = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.3 * (t < 0.16 ? 1 : Math.exp(-(t - 0.16) * 60));
	}
	return reverbe(passeBas(b, 5000), 0.2, 0.6);
};
const declic = () => {
	const b = tampon(0.4);
	for (const [a, g] of [
		[0, 1],
		[0.055, 0.7],
	]) {
		const c = tampon(0.08);
		for (let i = 0; i < c.length; i++) c[i] = bruit() * Math.exp(-(i / SR) * 90);
		ajouter(b, passeBas(c, 3500, 2), a, g);
	}
	ajouter(b, souffle(0.25, 0.1), 0.05, 0.25);
	return b;
};

const sons = {tic, clic: () => verre(1.35), tir, souffle: () => souffle(), impact, bip, declic};
mkdirSync(DOSSIER, {recursive: true});
for (const [nom, f] of Object.entries(sons)) ecrireWav(`${nom}.wav`, normaliser(f(), 0.85));

// --- musique : 120 BPM, la mineur ---------------------------------------------
const TEMPS = 0.5;
const DROP = debuts.titre;
const FIN = debuts.fin;
const g = tampon(DUREE + 1);
const d = tampon(DUREE + 1);
const mono = (b, a, gain, pan = 0) => {
	ajouter(g, b, a, gain * (1 - Math.max(0, pan)));
	ajouter(d, b, a, gain * (1 + Math.min(0, pan)));
};

// Intro : nappe grave qui monte + montée de bruit avant le titre.
{
	const nappe = tampon(DROP + 0.2);
	for (let i = 0; i < nappe.length; i++) {
		const t = i / SR;
		const v = (2 * ((t * midi(33)) % 1) - 1) + (2 * ((t * midi(45.07)) % 1) - 1) * 0.5;
		nappe[i] = v * (t / DROP) ** 1.5 * 0.35;
	}
	mono(passeBas(nappe, (t) => 120 + 900 * (t / DROP) ** 2, 2), 0, 1);
	const montee = souffle(2.4, 0.98);
	mono(montee, DROP - 2.4, 0.5);
	// Battement de cœur sur les temps de l'intro.
	const k = kick();
	for (let t = 0; t < DROP - 0.01; t += TEMPS * 2) mono(passeBas(k, 300), t, 0.45);
}

const grille = [
	[57, 60, 64], // la mineur
	[53, 57, 60], // fa
	[48, 52, 55], // do
	[55, 59, 62], // sol
];
const notesBasse = [45, 45, 41, 43];
const k = kick();
const cl = clap();
const hf = charleston(false);
const ho = charleston(true);
const fin = DUREE - 0.4;

for (let t = DROP, n = 0; t < fin; t += TEMPS, n++) {
	const mesure = Math.floor(n / 4);
	const tempsDansMesure = n % 4;
	// Respiration d'une mesure (sans grosse caisse) avant les dates.
	const pause = t >= debuts.dates - 2 && t < debuts.dates;
	if (!pause) mono(k, t, 0.95);
	if (tempsDansMesure % 2 === 1) mono(cl, t, 0.4, 0.1);
	mono(ho, t + TEMPS / 2, 0.16, -0.3);
	for (let s = 0; s < 4; s++) mono(hf, t + (s * TEMPS) / 4, s % 2 ? 0.08 : 0.12, 0.35);
	const racine = notesBasse[mesure % 4];
	mono(basse(racine - 12 + (tempsDansMesure === 3 ? 12 : 0), TEMPS * 0.45), t + TEMPS / 2, 0.42);
	if (tempsDansMesure === 0 && t < FIN + 1) {
		const a = accord(grille[mesure % 4], TEMPS * 0.4);
		mono(a, t, 0.5, -0.2);
		mono(a, t + TEMPS * 1.5, 0.3, 0.25);
	}
}
// Impacts musicaux sur les grands moments.
for (const id of ['titre', 'dates', 'fin']) mono(impact(), debuts[id] + (id === 'fin' ? 4 / 30 : 0), 0.5);
// Accord final tenu.
mono(accord([45, 57, 60, 64, 69], 2.2), FIN + 1, 0.7);

// Mastering : fondu final, saturation douce, normalisation.
for (let i = 0; i < g.length; i++) {
	const t = i / SR;
	const fondu = Math.min(1, Math.max(0, (DUREE - t) / 1.2));
	g[i] = Math.tanh(g[i] * 1.3) * fondu;
	d[i] = Math.tanh(d[i] * 1.3) * fondu;
}
let crete = 0;
for (let i = 0; i < g.length; i++) crete = Math.max(crete, Math.abs(g[i]), Math.abs(d[i]));
for (let i = 0; i < g.length; i++) {
	g[i] *= 0.89 / crete;
	d[i] *= 0.89 / crete;
}
ecrireWav('musique.wav', g.subarray(0, Math.ceil(DUREE * SR)), d.subarray(0, Math.ceil(DUREE * SR)));
console.log(`Sons générés (${Object.keys(sons).length} bruitages + musique de ${DUREE.toFixed(1)} s).`);
