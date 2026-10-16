import React from 'react';
import {AbsoluteFill, interpolate, spring} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Damier} from '../components/Damier';
import {Revele} from '../components/Revele';
import {couleurs, polices, TEMPS} from '../theme';

const Jour: React.FC<{n: string; debut: number}> = ({n, debut}) => {
	const frame = useImage();
	const fps = FPS_BASE;
	const s = spring({frame: frame - debut, fps, config: {damping: 10, stiffness: 180}});
	return (
		<span
			style={{
				display: 'inline-block',
				transform: `scale(${s}) rotate(${(1 - s) * -20}deg)`,
				opacity: s > 0.01 ? 1 : 0,
			}}
		>
			{n}
		</span>
	);
};

export const Dates: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;
	const descente = spring({frame, fps, config: {damping: 18}});

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			{/* drapeau à damier qui flotte */}
			<div
				style={{
					position: 'absolute',
					top: interpolate(descente, [0, 1], [-700, 90]),
					left: -40,
					transform: 'rotate(-4deg)',
				}}
			>
				<Damier colonnes={20} lignes={9} case_={60} phase={frame * 0.28} amplitude={24} />
			</div>
			<AbsoluteFill
				style={{background: 'linear-gradient(180deg, rgba(7,10,20,0) 0%, rgba(7,10,20,0) 28%, rgba(7,10,20,1) 40%)'}}
			/>

			<AbsoluteFill style={{top: 820, alignItems: 'center'}}>
				<div
					style={{
						fontFamily: polices.titre,
						fontSize: 250,
						lineHeight: 1,
						color: couleurs.craie,
						display: 'flex',
						gap: 26,
						alignItems: 'center',
					}}
				>
					<Jour n="21" debut={TEMPS} />
					<span style={{color: couleurs.orange, fontSize: 120}}>·</span>
					<Jour n="22" debut={TEMPS + 8} />
					<span style={{color: couleurs.orange, fontSize: 120}}>·</span>
					<Jour n="23" debut={TEMPS + 16} />
				</div>
				<Revele
					texte="MAI 2027"
					debut={2 * TEMPS + 6}
					style={{fontFamily: polices.titre, fontSize: 210, lineHeight: 1, color: couleurs.orange, letterSpacing: 6}}
				/>
				<div style={{height: 50}} />
				<Revele
					texte="SAINT-MARS-DE-LOCQUENAY"
					debut={4 * TEMPS}
					decalage={1}
					style={{fontFamily: polices.texte, fontWeight: 900, fontSize: 58, letterSpacing: 3, color: couleurs.craie}}
				/>
				<Revele
					texte="VAL-DE-LA-HUNE · SARTHE"
					debut={4 * TEMPS + 10}
					decalage={1}
					style={{fontFamily: polices.mono, fontWeight: 800, fontSize: 38, letterSpacing: 6, color: couleurs.sableClair, marginTop: 14}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
