import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, staticFile} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import {Bille} from '../components/Bille';
import {Damier} from '../components/Damier';
import {Revele} from '../components/Revele';
import {TEXTURE_SABLE} from '../components/Sable';
import {Voiture} from '../components/Voiture';
import {couleurs, polices} from '../theme';

// Tracé stylisé : un serpentin qui remonte l'écran, comme la piste en planches.
const TRACE = 'M 180 1660 V 800 C 180 560 480 560 480 800 V 1300 C 480 1540 780 1540 780 1300 V 520';
const LONGUEUR = getLength(TRACE);
const METRES = 77;

const DEBUT_COURSE = 70;
const FIN_COURSE = 200;

const equipages = [
	{f: 0.16, c: couleurs.bleu, n: 12},
	{f: 0.33, c: couleurs.rouge, n: 7},
	{f: 0.52, c: couleurs.vert, n: 31},
	{f: 0.69, c: couleurs.jaune, n: 45},
	{f: 0.86, c: couleurs.craie, n: 3},
];

const point = (fraction: number) => {
	const l = Math.max(0, Math.min(LONGUEUR, fraction * LONGUEUR));
	const p = getPointAtLength(TRACE, l);
	const t = getTangentAtLength(TRACE, l) ?? {x: 0, y: -1};
	return {x: p?.x ?? 0, y: p?.y ?? 0, angle: (Math.atan2(t.y, t.x) * 180) / Math.PI + 90};
};

const avancee = (frame: number) =>
	interpolate(frame, [DEBUT_COURSE, FIN_COURSE], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.45, 0, 0.25, 1),
	});

const Etiquette: React.FC<{x: number; y: number; debut: number; texte: string; vers: 'gauche' | 'droite'}> = ({
	x,
	y,
	debut,
	texte,
	vers,
}) => {
	const frame = useImage();
	const fps = FPS_BASE;
	const p = spring({frame: frame - debut, fps, config: {damping: 200}});
	const longueurTrait = 80 * p;
	const sens = vers === 'droite' ? 1 : -1;
	return (
		<div style={{position: 'absolute', left: x, top: y, opacity: p}}>
			<div
				style={{
					position: 'absolute',
					left: sens === 1 ? 0 : -longueurTrait,
					top: 0,
					width: longueurTrait,
					height: 3,
					background: couleurs.craie,
				}}
			/>
			<div style={{position: 'absolute', left: -9, top: -8, width: 18, height: 18, borderRadius: '50%', background: couleurs.orange}} />
			<div
				style={{
					position: 'absolute',
					top: -30,
					left: sens === 1 ? longueurTrait + 14 : undefined,
					right: sens === -1 ? longueurTrait + 14 : undefined,
					whiteSpace: 'nowrap',
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 38,
					color: couleurs.craie,
					background: 'rgba(7,10,20,0.75)',
					padding: '6px 14px',
					letterSpacing: 3,
				}}
			>
				{texte}
			</div>
		</div>
	);
};

export const Piste: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;

	const trace = interpolate(frame, [4, 70], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.cubic),
	});
	const dash = `${LONGUEUR * trace} ${LONGUEUR}`;

	const a = avancee(frame);
	const bille = point(a);
	const zoom = interpolate(frame, [0, 210], [0.96, 1.03]);
	const camX = 0;
	const camY = 0;

	const pont = point(0.43);
	const pontP = spring({frame: frame - 60, fps, config: {damping: 12}});
	const depart = point(0.015);
	const arrivee = point(0.985);

	return (
		<AbsoluteFill style={{background: couleurs.encre, overflow: 'hidden'}}>
			{/* fond « plan technique » */}
			<AbsoluteFill
				style={{
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.05) 2px, transparent 2px)',
					backgroundSize: '90px 90px',
					backgroundPosition: `${-frame * 0.4}px ${frame * 0.6}px`,
				}}
			/>

			<AbsoluteFill style={{transform: `translate(${camX}px, ${camY}px) scale(${zoom})`, transformOrigin: '540px 1100px'}}>
				<svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute'}}>
					<defs>
						<mask id="masquePiste">
							<path d={TRACE} fill="none" stroke="#fff" strokeWidth={98} strokeDasharray={dash} />
						</mask>
						<filter id="ombrePiste" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation={14} />
						</filter>
					</defs>
					<path
						d={TRACE}
						fill="none"
						stroke="#000"
						strokeOpacity={0.6}
						strokeWidth={140}
						strokeDasharray={dash}
						transform="translate(14 22)"
						filter="url(#ombrePiste)"
					/>
					<path d={TRACE} fill="none" stroke={couleurs.bois} strokeWidth={128} strokeDasharray={dash} />
					<path d={TRACE} fill="none" stroke="#8A5A2E" strokeWidth={112} strokeDasharray={dash} />
					<g mask="url(#masquePiste)">
						<image href={staticFile(TEXTURE_SABLE)} width={1080} height={1920} />
					</g>
					{/* traînée de la bille dans le sable */}
					<path
						d={TRACE}
						fill="none"
						stroke="#6d4a22"
						strokeOpacity={0.55}
						strokeWidth={10}
						strokeLinecap="round"
						strokeDasharray={`${LONGUEUR * a} ${LONGUEUR}`}
					/>
				</svg>

				{/* départ et arrivée */}
				<div style={{position: 'absolute', left: depart.x - 49, top: depart.y - 10, opacity: trace > 0.02 ? 1 : 0}}>
					<Damier colonnes={8} lignes={2} case_={12.25} />
				</div>
				<div style={{position: 'absolute', left: arrivee.x - 49, top: arrivee.y - 10, opacity: trace > 0.98 ? 1 : 0}}>
					<Damier colonnes={8} lignes={2} case_={12.25} />
				</div>

				{/* pont Dunlop, vu de dessus */}
				<div
					style={{
						position: 'absolute',
						left: pont.x - 95,
						top: pont.y - 30,
						width: 190,
						height: 60,
						background: '#151515',
						borderRadius: 10,
						border: `4px solid ${couleurs.craie}`,
						transform: `scale(${pontP})`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: polices.titre,
						fontSize: 38,
						letterSpacing: 4,
						color: couleurs.jaune,
						boxShadow: '10px 16px 18px rgba(0,0,0,0.55)',
					}}
				>
					DUNLOP
				</div>

				{equipages.map((e, i) => {
					const p = point(e.f);
					const s = spring({frame: frame - 62 - i * 5, fps, config: {damping: 11}});
					return (
						<div
							key={e.n}
							style={{position: 'absolute', left: p.x - 30 + (i % 2 ? 18 : -18), top: p.y - 50, transform: `scale(${s})`}}
						>
							<Voiture couleur={e.c} numero={e.n} longueur={86} angle={p.angle} />
						</div>
					);
				})}

				{/* la bille et ses images fantômes */}
				{frame >= DEBUT_COURSE
					? new Array(10).fill(0).map((_, k) => {
							const fantome = point(avancee(frame - k * 1.2));
							const taille = 58 * (1 - k * 0.06);
							return (
								<div
									key={k}
									style={{
										position: 'absolute',
										left: fantome.x - taille / 2,
										top: fantome.y - taille / 2,
										opacity: k === 0 ? 1 : 0.32 * (1 - k / 10),
									}}
								>
									{k === 0 ? (
										<Bille taille={taille} couleur={couleurs.orange} rotation={frame * 25} />
									) : (
										// Images fantômes : un simple disque suffit, bien plus léger qu'une bille complète.
										<div style={{width: taille, height: taille, borderRadius: '50%', background: couleurs.orange}} />
									)}
								</div>
							);
						})
					: null}

				<Etiquette x={depart.x + 60} y={depart.y - 40} debut={22} texte="DÉPART" vers="droite" />
				<Etiquette x={pont.x + 100} y={pont.y} debut={72} texte="PONT DUNLOP" vers="droite" />
				<Etiquette x={arrivee.x - 60} y={arrivee.y + 10} debut={150} texte="ARRIVÉE" vers="gauche" />
			</AbsoluteFill>

			{/* en-tête */}
			<AbsoluteFill style={{top: 110, alignItems: 'center'}}>
				<div style={{fontFamily: polices.mono, fontWeight: 800, fontSize: 34, letterSpacing: 8, color: couleurs.orange}}>
					▸ LA PISTE
				</div>
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

			{/* télémétrie */}
			<div
				style={{
					position: 'absolute',
					left: 60,
					right: 60,
					bottom: 56,
					display: 'flex',
					flexDirection: 'column',
					gap: 14,
					fontFamily: polices.mono,
					fontWeight: 800,
					fontSize: 34,
					letterSpacing: 3,
					color: couleurs.craie,
					opacity: interpolate(frame, [60, 75], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
				}}
			>
				<span>
					DISTANCE <span style={{color: couleurs.jaune}}>{(a * METRES).toFixed(1).replace('.', ',')} M</span>
				</span>
				<span style={{opacity: interpolate(frame, [150, 162], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
					NOUVEAU TRACÉ <span style={{color: couleurs.orange}}>CHAQUE ANNÉE</span>
				</span>
			</div>
		</AbsoluteFill>
	);
};
