import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {Bille} from '../components/Bille';
import {Revele} from '../components/Revele';
import {Sable} from '../components/Sable';
import {couleurs, polices} from '../theme';

// Image du tir : pile à 14:30:00, l'heure du départ de la manche 1.
const TIR = 90;
const BILLE_X = 540;
const BILLE_Y = 1240;

const grandTitre: React.CSSProperties = {
	fontFamily: polices.titre,
	fontSize: 158,
	lineHeight: 0.98,
	color: couleurs.craie,
	textTransform: 'uppercase',
	letterSpacing: 1,
};

const Poussieres: React.FC = () => {
	const frame = useCurrentFrame();
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

// Gerbe de sable soulevée par le tir.
const Gerbe: React.FC = () => {
	const frame = useCurrentFrame();
	const t = frame - TIR;
	if (t < 0 || t > 50) return null;
	return (
		<AbsoluteFill>
			{new Array(70).fill(0).map((_, i) => {
				const angle = -Math.PI / 2 + (random(`ga${i}`) - 0.5) * 2.2;
				const vitesse = 14 + random(`gv${i}`) * 26;
				const x = BILLE_X + Math.cos(angle) * vitesse * t;
				const y = BILLE_Y + 190 + Math.sin(angle) * vitesse * t + 0.9 * t * t;
				const taille = 3 + random(`gt${i}`) * 9;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: taille,
							height: taille,
							borderRadius: '40%',
							background: i % 3 === 0 ? couleurs.sableFonce : couleurs.sableClair,
							opacity: interpolate(t, [0, 35, 50], [1, 0.9, 0]),
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

export const Ouverture: React.FC = () => {
	const frame = useCurrentFrame();

	const avance = interpolate(frame, [0, 195], [1, 1.1]);
	const secousse = frame >= TIR && frame < TIR + 12 ? (random(`s${frame}`) - 0.5) * 30 * (1 - (frame - TIR) / 12) : 0;

	// Avant le tir : la bille tourne doucement puis tremble. Après : elle file au loin.
	const tremble = interpolate(frame, [60, TIR], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const envol = interpolate(frame, [TIR, TIR + 16], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.in(Easing.cubic),
	});
	const billeX = BILLE_X + (frame < TIR ? Math.sin(frame * 2.1) * 4 * tremble : envol * 60);
	const billeY = BILLE_Y - envol * 1700;
	const billeEchelle = interpolate(frame, [0, TIR], [0.92, 1], {extrapolateRight: 'clamp'}) * (1 - envol * 0.7);
	const rotation = frame < TIR ? frame * 1.5 : frame * 1.5 + (frame - TIR) * 40;

	const flash = frame < TIR ? 0 : interpolate(frame, [TIR, TIR + 8], [0.55, 0], {extrapolateRight: 'clamp'});

	const secondes = Math.min(59, 57 + Math.floor(frame / 30));
	const depart = frame >= TIR;
	const horloge = depart ? '14:30:00' : `14:29:${secondes}`;

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `scale(${avance}) translate(${secousse}px, ${secousse * 0.6}px)`}}>
				<Sable lumiere={{x: 50, y: 66, rayon: 62}} />
				<Poussieres />

				{/* traînée lumineuse de la bille lancée */}
				{envol > 0 && envol < 1 ? (
					<div
						style={{
							position: 'absolute',
							left: billeX - 90 * billeEchelle,
							top: billeY,
							width: 180 * billeEchelle,
							height: 900 * envol,
							background: `linear-gradient(to bottom, ${couleurs.orange}88, rgba(255,106,19,0))`,
							filter: 'blur(18px)',
							borderRadius: '50%',
						}}
					/>
				) : null}

				<div
					style={{
						position: 'absolute',
						left: billeX - 230,
						top: billeY - 230,
						transform: `scale(${billeEchelle})`,
						filter: envol > 0 ? `blur(${envol * 6}px)` : undefined,
					}}
				>
					<Bille taille={460} couleur={couleurs.orange} rotation={rotation} ombre={envol < 0.15} />
				</div>
				<Gerbe />
			</AbsoluteFill>

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
