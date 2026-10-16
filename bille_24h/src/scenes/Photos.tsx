import React from 'react';
import {AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useVideoConfig} from 'remotion';
import {enImages, FPS_BASE, useImage} from '../temps';
import {Revele} from '../components/Revele';
import {couleurs, polices, TEMPS} from '../theme';

// Photos du Comité des Fêtes (dossier public/club, non versionné).
const plans = [
	{fichier: 'club/joueur-45.jpg', legende: 'CONCENTRATION MAXIMALE', dossard: '45', origine: '55% 60%', de: 1.08, a: 1.22},
	{fichier: 'club/pont-dunlop.jpg', legende: 'LE PASSAGE DU PONT', dossard: '20', origine: '45% 50%', de: 1.35, a: 1.15},
	{fichier: 'club/vue-ensemble.jpg', legende: 'TOUT LE VILLAGE EST LÀ', dossard: '72', origine: '50% 62%', de: 1.25, a: 1.1},
];
const DUREE_PLAN = 4 * TEMPS;

const Coins: React.FC = () => {
	const t = 70;
	const e = 6;
	const coin = (style: React.CSSProperties) => (
		<div style={{position: 'absolute', width: t, height: t, borderColor: couleurs.craie, borderStyle: 'solid', borderWidth: 0, ...style}} />
	);
	return (
		<AbsoluteFill style={{margin: 50, opacity: 0.85}}>
			{coin({top: 0, left: 0, borderTopWidth: e, borderLeftWidth: e})}
			{coin({top: 0, right: 100, borderTopWidth: e, borderRightWidth: e})}
			{coin({bottom: 100, left: 0, borderBottomWidth: e, borderLeftWidth: e})}
			{coin({bottom: 100, right: 100, borderBottomWidth: e, borderRightWidth: e})}
		</AbsoluteFill>
	);
};

const Plan: React.FC<{index: number}> = ({index}) => {
	const frame = useImage();
	const fps = FPS_BASE;
	const p = plans[index];
	const zoom = interpolate(frame, [0, DUREE_PLAN + 10], [p.de, p.a]);
	const flash = interpolate(frame, [0, 5], [0.7, 0], {extrapolateRight: 'clamp'});
	const bandeau = spring({frame: frame - 6, fps, config: {damping: 16}});

	return (
		<AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
			<Img
				src={staticFile(p.fichier)}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					objectPosition: p.origine,
					transform: `scale(${zoom})`,
					transformOrigin: p.origine,
					filter: 'contrast(1.12) saturate(1.15)',
				}}
			/>
			{/* étalonnage chaud + dégradé pour la lisibilité */}
			<AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(7,10,20,0.55) 0%, rgba(7,10,20,0) 30%, rgba(7,10,20,0) 55%, rgba(7,10,20,0.85) 100%)'}} />
			<AbsoluteFill style={{background: couleurs.orange, mixBlendMode: 'soft-light', opacity: 0.35}} />
			<Coins />

			<div
				style={{
					position: 'absolute',
					left: 50,
					bottom: 300,
					transform: `translateX(${interpolate(bandeau, [0, 1], [-900, 0])}px) skewX(-8deg)`,
					display: 'flex',
					alignItems: 'stretch',
				}}
			>
				<div
					style={{
						background: couleurs.craie,
						color: couleurs.nuit,
						fontFamily: polices.titre,
						fontSize: 78,
						padding: '4px 24px',
						display: 'flex',
						alignItems: 'center',
					}}
				>
					#{p.dossard}
				</div>
				<div
					style={{
						background: couleurs.orange,
						color: couleurs.craie,
						fontFamily: polices.titre,
						fontSize: 78,
						padding: '4px 30px',
						letterSpacing: 2,
					}}
				>
					{p.legende}
				</div>
			</div>
			<AbsoluteFill style={{background: '#fff', opacity: flash}} />
		</AbsoluteFill>
	);
};

export const Photos: React.FC = () => {
	const frame = useImage();
	const fin = plans.length * DUREE_PLAN;
	const {fps: fpsReel} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{plans.map((_, i) => (
				<Sequence
					key={i}
					from={enImages(i * DUREE_PLAN, fpsReel)}
					durationInFrames={enImages(i === plans.length - 1 ? 999 : DUREE_PLAN, fpsReel)}
				>
					<Plan index={i} />
				</Sequence>
			))}

			{/* bandeau « en direct » permanent */}
			<div
				style={{
					position: 'absolute',
					top: 120,
					left: 80,
					display: 'flex',
					alignItems: 'center',
					gap: 16,
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 36,
					letterSpacing: 5,
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
					}}
				/>
				EN DIRECT · ÉDITION 2026
			</div>

			<AbsoluteFill style={{top: 1660, alignItems: 'center'}}>
				<Revele
					texte="SÉRIEUX. MAIS PAS TROP."
					debut={fin - 3 * TEMPS}
					decalage={1}
					style={{fontFamily: polices.titre, fontSize: 104, color: couleurs.jaune, letterSpacing: 2}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const DUREE_PHOTOS = plans.length * DUREE_PLAN + 2 * TEMPS;
