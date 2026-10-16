import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';

type SansProps = Record<string, never>;

const COLONNES = 9;
const LIGNES = 16;

// Masque SVG : les cases d'un damier grossissent en diagonale et révèlent la scène suivante.
const masqueDamier = (p: number) => {
	const cw = 1080 / COLONNES;
	const ch = 1920 / LIGNES;
	let rects = '';
	for (let x = 0; x < COLONNES; x++) {
		for (let y = 0; y < LIGNES; y++) {
			const retard = ((x + (LIGNES - 1 - y)) / (COLONNES + LIGNES - 2)) * 0.55;
			// Une case sur deux part en avance : on voit le damier se former.
			const local = Math.min(1, Math.max(0, (p - retard - ((x + y) % 2) * 0.12) / 0.33));
			if (local <= 0) continue;
			const w = cw * local + 1;
			const h = ch * local + 1;
			rects += `<rect x='${x * cw + (cw - w) / 2}' y='${y * ch + (ch - h) / 2}' width='${w}' height='${h}'/>`;
		}
	}
	return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'>${rects}</svg>")`;
};

const Damier: React.FC<TransitionPresentationComponentProps<SansProps>> = ({children, presentationDirection, presentationProgress}) => {
	if (presentationDirection === 'exiting') {
		return <AbsoluteFill style={{transform: `scale(${1 + presentationProgress * 0.08})`}}>{children}</AbsoluteFill>;
	}
	const masque = presentationProgress >= 0.999 ? undefined : masqueDamier(presentationProgress);
	return (
		<AbsoluteFill style={{WebkitMaskImage: masque, maskImage: masque, WebkitMaskSize: '100% 100%', maskSize: '100% 100%'}}>
			{children}
		</AbsoluteFill>
	);
};

// Balayage vertical rapide avec flou de bougé, façon caméra embarquée.
const Balayage: React.FC<TransitionPresentationComponentProps<SansProps>> = ({children, presentationDirection, presentationProgress}) => {
	const p = presentationProgress;
	const vitesse = Math.sin(p * Math.PI);
	const y = presentationDirection === 'entering' ? (1 - p) * 100 : -p * 100;
	return (
		<AbsoluteFill style={{transform: `translateY(${y}%)`, filter: `blur(${vitesse * 14}px)`}}>{children}</AbsoluteFill>
	);
};

export const damier = (): TransitionPresentation<SansProps> => ({component: Damier, props: {}});
export const balayage = (): TransitionPresentation<SansProps> => ({component: Balayage, props: {}});
