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
// Deux bus : la batterie, et tout le reste (basse, accords, arpège) qui « pompe »
// sous la grosse caisse (sidechain), comme dans la musique électro de pub.
const TEMPS = 0.5;
const DROP = debuts.titre;
const FIN = debuts.fin;
const fin = DUREE - 0.4;
const longueur = Math.ceil((DUREE + 1) * SR);
const bat = [new Float32Array(longueur), new Float32Array(longueur)];
const mus = [new Float32Array(longueur), new Float32Array(longueur)];
const poser = (bus, b, a, gain, pan = 0) => {
	ajouter(bus[0], b, a, gain * (1 - Math.max(0, pan)));
	ajouter(bus[1], b, a, gain * (1 + Math.min(0, pan)));
};

// Cymbale crash : bruit aigu à longue décroissance.
const crash = () => {
	const b = tampon(2.2);
	for (let i = 0; i < b.length; i++) b[i] = bruit() * Math.exp(-(i / SR) * 2.2);
	return reverbe(passeHaut(b, 5000), 0.3, 1.2);
};
// Souffle inversé : monte jusqu'à l'instant donné (avant une transition).
const aspiration = (duree) => {
	const b = tampon(duree);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR / duree;
		b[i] = bruit() * t ** 3;
	}
	return passeBas(b, (t) => 600 + 9000 * (t / duree) ** 2, 1.4);
};
// Chute de sub-basse sous les grands impacts.
const chuteSub = () => {
	const b = tampon(1.4);
	let ph = 0;
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		ph += (2 * Math.PI * (70 * Math.exp(-t * 1.6) + 28)) / SR;
		b[i] = Math.sin(ph) * Math.exp(-t * 2.2);
	}
	return b;
};
// Pluck : note courte et brillante pour l'arpège.
const pluck = (note) => {
	const b = tampon(0.4);
	const f = midi(note);
	for (let i = 0; i < b.length; i++) {
		const t = i / SR;
		const saw = 2 * ((t * f) % 1) - 1;
		const sq = Math.sign(Math.sin(2 * Math.PI * f * 1.003 * t));
		b[i] = (saw * 0.6 + sq * 0.4) * Math.exp(-t * 9);
	}
	return passeBas(b, (t) => 600 + 5000 * Math.exp(-t * 14), 1.8);
};
// Nappe tenue : saw désaccordées, filtre qui respire lentement.
const nappe = (notes, duree) => {
	const b = tampon(duree + 1);
	for (const n of notes)
		for (const des of [-0.12, 0.05, 0.14]) {
			const f = midi(n + des);
			let ph = alea();
			for (let i = 0; i < b.length; i++) {
				const t = i / SR;
				ph = (ph + f / SR) % 1;
				const env = Math.min(1, t / 0.4) * (t < duree ? 1 : Math.exp(-(t - duree) * 4));
				b[i] += (2 * ph - 1) * env * 0.05;
			}
		}
	return reverbe(passeBas(b, (t) => 700 + 500 * Math.sin(t * 1.3), 0.9), 0.4, 1.3);
};

// Intro : nappe grave qui monte, battement de cœur, montée de bruit avant le titre.
{
	const n = tampon(DROP + 0.2);
	for (let i = 0; i < n.length; i++) {
		const t = i / SR;
		const v = 2 * ((t * midi(33)) % 1) - 1 + (2 * ((t * midi(45.07)) % 1) - 1) * 0.5;
		n[i] = v * (t / DROP) ** 1.5 * 0.35;
	}
	poser(mus, passeBas(n, (t) => 120 + 900 * (t / DROP) ** 2, 2), 0, 1);
	poser(bat, aspiration(2.6), DROP - 2.6, 0.55);
	const k = passeBas(kick(), 300);
	for (let t = 0; t < DROP - 0.01; t += TEMPS * 2) poser(bat, k, t, 0.45);
}

const grille = [
	[57, 60, 64], // la mineur
	[53, 57, 60], // fa
	[48, 52, 55], // do
	[55, 59, 62], // sol
];
const notesBasse = [45, 41, 36, 43];
const k = kick();
const cl = clap();
const hf = charleston(false);
const ho = charleston(true);
const coupsDeGrosseCaisse = [];
// Pause d'une mesure avant les dates : la musique retient son souffle.
const enPause = (t) => t >= debuts.dates - 2 && t < debuts.dates;
// L'arpège arrive à la scène de la nuit, pour faire évoluer le morceau.
const arpege = debuts.nuit;

for (let t = DROP, n = 0; t < fin; t += TEMPS, n++) {
	const mesure = Math.floor(n / 4);
	const temps = n % 4;
	const pause = enPause(t);
	if (!pause) {
		poser(bat, k, t, 0.95);
		coupsDeGrosseCaisse.push(t);
	}
	if (temps % 2 === 1) poser(bat, cl, t, pause ? 0.25 : 0.42, 0.1);
	if (!pause) poser(bat, ho, t + TEMPS / 2, 0.15, -0.3);
	for (let s = 0; s < 4; s++) poser(bat, hf, t + (s * TEMPS) / 4, s % 2 ? 0.07 : 0.11, 0.35);
	const racine = notesBasse[mesure % 4];
	for (const d of [0.5, 0.75]) poser(mus, basse(racine - 12 + (temps === 3 && d === 0.75 ? 12 : 0), TEMPS * 0.22), t + TEMPS * d, 0.5);
	if (temps === 0) {
		poser(mus, accord(grille[mesure % 4], TEMPS * 0.35), t, 0.42, -0.2);
		poser(mus, accord(grille[mesure % 4], TEMPS * 0.2), t + TEMPS * 1.5, 0.26, 0.25);
		if (t >= arpege) poser(mus, nappe(grille[mesure % 4].map((x) => x - 12), TEMPS * 4), t, 0.6);
	}
	if (t >= arpege && !pause) {
		const accordCourant = grille[mesure % 4];
		for (let s = 0; s < 4; s++) {
			const note = accordCourant[(n * 4 + s) % 3] + 12 + (s === 3 ? 12 : 0);
			poser(mus, pluck(note), t + (s * TEMPS) / 4, 0.16, s % 2 ? 0.45 : -0.45);
		}
	}
}

// Ponctuation : aspiration avant chaque transition, crash et sub sur les moments forts.
for (const s of montage.scenes) {
	const a = debuts[s.id];
	if (s.transition && a > DROP) poser(bat, aspiration(0.9), a - 0.9 + (s.transition.duree / montage.fps) * 0.5, 0.35);
}
for (const id of ['titre', 'chiffres', 'nuit', 'dates', 'fin']) {
	const a = debuts[id] + (id === 'fin' ? 4 / 30 : 0);
	poser(bat, crash(), a, 0.32);
	poser(mus, chuteSub(), a, id === 'titre' || id === 'dates' ? 0.9 : 0.55);
	poser(bat, impact(), a, id === 'titre' || id === 'dates' ? 0.5 : 0.3);
}
// Accord final tenu.
poser(mus, nappe([45, 57, 60, 64, 69], 2.4), FIN + 1, 1.4);
poser(mus, accord([45, 57, 60, 64, 69], 2.2), FIN + 1, 0.6);

// Sidechain : le bus musical s'efface à chaque coup de grosse caisse puis revient.
{
	let prochain = 0;
	let dernier = -10;
	for (let i = 0; i < longueur; i++) {
		const t = i / SR;
		while (prochain < coupsDeGrosseCaisse.length && coupsDeGrosseCaisse[prochain] <= t) dernier = coupsDeGrosseCaisse[prochain++];
		const ecart = t - dernier;
		const gain = 1 - 0.62 * Math.exp(-ecart * 11);
		mus[0][i] *= gain;
		mus[1][i] *= gain;
	}
}

// Mastering : somme, fondu final, saturation douce, normalisation.
const g = new Float32Array(longueur);
const d = new Float32Array(longueur);
for (let i = 0; i < longueur; i++) {
	const t = i / SR;
	const fondu = Math.min(1, Math.max(0, (DUREE - t) / 1.2));
	g[i] = Math.tanh((bat[0][i] + mus[0][i]) * 1.25) * fondu;
	d[i] = Math.tanh((bat[1][i] + mus[1][i]) * 1.25) * fondu;
}
let crete = 0;
for (let i = 0; i < longueur; i++) crete = Math.max(crete, Math.abs(g[i]), Math.abs(d[i]));
for (let i = 0; i < longueur; i++) {
	g[i] *= 0.89 / crete;
	d[i] *= 0.89 / crete;
}
ecrireWav('musique.wav', g.subarray(0, Math.ceil(DUREE * SR)), d.subarray(0, Math.ceil(DUREE * SR)));
console.log(`Sons générés (${Object.keys(sons).length} bruitages + musique de ${DUREE.toFixed(1)} s).`);
