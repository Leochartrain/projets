import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Revele} from '../components/Revele';
import {couleurs, courbes, polices, TEMPS} from '../theme';

const stats = [
	{valeur: 45, suffixe: '', titre: 'ÉQUIPAGES', sous: 'AU DÉPART', couleur: couleurs.orange, encre: couleurs.nuit},
	{valeur: 135, suffixe: '', titre: 'JOUEURS', sous: 'SUR LA GRILLE', couleur: couleurs.jaune, encre: couleurs.nuit},
	{valeur: 10, suffixe: '', titre: 'MANCHES', sous: 'DE JOUR COMME DE NUIT', couleur: couleurs.vert, encre: couleurs.nuit},
	{valeur: 7, suffixe: 'H', titre: 'DE TIR', sous: 'POUR CHAQUE JOUEUR', couleur: couleurs.rouge, encre: couleurs.craie},
];
const DEBUT = 6;
const DUREE_STAT = 2 * TEMPS;
const FIN_STATS = DEBUT + stats.length * DUREE_STAT;

// Tour de chronométrage en fond, qui défile comme sur un écran de course.
const TourChrono: React.FC<{encre: string}> = ({encre}) => {
	const frame = useImage();
	return (
		<AbsoluteFill style={{opacity: 0.1, transform: `translateY(${-frame * 4}px) rotate(-8deg) scale(1.3)`}}>
			{new Array(70).fill(0).map((_, i) => (
				<div
					key={i}
					style={{
						display: 'flex',
						gap: 40,
						padding: '6px 60px',
						fontFamily: polices.mono,
						fontWeight: 800,
						fontSize: 40,
						color: encre,
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

// Un chiffre plein écran : fond de couleur qui balaie, nombre qui s'écrase en comptant.
const Stat: React.FC<{index: number}> = ({index}) => {
	const frame = useImage();
	const s = stats[index];
	const debut = DEBUT + index * DUREE_STAT;
	const t = frame - debut;
	if (t < -4 || t > DUREE_STAT + 6) return null;

	const balayage = interpolate(t, [-4, 4], [100, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const impact = spring({frame: t, fps: FPS_BASE, config: {damping: 11, stiffness: 220, mass: 0.7}});
	const compte = Math.round(
		interpolate(t, [0, 14], [0, s.valeur], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}),
	);
	const flou = interpolate(t, [0, 6], [14, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{clipPath: `inset(${balayage}% 0 0 0)`, background: s.couleur}}>
			<TourChrono encre={s.encre} />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
				<div
					style={{
						fontFamily: polices.titre,
						fontSize: s.valeur >= 100 ? 470 : 560,
						lineHeight: 0.9,
						color: s.encre,
						transform: `scale(${interpolate(impact, [0, 1], [1.8, 1])}) skewX(-8deg)`,
						filter: `blur(${flou}px)`,
						fontVariantNumeric: 'tabular-nums',
						letterSpacing: -8,
					}}
				>
					{compte}
					{s.suffixe}
				</div>
				<Revele
					texte={s.titre}
					debut={debut + 4}
					decalage={1}
					style={{fontFamily: polices.titre, fontSize: 150, lineHeight: 1, color: s.encre, letterSpacing: 4, marginTop: 10}}
				/>
				<div
					style={{
						marginTop: 24,
						fontFamily: polices.mono,
						fontWeight: 800,
						fontSize: 38,
						letterSpacing: 6,
						color: s.couleur,
						background: s.encre,
						padding: '6px 20px',
						opacity: interpolate(t, [8, 11], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						transform: `translateY(${interpolate(t, [8, 16], [24, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: courbes.entree})}px)`,
					}}
				>
					{s.sous}
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const Chiffres: React.FC = () => {
	const frame = useImage();
	const final = frame >= FIN_STATS - 4;
	const rideau = interpolate(frame, [FIN_STATS - 4, FIN_STATS + 4], [100, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			{stats.map((_, i) => (
				<Stat key={i} index={i} />
			))}

			{/* bandeau chrono permanent */}
			<div
				style={{
					position: 'absolute',
					top: 140,
					left: 0,
					right: 0,
					display: 'flex',
					justifyContent: 'center',
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 34,
					letterSpacing: 6,
					color: couleurs.craie,
				}}
			>
				<span style={{background: couleurs.nuit, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 16}}>
					<span
						style={{
							width: 18,
							height: 18,
							borderRadius: '50%',
							background: couleurs.rouge,
							opacity: frame % 30 < 18 ? 1 : 0.25,
							boxShadow: `0 0 18px ${couleurs.rouge}`,
						}}
					/>
					CHRONOMÉTRAGE · EN DIRECT
				</span>
			</div>

			{final ? (
				<AbsoluteFill
					style={{background: couleurs.nuit, alignItems: 'center', justifyContent: 'center', clipPath: `inset(0 0 ${rideau}% 0)`}}
				>
					<Revele texte="ET UN SEUL" debut={FIN_STATS} style={{fontFamily: polices.titre, fontSize: 150, lineHeight: 1, color: couleurs.craie}} />
					<Revele
						texte="VAINQUEUR."
						debut={FIN_STATS + 8}
						style={{fontFamily: polices.titre, fontSize: 205, lineHeight: 1, color: couleurs.jaune}}
					/>
				</AbsoluteFill>
			) : null}
		</AbsoluteFill>
	);
};
