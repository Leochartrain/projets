import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {couleurs} from '../theme';

// Filtres SVG qui transforment un bruit fractal en grains de sable (sombres et clairs).
export const FiltresSable: React.FC<{id: string; echelle?: number}> = ({id, echelle = 1}) => (
	<>
		<filter id={`${id}-sombre`} x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency={0.75 / echelle} numOctaves={3} seed={3} />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 0.32  0 0 0 0 0.2  0 0 0 0 0.09  2.2 0 0 0 -1.0"
			/>
		</filter>
		<filter id={`${id}-clair`} x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency={0.9 / echelle} numOctaves={2} seed={11} />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 1  0 0 0 0 0.94  0 0 0 0 0.8  -2.4 0 0 0 0.95"
			/>
		</filter>
		<filter id={`${id}-relief`} x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency={0.012 / echelle} numOctaves={2} seed={5} />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.05  0.9 0 0 0 -0.38"
			/>
		</filter>
	</>
);

// Les trois couches de texture, à placer dans un <svg> où les filtres sont définis.
export const CouchesSable: React.FC<{id: string; largeur: number | string; hauteur: number | string; x?: number; y?: number}> = ({
	id,
	largeur,
	hauteur,
	x = 0,
	y = 0,
}) => (
	<>
		<rect x={x} y={y} width={largeur} height={hauteur} fill="#C8975A" />
		<rect x={x} y={y} width={largeur} height={hauteur} filter={`url(#${id}-relief)`} />
		<rect x={x} y={y} width={largeur} height={hauteur} filter={`url(#${id}-sombre)`} />
		<rect x={x} y={y} width={largeur} height={hauteur} filter={`url(#${id}-clair)`} />
	</>
);

type Props = {
	// Position du projecteur (en % de l'écran) ; null = éclairage uniforme.
	lumiere?: {x: number; y: number; rayon: number} | null;
	style?: React.CSSProperties;
};

// Texture calculée par les filtres SVG : sert uniquement à fabriquer public/textures/sable.png
// (scripts/textures.mjs). Le film utilise l'image, bien plus rapide à afficher.
export const SableBrut: React.FC = () => (
	<svg width="100%" height="100%">
		<defs>
			<FiltresSable id="plateau" />
		</defs>
		<CouchesSable id="plateau" largeur="100%" hauteur="100%" />
	</svg>
);

export const TEXTURE_SABLE = 'textures/sable.png';

// Plateau de sable mouillé plein écran, éclairé comme la piste la nuit.
export const Sable: React.FC<Props> = ({lumiere = {x: 50, y: 60, rayon: 70}, style}) => (
	<AbsoluteFill style={style}>
		<Img src={staticFile(TEXTURE_SABLE)} style={{width: '100%', height: '100%'}} />
		{lumiere ? (
			<AbsoluteFill
				style={{
					background: `radial-gradient(circle at ${lumiere.x}% ${lumiere.y}%, rgba(255,214,150,0.18) 0%, rgba(0,0,0,0) ${
						lumiere.rayon * 0.35
					}%, rgba(4,6,14,0.82) ${lumiere.rayon}%, rgba(4,6,14,0.96) 100%)`,
				}}
			/>
		) : null}
	</AbsoluteFill>
);
