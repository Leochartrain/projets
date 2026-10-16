import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {Pellicule} from './components/Pellicule';
import montage from './montage.json';
import {Chiffres} from './scenes/Chiffres';
import {Dates} from './scenes/Dates';
import {Fin} from './scenes/Fin';
import {Nuit} from './scenes/Nuit';
import {Ouverture} from './scenes/Ouverture';
import {Photos} from './scenes/Photos';
import {Piste} from './scenes/Piste';
import {Titre} from './scenes/Titre';
import {balayage, damier} from './transitions';
import {FPS, TEMPS} from './theme';
import {enImages, useImage} from './temps';

const composants: Record<string, React.FC> = {
	ouverture: Ouverture,
	titre: Titre,
	piste: Piste,
	chiffres: Chiffres,
	photos: Photos,
	nuit: Nuit,
	dates: Dates,
	fin: Fin,
};

// Image de départ de chaque scène dans le film final (les transitions se chevauchent).
const debuts: Record<string, number> = {};
let curseur = 0;
for (const s of montage.scenes) {
	curseur -= s.transition?.duree ?? 0;
	debuts[s.id] = curseur;
	curseur += s.duree;
}
export const DUREE_TEASER = enImages(curseur, FPS);

// Bruitages placés par scène (image relative au début de la scène).
const bruitages: {scene: string; a: number; son: string; volume?: number}[] = [
	{scene: 'ouverture', a: 0, son: 'tic'},
	{scene: 'ouverture', a: 30, son: 'tic'},
	{scene: 'ouverture', a: 60, son: 'tic'},
	{scene: 'ouverture', a: 90, son: 'tir'},
	{scene: 'titre', a: 0, son: 'impact'},
	...[0, 1, 2, 3, 4].map((i) => ({scene: 'titre', a: 31 + i * 4, son: 'clic', volume: 0.6})),
	{scene: 'piste', a: 0, son: 'souffle'},
	{scene: 'piste', a: 70, son: 'tir', volume: 0.5},
	{scene: 'chiffres', a: 0, son: 'souffle'},
	...[0, 1, 2, 3].map((i) => ({scene: 'chiffres', a: 6 + i * 2 * TEMPS, son: 'impact', volume: 0.45})),
	{scene: 'chiffres', a: 6 + 8 * TEMPS, son: 'impact', volume: 0.6},
	...[0, 1, 2, 3].map((i) => ({scene: 'photos', a: i * 3 * TEMPS, son: 'declic'})),
	{scene: 'nuit', a: 0, son: 'souffle'},
	{scene: 'dates', a: 0, son: 'souffle'},
	...[0, 8, 16].map((d) => ({scene: 'dates', a: TEMPS + d, son: 'impact', volume: 0.55})),
	{scene: 'fin', a: 0, son: 'souffle'},
	{scene: 'fin', a: 4, son: 'impact'},
];

// Pulsation sur la musique : la caméra « cogne » légèrement sur chaque temps après le titre,
// plus fort sur le premier temps de chaque mesure.
const Pulsation: React.FC<{children: React.ReactNode}> = ({children}) => {
	const frame = useImage();
	const depuis = frame - debuts.titre;
	if (depuis < 0 || frame > debuts.fin + 60) return <AbsoluteFill>{children}</AbsoluteFill>;
	const temps = Math.floor(depuis / TEMPS);
	const phase = depuis - temps * TEMPS;
	const force = temps % 4 === 0 ? 0.022 : 0.009;
	const coup = 1 + force * Math.exp(-phase * 0.38);
	return <AbsoluteFill style={{transform: `scale(${coup})`}}>{children}</AbsoluteFill>;
};

export const Teaser: React.FC = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Pulsation>
		<TransitionSeries>
			{montage.scenes.flatMap((s) => {
				const Scene = composants[s.id];
				const elements: React.ReactNode[] = [];
				if (s.transition) {
					elements.push(
						<TransitionSeries.Transition
							key={`t-${s.id}`}
							presentation={s.transition.type === 'damier' ? damier() : balayage()}
							timing={linearTiming({durationInFrames: enImages(s.transition.duree, FPS)})}
						/>,
					);
				}
				elements.push(
					<TransitionSeries.Sequence key={s.id} durationInFrames={enImages(s.duree, FPS)}>
						<Scene />
					</TransitionSeries.Sequence>,
				);
				return elements;
			})}
		</TransitionSeries>
		</Pulsation>
		<Pellicule />

		<Audio src={staticFile('sons/musique.wav')} volume={0.85} />
		{bruitages.map((b, i) => (
			<Sequence key={i} from={enImages(debuts[b.scene] + b.a, FPS)} durationInFrames={enImages(90, FPS)} layout="none">
				<Audio src={staticFile(`sons/${b.son}.wav`)} volume={b.volume ?? 1} />
			</Sequence>
		))}
	</AbsoluteFill>
);

export {debuts};
