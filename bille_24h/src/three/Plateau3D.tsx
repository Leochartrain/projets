import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {Objectif} from './Objectif';
import {Sable3D} from './Sable3D';
import {Camera, Reflets} from './Studio3D';

type Props = {
	camera: {position: [number, number, number]; cible: [number, number, number]; fov?: number};
	mise_au_point: number;
	ouverture?: number;
	halo?: number;
	// Couleur de la nuit autour du plateau (fond + brouillard).
	nuit?: string;
	// Sol : plateau de sable (gros plans) ou herbe sombre (plans larges).
	sol?: 'sable' | 'herbe';
	brouillard?: [number, number];
	// Éclairage de gros plan (projecteur derrière la bille) ; à couper pour les plans larges.
	eclairageGrosPlan?: boolean;
	exposition?: number;
	children: React.ReactNode;
};

// Plateau de sable de nuit sous un projecteur, filmé comme au cinéma.
export const Plateau3D: React.FC<Props> = ({camera, mise_au_point, ouverture = 0.008, halo = 0.45, nuit = '#05070d', sol = 'sable', brouillard = [6, 15], eclairageGrosPlan = true, exposition = 1.15, children}) => {
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: nuit}}>
			<ThreeCanvas
				width={width}
				height={height}
				shadows
				gl={{antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposition}}
			>
				<Camera {...camera} />
				<Reflets intensite={0.45} />
				<color attach="background" args={[nuit]} />
				<fog attach="fog" args={[nuit, ...brouillard]} />
				<hemisphereLight args={['#5a6cff', '#2a1a0a', 0.22]} />
				{eclairageGrosPlan ? (
					<>
				{/* projecteur principal, chaud, derrière la bille : le sable s'allume dans le verre */}
				<spotLight
					position={[-2, 6, -4]}
					angle={0.55}
					penumbra={0.9}
					intensity={200}
					color="#ffd6a0"
					castShadow
					shadow-mapSize={[2048, 2048]}
					shadow-bias={-0.0004}
				/>
				{/* lumière de face douce pour lire les ailettes */}
				<spotLight position={[3, 3, 6]} angle={0.5} penumbra={1} intensity={60} color="#fff1e0" />
				<pointLight position={[3, 1.2, -3]} intensity={18} color="#ff8a3d" />
					</>
				) : null}
				{sol === 'sable' ? (
					<Sable3D taille={60} />
				) : (
					<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
						<planeGeometry args={[120, 120]} />
						<meshStandardMaterial color="#1d2214" roughness={1} />
					</mesh>
				)}
				{children}
				<Objectif mise_au_point={mise_au_point} ouverture={ouverture} halo={halo} />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
