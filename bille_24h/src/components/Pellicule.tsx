import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

// Grain argentique animé + vignettage, posé au-dessus de tout le film.
export const Pellicule: React.FC<{grain?: number}> = ({grain = 0.09}) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<svg width="100%" height="100%" style={{opacity: grain, mixBlendMode: 'overlay'}}>
				<filter id="grain">
					<feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={frame % 12} />
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width="100%" height="100%" filter="url(#grain)" />
			</svg>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
				}}
			/>
		</AbsoluteFill>
	);
};
