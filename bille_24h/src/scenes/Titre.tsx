import React from 'react';
import {AbsoluteFill, interpolate, spring} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Bille} from '../components/Bille';
import {Damier} from '../components/Damier';
import {Revele} from '../components/Revele';
import {billes, couleurs, courbes, polices} from '../theme';

const Bandes: React.FC = () => {
	const frame = useImage();
	const teintes = [couleurs.orange, couleurs.jaune, couleurs.craie];
	return (
		<AbsoluteFill style={{transform: 'rotate(-28deg) scale(1.6)', opacity: 0.95}}>
			{teintes.map((t, i) => {
				const p = interpolate(frame, [i * 3, 14 + i * 3], [-1400, 0], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				});
				return (
					<div
						key={t}
						style={{
							position: 'absolute',
							left: p + frame * 2,
							top: 1640 + i * 46,
							width: 2600,
							height: 30,
							background: t,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// Chute libre puis rebonds amortis sur le sol (jamais à travers) : hauteur au-dessus du sol en px,
// vitesse relative (1 = vitesse du premier impact) et écrasement au contact.
const CHUTE = 1500;
const DUREE_CHUTE = 7;
const RESTITUTION = 0.42;
const G = (2 * CHUTE) / DUREE_CHUTE ** 2;
const V0 = G * DUREE_CHUTE;

const rebond = (t: number) => {
	if (t <= 0) return {hauteur: CHUTE, vitesse: 0, ecrasement: 0};
	if (t < DUREE_CHUTE) return {hauteur: CHUTE - 0.5 * G * t * t, vitesse: (G * t) / V0, ecrasement: 0};
	let debut = DUREE_CHUTE;
	let v = V0;
	for (let i = 0; i < 5; i++) {
		// l'écrasement vient de l'impact qu'on vient de subir, proportionnel à sa vitesse
		const ecrasement = (v / V0) * Math.max(0, 1 - (t - debut) / 3);
		v *= RESTITUTION;
		const duree = (2 * v) / G;
		if (t < debut + duree) {
			const u = t - debut;
			return {hauteur: v * u - 0.5 * G * u * u, vitesse: Math.abs(v - G * u) / V0, ecrasement};
		}
		debut += duree;
	}
	return {hauteur: 0, vitesse: 0, ecrasement: 0};
};

const BilleQuiTombe: React.FC<{couleur: string; index: number}> = ({couleur, index}) => {
	const frame = useImage();
	const {hauteur, vitesse, ecrasement} = rebond(frame - 24 - index * 4);
	const taille = 104;
	// Écrasée au contact, étirée quand elle file : elle a du poids.
	const sx = ecrasement > 0 ? 1 + 0.24 * ecrasement : 1 - 0.08 * vitesse;
	const sy = ecrasement > 0 ? 1 - 0.24 * ecrasement : 1 + 0.16 * vitesse;
	const proche = 1 - Math.min(1, hauteur / 500);
	return (
		<div style={{position: 'absolute', left: 30 + index * 150, top: 20, width: taille, height: taille}}>
			<div
				style={{
					position: 'absolute',
					left: taille * 0.08,
					top: taille - 12,
					width: taille * 0.84,
					height: 24,
					borderRadius: '50%',
					background: 'radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0))',
					transform: `scaleX(${0.4 + 0.6 * proche + 0.2 * ecrasement})`,
					opacity: proche,
				}}
			/>
			<div style={{transform: `translateY(${-hauteur}px) scale(${sx}, ${sy})`, transformOrigin: '50% 100%'}}>
				<Bille taille={taille} couleur={couleur} rotation={frame * 6 + index * 70} ombre={false} />
			</div>
		</div>
	);
};

export const Titre: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;

	const impact = spring({frame, fps, config: {damping: 12, stiffness: 200, mass: 0.8}});
	const echelle24 = interpolate(impact, [0, 1], [2.6, 1]);
	const fondOrange = interpolate(frame, [0, 6], [1, 0], {extrapolateRight: 'clamp'});
	const zoom = interpolate(frame, [0, 120], [1, 1.06]);
	// Secousse quand le « 24 » touche : le choc se transmet à tout le plan, puis s'amortit.
	const choc = frame > 3 ? Math.exp(-(frame - 3) * 0.32) : 0;
	const secousseX = choc * 16 * Math.sin((frame - 3) * 2.3);
	const secousseY = choc * 10 * Math.cos((frame - 3) * 1.7);

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<AbsoluteFill style={{opacity: 0.07, transform: `rotate(-12deg) scale(1.4) translateX(${-frame * 1.5}px)`}}>
				<Damier colonnes={30} lignes={46} case_={60} />
			</AbsoluteFill>
			<Bandes />
			<AbsoluteFill style={{background: couleurs.orange, opacity: fondOrange}} />

			<AbsoluteFill style={{alignItems: 'center', top: 300, transform: `translate(${secousseX}px, ${secousseY}px) scale(${zoom})`}}>
				<div
					style={{
						fontFamily: polices.titre,
						fontSize: 660,
						lineHeight: 0.86,
						color: couleurs.craie,
						transform: `scale(${echelle24}) skewX(-8deg)`,
						opacity: interpolate(impact, [0, 0.2], [0, 1], {extrapolateRight: 'clamp'}),
						textShadow: `18px 18px 0 ${couleurs.orange}`,
						letterSpacing: -10,
					}}
				>
					24
				</div>
				<Revele
					texte="HEURES"
					debut={8}
					decalage={2}
					style={{
						fontFamily: polices.titre,
						fontSize: 236,
						lineHeight: 0.95,
						color: couleurs.craie,
						letterSpacing: 8,
						transform: 'skewX(-8deg)',
					}}
				/>
				<div
					style={{
						marginTop: 18,
						padding: '6px 36px 10px',
						background: couleurs.jaune,
						transform: `skewX(-8deg) scaleX(${spring({frame: frame - 16, fps, config: {damping: 200}})})`,
						transformOrigin: 'left center',
					}}
				>
					<Revele
						texte="DE LA BILLE"
						debut={20}
						decalage={2}
						style={{fontFamily: polices.titre, fontSize: 148, lineHeight: 1, color: couleurs.nuit, letterSpacing: 4}}
					/>
				</div>

				{/* les billes tombent et rebondissent sous le titre */}
				<div style={{position: 'relative', width: 760, height: 150, marginTop: 30}}>
					{billes.map((c, i) => (
						<BilleQuiTombe key={c} couleur={c} index={i} />
					))}
				</div>

				<div
					style={{
						marginTop: 40,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 18,
						opacity: interpolate(frame, [44, 52], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						transform: `translateY(${interpolate(frame, [44, 58], [40, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: courbes.entree})}px)`,
					}}
				>
					<div
						style={{
							fontFamily: polices.mono,
							fontWeight: 800,
							fontSize: 44,
							color: couleurs.nuit,
							background: couleurs.craie,
							padding: '8px 26px',
							letterSpacing: 6,
						}}
					>
						23<sup style={{fontSize: 26}}>E</sup> ÉDITION
					</div>
					<div style={{fontFamily: polices.texte, fontWeight: 700, fontSize: 38, color: couleurs.sableClair, letterSpacing: 5}}>
						SAINT-MARS-DE-LOCQUENAY · SARTHE
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
