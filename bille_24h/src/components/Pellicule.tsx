import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useImage} from '../temps';

export const IMAGES_GRAIN = 6;

// Bruit de grain calculé en SVG : sert uniquement à fabriquer public/textures/grain-N.png
// (scripts/textures.mjs).
export const GrainBrut: React.FC<{graine: number}> = ({graine}) => (
	<svg width="100%" height="100%">
		<filter id="grain">
			<feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={graine} />
			<feColorMatrix type="saturate" values="0" />
		</filter>
		<rect width="100%" height="100%" filter="url(#grain)" />
	</svg>
);

// Grain argentique animé + vignettage, posé au-dessus de tout le film.
export const Pellicule: React.FC<{grain?: number}> = ({grain = 0.09}) => {
	const frame = useImage();
	// Le grain change à chaque image à 30 i/s, comme sur une vraie pellicule.
	const n = Math.floor(frame) % IMAGES_GRAIN;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<Img
				src={staticFile(`textures/grain-${n}.png`)}
				style={{width: '100%', height: '100%', opacity: grain, mixBlendMode: 'overlay'}}
			/>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
				}}
			/>
		</AbsoluteFill>
	);
};
