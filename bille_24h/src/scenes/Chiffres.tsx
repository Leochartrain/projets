import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Bille} from '../components/Bille';
import {Revele} from '../components/Revele';
import {couleurs, polices, TEMPS} from '../theme';

const lignes = [
	{valeur: 45, suffixe: '', titre: 'ÉQUIPAGES', sous: 'AU DÉPART', couleur: couleurs.orange},
	{valeur: 135, suffixe: '', titre: 'JOUEURS', sous: 'SUR LA GRILLE', couleur: couleurs.jaune},
	{valeur: 10, suffixe: '', titre: 'MANCHES', sous: 'DE JOUR COMME DE NUIT', couleur: couleurs.vert},
	{valeur: 7, suffixe: 'H', titre: 'DE TIR', sous: 'POUR CHAQUE JOUEUR', couleur: couleurs.rouge},
];

// Tour de chronométrage en fond, qui défile comme sur un écran de course.
const TourChrono: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{opacity: 0.05, transform: `translateY(${-frame * 3}px)`}}>
			{new Array(60).fill(0).map((_, i) => (
				<div
					key={i}
					style={{
						display: 'flex',
						gap: 40,
						padding: '6px 60px',
						fontFamily: polices.mono,
						fontWeight: 800,
						fontSize: 40,
						color: couleurs.craie,
						whiteSpace: 'nowrap',
					}}
				>
					<span style={{width: 90}}>P{(i % 45) + 1}</span>
					<span style={{width: 110}}>#{((i * 17) % 45) + 1}</span>
					<span style={{width: 380}}>ÉQUIPAGE {((i * 7) % 45) + 1}</span>
					<span>{i === 0 ? 'LEADER' : `+${(i * 37) % 90} PTS`}</span>
				</div>
			))}
		</AbsoluteFill>
	);
};

const Ligne: React.FC<{index: number}> = ({index}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const l = lignes[index];
	const debut = 12 + index * 2 * TEMPS;
	const entree = spring({frame: frame - debut, fps, config: {damping: 15, stiffness: 170}});
	const compte = Math.round(
		interpolate(frame, [debut, debut + 22], [0, l.valeur], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.cubic),
		}),
	);

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 34,
				height: 270,
				transform: `translateX(${interpolate(entree, [0, 1], [-1100, 0])}px) skewX(-6deg)`,
				borderBottom: '2px solid rgba(247,242,232,0.15)',
			}}
		>
			<Bille taille={70} couleur={l.couleur} rotation={frame * 8} ombre={false} />
			<div
				style={{
					fontFamily: polices.titre,
					fontSize: 250,
					lineHeight: 1,
					color: l.couleur,
					width: 400,
					textAlign: 'right',
					fontVariantNumeric: 'tabular-nums',
				}}
			>
				{compte}
				{l.suffixe}
			</div>
			<div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
				<div style={{fontFamily: polices.titre, fontSize: 92, lineHeight: 1, color: couleurs.craie, letterSpacing: 2}}>{l.titre}</div>
				<div style={{fontFamily: polices.mono, fontWeight: 800, fontSize: 28, color: couleurs.sableClair, letterSpacing: 3}}>
					{l.sous}
				</div>
			</div>
		</div>
	);
};

export const Chiffres: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<TourChrono />
			<AbsoluteFill
				style={{background: 'linear-gradient(180deg, rgba(7,10,20,0.9) 0%, rgba(7,10,20,0) 25%, rgba(7,10,20,0) 75%, rgba(7,10,20,0.9) 100%)'}}
			/>

			<div
				style={{
					position: 'absolute',
					top: 150,
					left: 70,
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 36,
					letterSpacing: 6,
					color: couleurs.craie,
				}}
			>
				<span
					style={{
						width: 20,
						height: 20,
						borderRadius: '50%',
						background: couleurs.rouge,
						opacity: frame % 30 < 18 ? 1 : 0.25,
						boxShadow: `0 0 18px ${couleurs.rouge}`,
					}}
				/>
				CHRONOMÉTRAGE · EN DIRECT
			</div>

			<div style={{position: 'absolute', top: 290, left: 70, right: 40}}>
				{lignes.map((_, i) => (
					<Ligne key={i} index={i} />
				))}
			</div>

			<AbsoluteFill style={{top: 1480, alignItems: 'center'}}>
				<Revele
					texte="ET UN SEUL"
					debut={12 + 8 * TEMPS}
					style={{fontFamily: polices.titre, fontSize: 120, lineHeight: 1, color: couleurs.craie}}
				/>
				<Revele
					texte="VAINQUEUR."
					debut={12 + 8 * TEMPS + 8}
					style={{fontFamily: polices.titre, fontSize: 170, lineHeight: 1, color: couleurs.jaune}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
