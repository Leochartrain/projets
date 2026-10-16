import {useCurrentFrame, useVideoConfig} from 'remotion';

// Toutes les animations sont écrites en « images à 30 i/s ». Le film est rendu à 60 i/s :
// ce crochet renvoie l'image courante dans cette unité (avec des demi-images), ce qui
// double la fluidité sans toucher aux timings.
export const FPS_BASE = 30;

export const useImage = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (frame * FPS_BASE) / fps;
};

// Convertit une durée en unité de base vers de vraies images de la composition.
export const enImages = (base: number, fps: number) => Math.round((base * fps) / FPS_BASE);
