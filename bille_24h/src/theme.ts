import {Easing} from 'remotion';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

const anton = loadAnton('normal', {weights: ['400'], subsets: ['latin', 'latin-ext']});
const inter = loadInter('normal', {weights: ['500', '700', '900'], subsets: ['latin', 'latin-ext']});
const mono = loadMono('normal', {weights: ['500', '800'], subsets: ['latin']});

export const polices = {
	titre: anton.fontFamily,
	texte: inter.fontFamily,
	mono: mono.fontFamily,
};

// Palette tirée de la mascotte du club (voiture orange, billes de couleur)
// et du décor réel (sable mouillé, nuit de course).
export const couleurs = {
	nuit: '#070A14',
	encre: '#10162A',
	craie: '#F7F2E8',
	sable: '#D9AE6E',
	sableClair: '#ECCB93',
	sableFonce: '#9E7240',
	bois: '#5B3A1F',
	orange: '#FF6A13',
	jaune: '#FFC928',
	rouge: '#E8202A',
	vert: '#4FC93A',
	bleu: '#1E4FD8',
};

export const billes = [couleurs.orange, couleurs.jaune, couleurs.rouge, couleurs.vert, couleurs.bleu];

// Identité de mouvement (personnalité « énergique », comme une course) : trois courbes pour tout le film.
export const courbes = {
	// Arrivée : part très vite et se pose en douceur.
	entree: Easing.bezier(0.16, 1, 0.3, 1),
	// Départ : démarre doucement et file en accélérant.
	sortie: Easing.bezier(0.7, 0, 0.84, 0),
	// Transitions : lent, fulgurant au milieu, lent (le flou de bougé se cale dessus).
	traverse: Easing.bezier(0.87, 0, 0.13, 1),
};

// Budget de cascade : un texte ne met jamais plus d'une demi-seconde à s'écrire (15 images à 30 i/s).
export const BUDGET_CASCADE = 15;

// Rendu à 60 i/s ; les animations restent écrites en images à 30 i/s (voir temps.ts).
export const FPS = 60;
// Montage calé sur une musique à 120 BPM : un temps = 15 images.
export const TEMPS = 15;

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
