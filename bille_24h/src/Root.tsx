import React from 'react';
import {AbsoluteFill, Composition, Folder} from 'remotion';
import {GrainBrut} from './components/Pellicule';
import {SableBrut} from './components/Sable';
import {Teaser, DUREE_TEASER} from './Teaser';
import {FPS, HAUTEUR, LARGEUR} from './theme';

const TextureGrain: React.FC<{graine: number}> = ({graine}) => (
	<AbsoluteFill>
		<GrainBrut graine={graine} />
	</AbsoluteFill>
);

export const Racine: React.FC = () => (
	<>
		<Composition id="Teaser" component={Teaser} durationInFrames={DUREE_TEASER} fps={FPS} width={LARGEUR} height={HAUTEUR} />
		{/* Textures précalculées en PNG par scripts/textures.mjs */}
		<Folder name="Textures">
			<Composition id="TextureSable" component={SableBrut} durationInFrames={1} fps={FPS} width={LARGEUR} height={HAUTEUR} />
			<Composition
				id="TextureGrain"
				component={TextureGrain}
				durationInFrames={1}
				fps={FPS}
				width={LARGEUR}
				height={HAUTEUR}
				defaultProps={{graine: 0}}
			/>
		</Folder>
	</>
);
