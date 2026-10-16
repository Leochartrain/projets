import React from 'react';
import {Composition} from 'remotion';
import {Teaser, DUREE_TEASER} from './Teaser';
import {FPS, HAUTEUR, LARGEUR} from './theme';

export const Racine: React.FC = () => (
	<Composition
		id="Teaser"
		component={Teaser}
		durationInFrames={DUREE_TEASER}
		fps={FPS}
		width={LARGEUR}
		height={HAUTEUR}
	/>
);
