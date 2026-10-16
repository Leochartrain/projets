import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring} from 'remotion';
import * as THREE from 'three';
import {Revele} from '../components/Revele';
import {Bille3D} from '../three/Bille3D';
import {HAUTEUR_TABLE, Piste3D, repere, tracePiste, Voiture3D} from '../three/Piste3D';
import {Plateau3D} from '../three/Plateau3D';
import {Projecteur} from '../three/Studio3D';
import {FPS_BASE, useImage} from '../temps';
import {couleurs, polices} from '../theme';

const METRES = 77;
const RAYON = 0.1;
const DEBUT_COURSE = 60;
const FIN_COURSE = 205;
const PONT = 0.43;

const equipages = [
	{f: 0.08, c: couleurs.bleu, d: 0.24},
	{f: 0.22, c: couleurs.rouge, d: -0.22},
	{f: 0.36, c: couleurs.vert, d: 0.22},
	{f: 0.55, c: couleurs.jaune, d: -0.24},
	{f: 0.7, c: '#b9bec6', d: 0.22},
	{f: 0.86, c: couleurs.orange, d: -0.22},
];

const avancee = (frame: number) =>
	interpolate(frame, [DEBUT_COURSE, FIN_COURSE], [0, 0.97], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.5, 0, 0.3, 1),
	});

const melange = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);

const Etiquette: React.FC<{texte: string; debut: number; fin: number; haut: number}> = ({texte, debut, fin, haut}) => {
	const frame = useImage();
	const entree = spring({frame: frame - debut, fps: FPS_BASE, config: {damping: 14}});
	const sortie = interpolate(frame, [fin, fin + 8], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div
			style={{
				position: 'absolute',
				top: haut,
				left: 0,
				right: 0,
				display: 'flex',
				justifyContent: 'center',
				opacity: sortie,
				transform: `translateY(${(1 - entree) * 40}px) scale(${0.8 + entree * 0.2})`,
			}}
		>
			<div
				style={{
					fontFamily: polices.titre,
					fontSize: 76,
					color: couleurs.nuit,
					background: couleurs.jaune,
					padding: '4px 28px',
					transform: 'skewX(-8deg)',
					opacity: entree,
				}}
			>
				{texte}
			</div>
		</div>
	);
};

export const Piste: React.FC = () => {
	const frame = useImage();
	const a = avancee(frame);
	const {p, t, cote} = repere(a);
	const centre = new THREE.Vector3(2.8, HAUTEUR_TABLE, -1);

	// Caméra : grue en plan large, puis plongée derrière la bille, façon caméra embarquée.
	const grue = new THREE.Vector3(interpolate(frame, [0, 60], [0.5, 1.6]), interpolate(frame, [0, 60], [13, 10]), interpolate(frame, [0, 60], [13, 11]));
	const poursuite = p
		.clone()
		.addScaledVector(t, -1.5)
		.addScaledVector(cote, 0.3)
		.add(new THREE.Vector3(0, 0.62, 0));
	const viseePoursuite = p.clone().addScaledVector(t, 1.6);
	const w = interpolate(frame, [40, 95], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	const position = melange(grue, poursuite, w);
	const visee = melange(centre, viseePoursuite, w);
	const distance = position.distanceTo(w > 0.5 ? p : centre);

	// Roulement : angle = distance parcourue / rayon.
	const roulis = (a * tracePiste.getLength()) / RAYON;
	const axe: [number, number, number] = [cote.x, 0, cote.z];

	const entete = interpolate(frame, [55, 75], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const passagePont = DEBUT_COURSE + (FIN_COURSE - DEBUT_COURSE) * 0.44;

	return (
		<AbsoluteFill style={{background: couleurs.nuit}}>
			<Plateau3D
				camera={{position: position.toArray() as [number, number, number], cible: visee.toArray() as [number, number, number], fov: interpolate(w, [0, 1], [36, 50])}}
				mise_au_point={distance}
				ouverture={interpolate(w, [0, 1], [0.0005, 0.004])}
				eclairageGrosPlan={false}
				exposition={1.25}
				sol="herbe"
				brouillard={[8, 30]}
				halo={0.5}
			>
				<Projecteur position={[-3, 9, 2]} cible={[2.8, 0.7, 0]} intensite={60} />
				<Projecteur position={[9, 8, -3]} cible={[2.8, 0.7, 0]} intensite={26} couleur="#ffd0a0" ombres={false} />
				{/* lumière qui suit la bille, pour qu'elle brille dans la caméra embarquée */}
				<pointLight position={[p.x - t.x * 0.6, p.y + 0.8, p.z - t.z * 0.6]} intensity={3} color="#fff1e0" />
				<Piste3D />
				{equipages.map((e) => (
					<Voiture3D key={e.f} f={e.f} couleur={e.c} decalage={e.d} />
				))}
				<Bille3D couleur={couleurs.orange} rayon={RAYON} position={[p.x, p.y + 0.03 + RAYON, p.z]} roulis={roulis} axe={axe} />
			</Plateau3D>

			{/* en-tête, pendant le plan large */}
			<AbsoluteFill style={{top: 110, alignItems: 'center', opacity: entete}}>
				<div style={{fontFamily: polices.mono, fontWeight: 800, fontSize: 34, letterSpacing: 8, color: couleurs.orange}}>▸ LA PISTE</div>
				<Revele
					texte={`${METRES} MÈTRES`}
					debut={6}
					style={{fontFamily: polices.titre, fontSize: 170, lineHeight: 1, color: couleurs.craie, marginTop: 34}}
				/>
				<Revele
					texte="DE SABLE MOUILLÉ"
					debut={16}
					decalage={1}
					style={{fontFamily: polices.texte, fontWeight: 900, fontSize: 56, letterSpacing: 6, color: couleurs.sableClair}}
				/>
			</AbsoluteFill>

			<Etiquette texte="LE PONT DUNLOP" debut={passagePont - 14} fin={passagePont + 22} haut={300} />
			<Etiquette texte="NOUVEAU TRACÉ CHAQUE ANNÉE" debut={FIN_COURSE - 30} fin={260} haut={300} />

			{/* télémétrie embarquée */}
			<div
				style={{
					position: 'absolute',
					left: 60,
					right: 60,
					bottom: 70,
					padding: '18px 26px',
					background: 'linear-gradient(90deg, rgba(7,10,20,0.8), rgba(7,10,20,0.35))',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-end',
					fontFamily: polices.mono,
					fontWeight: 800,
					color: couleurs.craie,
					opacity: interpolate(frame, [70, 85], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
				}}
			>
				<div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
					<span style={{fontSize: 26, letterSpacing: 4, opacity: 0.7}}>DISTANCE</span>
					<span style={{fontFamily: polices.titre, fontWeight: 400, fontSize: 96, lineHeight: 1, color: couleurs.jaune}}>
						{((a / 0.97) * METRES).toFixed(1).replace('.', ',')} M
					</span>
				</div>
				<div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, letterSpacing: 4}}>
					<span style={{width: 16, height: 16, borderRadius: '50%', background: couleurs.rouge, opacity: frame % 30 < 18 ? 1 : 0.25}} />
					CAMÉRA EMBARQUÉE
				</div>
			</div>
		</AbsoluteFill>
	);
};
