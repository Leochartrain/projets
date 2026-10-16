import React from 'react';
import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Bille3D} from '../three/Bille3D';
import {Gerbe3D} from '../three/Gerbe3D';
import {Plateau3D} from '../three/Plateau3D';
import {Revele} from '../components/Revele';
import {couleurs, polices} from '../theme';

// Image du tir : pile à 14:30:00, l'heure du départ de la manche 1.
const TIR = 90;

const grandTitre: React.CSSProperties = {
	fontFamily: polices.titre,
	fontSize: 158,
	lineHeight: 0.98,
	color: couleurs.craie,
	textTransform: 'uppercase',
	letterSpacing: 1,
};

const Poussieres: React.FC = () => {
	const frame = useImage();
	return (
		<AbsoluteFill>
			{new Array(26).fill(0).map((_, i) => {
				const x = random(`px${i}`) * 1080;
				const y0 = random(`py${i}`) * 1920;
				const t = random(`pt${i}`);
				const taille = 4 + t * 18;
				const y = y0 - frame * (0.3 + t * 0.8);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x + Math.sin(frame / 30 + i) * 12,
							top: ((y % 1920) + 1920) % 1920,
							width: taille,
							height: taille,
							borderRadius: '50%',
							background: 'rgba(255,215,160,0.55)',
							filter: `blur(${2 + t * 6}px)`,
							opacity: 0.25 + t * 0.4,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// Plan 3D : la bille sur le sable, le travelling, puis le tir vers le fond.
const PlanOuverture: React.FC<{frame: number}> = ({frame}) => {
	const tir = frame - TIR;
	const apres = Math.max(0, tir);
	const tremble = interpolate(frame, [60, TIR], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const z = -(0.32 * apres + 0.006 * apres * apres);
	const saut = tir > 0 ? Math.abs(Math.sin(apres * 0.45)) * 0.12 * Math.exp(-apres * 0.06) : 0;
	const x = tir < 0 ? Math.sin(frame * 2.1) * 0.012 * tremble : 0;

	const camZ = interpolate(frame, [0, TIR], [5.8, 4.9], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
	const pousse = interpolate(tir, [0, 10, 105], [0, 0.35, 0.6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const secousse = tir >= 0 && tir < 14 ? (1 - tir / 14) * 0.035 : 0;
	const sx = (random(`cx${Math.floor(frame * 2)}`) - 0.5) * secousse;
	const sy = (random(`cy${Math.floor(frame * 2)}`) - 0.5) * secousse;
	const camX = interpolate(frame, [0, 195], [1.25, 0.55]);
	const distance = Math.hypot(camX, 0.5, camZ - pousse);

	return (
		<Plateau3D
			camera={{position: [camX + sx, 0.95 + sy, camZ - pousse], cible: [0.05, 0.86, 0], fov: 34}}
			mise_au_point={distance}
			ouverture={0.009}
		>
			<Bille3D
				couleur={couleurs.orange}
				rayon={0.5}
				position={[x, 0.47 + saut, z]}
				roulis={tir < 0 ? frame * 0.02 : frame * 0.02 - z / 0.5}
				axe={tir < 0 ? [0.3, 1, 0.2] : [1, 0, 0]}
			/>
			<Bille3D couleur={couleurs.bleu} rayon={0.5} position={[-1.5, 0.47, -3.2]} roulis={1} />
			<Bille3D couleur={couleurs.jaune} rayon={0.5} position={[1.5, 0.47, -5.5]} roulis={2} />
			<Bille3D couleur={couleurs.vert} rayon={0.5} position={[-0.6, 0.47, -8]} roulis={3} />
			<Bille3D couleur={couleurs.rouge} rayon={0.5} position={[2.3, 0.47, -2.2]} roulis={4} />
			<Gerbe3D t={tir} origine={[0, 0.03, 0.35]} />
		</Plateau3D>
	);
};

export const Ouverture: React.FC = () => {
	const frame = useImage();

	const flash = frame < TIR ? 0 : interpolate(frame, [TIR, TIR + 8], [0.55, 0], {extrapolateRight: 'clamp'});

	const secondes = Math.min(59, 57 + Math.floor(frame / 30));
	const depart = frame >= TIR;
	const horloge = depart ? '14:30:00' : `14:29:${secondes}`;

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<PlanOuverture frame={frame} />
			<Poussieres />

			<AbsoluteFill style={{background: '#fff', opacity: flash}} />

			{/* chrono façon écran de course */}
			<div
				style={{
					position: 'absolute',
					top: 150,
					width: '100%',
					display: 'flex',
					justifyContent: 'center',
					gap: 22,
					alignItems: 'center',
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 40,
					letterSpacing: 4,
					color: depart ? couleurs.orange : couleurs.craie,
					opacity: interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'}),
				}}
			>
				<span
					style={{
						width: 18,
						height: 18,
						borderRadius: '50%',
						background: couleurs.rouge,
						opacity: frame % 30 < 18 ? 1 : 0.2,
						boxShadow: `0 0 18px ${couleurs.rouge}`,
					}}
				/>
				<span>SAMEDI · {horloge}</span>
				{depart ? <span style={{color: couleurs.jaune}}>· DÉPART</span> : null}
			</div>

			{frame < TIR + 4 ? (
				<AbsoluteFill style={{top: 300, alignItems: 'center'}}>
					<Revele texte="AU MANS," debut={12} sortie={TIR - 12} style={grandTitre} />
					<Revele texte="ILS ONT" debut={28} sortie={TIR - 10} style={grandTitre} />
					<Revele texte="DES MOTEURS." debut={40} sortie={TIR - 8} style={grandTitre} />
				</AbsoluteFill>
			) : (
				<AbsoluteFill style={{top: 560, alignItems: 'center'}}>
					<Revele
						texte="À SAINT-MARS-DE-LOCQUENAY,"
						debut={TIR + 14}
						decalage={1}
						style={{
							fontFamily: polices.texte,
							fontWeight: 900,
							fontSize: 50,
							letterSpacing: 3,
							color: couleurs.sableClair,
							marginBottom: 26,
						}}
					/>
					<Revele texte="ON A" debut={TIR + 34} style={{...grandTitre, fontSize: 190}} />
					<Revele
						texte="DES BILLES."
						debut={TIR + 42}
						style={{...grandTitre, fontSize: 190}}
						accents={{1: {color: couleurs.orange}}}
					/>
				</AbsoluteFill>
			)}
		</AbsoluteFill>
	);
};
