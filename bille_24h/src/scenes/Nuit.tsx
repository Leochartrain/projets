import React from 'react';
import {AbsoluteFill, Easing, interpolate, interpolateColors, random, spring} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Bille} from '../components/Bille';
import {Revele} from '../components/Revele';
import {couleurs, polices} from '../theme';

// Heures « dépliées » : 26 = dimanche 2h, 40,5 = dimanche 16h30.
const HEURE_DEBUT = 14.5;
const HEURE_FIN = 40.5;
const CX = 540;
const CY = 930;
const R = 360;

const evenements = [
	{h: 18, texte: 'GUINGUETTE'},
	{h: 21, texte: 'BAL · ORCHESTRE'},
	{h: 26, texte: "DJ JUSQU'À 4H"},
	{h: 30, texte: "PETIT-DÉJ'"},
	{h: 31, texte: 'VIDE-GRENIER'},
	{h: 35, texte: 'BANDA'},
	{h: 37.5, texte: 'FINALE · MANCHE 10'},
	{h: 40.5, texte: 'ARRIVÉE'},
];
const departsManches = [14.5, 17.5, 21, 24, 26, 28, 30, 32, 34, 37.5];

const cles = [14, 19, 21, 23, 28.5, 30, 32, 41];
const ciels = ['#3F86D6', '#E8834A', '#3A2A6A', '#090D26', '#090D26', '#D9776A', '#6AA5E0', '#3F86D6'];
const solsCiel = ['#A9D2F2', '#F6C36B', '#B2547A', '#141A3C', '#141A3C', '#F2B07C', '#BFE0F5', '#A9D2F2'];

const nuitAmount = (h: number) =>
	interpolate(h, [20, 22.5, 28.5, 30.5], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const angle = (h: number) => ((h % 24) / 24) * 360 - 90;
const pt = (h: number, r: number) => {
	const a = (angle(h) * Math.PI) / 180;
	return {x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r};
};

const arc = (h0: number, h1: number, r: number) => {
	const a = pt(h0, r);
	const b = pt(h1, r);
	const grand = h1 - h0 > 12 ? 1 : 0;
	if (h1 - h0 >= 23.99) return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${a.x - 0.01} ${a.y}`;
	return `M ${a.x} ${a.y} A ${r} ${r} 0 ${grand} 1 ${b.x} ${b.y}`;
};

const Pins: React.FC = () => {
	const sapins: React.ReactNode[] = [];
	for (let i = 0; i < 26; i++) {
		const x = i * 46 - 30 + random(`sx${i}`) * 20;
		const h = 150 + random(`sh${i}`) * 170;
		const l = 50 + random(`sl${i}`) * 30;
		sapins.push(<polygon key={i} points={`${x},1920 ${x + l / 2},${1920 - h} ${x + l},1920`} fill="#04060c" />);
	}
	return (
		<svg width={1080} height={1920} style={{position: 'absolute'}}>
			{sapins}
			<rect x={0} y={1880} width={1080} height={40} fill="#04060c" />
		</svg>
	);
};

const Fanions: React.FC<{h: number}> = ({h}) => {
	const frame = useImage();
	const n = 16;
	return (
		<svg width={1080} height={300} style={{position: 'absolute', top: 1500}}>
			<path d={`M -20 40 Q 540 ${150 + Math.sin(frame / 20) * 8} 1100 40`} stroke="#04060c" strokeWidth={3} fill="none" />
			{new Array(n).fill(0).map((_, i) => {
				const t = (i + 0.5) / n;
				const x = -20 + t * 1120;
				const y = (1 - t) * (1 - t) * 40 + 2 * (1 - t) * t * (150 + Math.sin(frame / 20) * 8) + t * t * 40;
				const balance = Math.sin(frame / 12 + i) * 6;
				return (
					<polygon
						key={i}
						points={`${x - 22},${y} ${x + 22},${y} ${x + balance},${y + 46}`}
						fill={i % 2 ? '#04060c' : interpolateColors(nuitAmount(h), [0, 1], ['#f4efe4', '#3a3f55'])}
					/>
				);
			})}
		</svg>
	);
};

export const Nuit: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;

	const h = interpolate(frame, [18, 190], [HEURE_DEBUT, HEURE_FIN], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.sin),
	});
	const nuit = nuitAmount(h);
	const ciel = interpolateColors(h, cles, ciels);
	const sol = interpolateColors(h, cles, solsCiel);

	const heures = Math.floor(h % 24);
	const minutes = Math.floor(((h % 1) * 60) / 5) * 5;
	const horaire = `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	const jour = h < 24 ? 'SAMEDI' : 'DIMANCHE';
	const manche = departsManches.filter((d) => d <= h + 0.001).length;

	const bout = pt(h, R);
	const apparition = spring({frame, fps, config: {damping: 200}});
	const passes = evenements.filter((e) => e.h <= h + 0.01);

	return (
		<AbsoluteFill style={{background: `linear-gradient(180deg, ${ciel} 0%, ${sol} 100%)`, overflow: 'hidden'}}>
			{/* étoiles */}
			<AbsoluteFill style={{opacity: nuit}}>
				{new Array(90).fill(0).map((_, i) => (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: random(`ex${i}`) * 1080,
							top: random(`ey${i}`) * 1500,
							width: 2 + random(`et${i}`) * 4,
							height: 2 + random(`et${i}`) * 4,
							borderRadius: '50%',
							background: '#fff',
							opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 9 + i)),
						}}
					/>
				))}
			</AbsoluteFill>

			<Pins />
			<Fanions h={h} />

			{/* cadran des 24 heures */}
			<svg width={1080} height={1920} style={{position: 'absolute', transform: `scale(${apparition})`, transformOrigin: `${CX}px ${CY}px`}}>
				<circle cx={CX} cy={CY} r={R + 70} fill="rgba(7,10,20,0.55)" />
				<circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(247,242,232,0.2)" strokeWidth={26} />
				{h - HEURE_DEBUT >= 23.99 ? (
					<circle cx={CX} cy={CY} r={R} fill="none" stroke={couleurs.orange} strokeWidth={26} />
				) : (
					<path d={arc(HEURE_DEBUT, Math.max(HEURE_DEBUT + 0.01, h), R)} fill="none" stroke={couleurs.orange} strokeWidth={26} strokeLinecap="round" />
				)}
				{new Array(24).fill(0).map((_, i) => {
					const a = pt(i, R + 42);
					const b = pt(i, R + (i % 6 === 0 ? 62 : 52));
					return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={couleurs.craie} strokeWidth={i % 6 === 0 ? 5 : 2} />;
				})}
				{[0, 6, 12, 18].map((i) => {
					const p = pt(i, R - 58);
					return (
						<text
							key={i}
							x={p.x}
							y={p.y}
							textAnchor="middle"
							dominantBaseline="central"
							fontFamily={polices.mono}
							fontWeight={800}
							fontSize={30}
							fill="rgba(247,242,232,0.6)"
						>
							{i}H
						</text>
					);
				})}
				{evenements.map((e) => {
					const p = pt(e.h, R);
					const actif = e.h <= h + 0.01;
					return <circle key={e.h} cx={p.x} cy={p.y} r={actif ? 11 : 8} fill={actif ? couleurs.jaune : 'rgba(247,242,232,0.5)'} />;
				})}
			</svg>

			<div style={{position: 'absolute', left: bout.x - 42, top: bout.y - 42, transform: `scale(${apparition})`}}>
				<Bille taille={84} couleur={couleurs.orange} rotation={frame * 12} ombre={false} />
			</div>

			{/* heure au centre */}
			<AbsoluteFill style={{alignItems: 'center', top: CY - 190}}>
				<div style={{fontFamily: polices.mono, fontWeight: 800, fontSize: 38, letterSpacing: 10, color: couleurs.sableClair}}>{jour}</div>
				<div style={{fontFamily: polices.titre, fontSize: 210, lineHeight: 1.05, color: couleurs.craie, fontVariantNumeric: 'tabular-nums'}}>
					{horaire}
				</div>
				<div
					style={{
						fontFamily: polices.mono,
						fontWeight: 800,
						fontSize: 34,
						letterSpacing: 4,
						color: couleurs.nuit,
						background: couleurs.jaune,
						padding: '4px 18px',
					}}
				>
					MANCHE {manche}/10
				</div>
			</AbsoluteFill>

			{/* en-tête */}
			<AbsoluteFill style={{top: 120, alignItems: 'center'}}>
				<Revele texte="24 HEURES." debut={4} style={{fontFamily: polices.titre, fontSize: 130, lineHeight: 1, color: couleurs.craie}} />
				<Revele
					texte="ON NE DORT PAS."
					debut={14}
					decalage={1}
					style={{fontFamily: polices.titre, fontSize: 130, lineHeight: 1, color: couleurs.jaune}}
				/>
			</AbsoluteFill>

			{/* programme qui défile : les trois derniers rendez-vous */}
			<div style={{position: 'absolute', top: 1470, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
				{passes.slice(-2).map((e, i, liste) => {
					const recent = i === liste.length - 1;
					const hh = Math.floor(e.h % 24);
					const mm = Math.round((e.h % 1) * 60);
					return (
						<div
							key={e.h}
							style={{
								display: 'flex',
								gap: 22,
								alignItems: 'center',
								fontFamily: polices.titre,
								fontSize: recent ? 78 : 50,
								color: recent ? couleurs.craie : 'rgba(247,242,232,0.55)',
								background: recent ? 'rgba(7,10,20,0.75)' : 'transparent',
								padding: '2px 26px',
								transform: 'skewX(-8deg)',
							}}
						>
							<span style={{fontFamily: polices.mono, fontWeight: 800, fontSize: recent ? 44 : 32, color: couleurs.orange}}>
								{String(hh).padStart(2, '0')}H{mm ? String(mm).padStart(2, '0') : ''}
							</span>
							{e.texte}
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
