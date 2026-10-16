import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Bille} from '../components/Bille';
import {Revele} from '../components/Revele';
import {Sable} from '../components/Sable';
import {billes, couleurs, polices, TEMPS} from '../theme';

export const DUREE_FIN = 10 * TEMPS;

export const Fin: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;
	const logo = spring({frame: frame - 4, fps, config: {damping: 9, stiffness: 120}});
	const noir = interpolate(frame, [DUREE_FIN - 14, DUREE_FIN], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const bas = interpolate(frame, [3 * TEMPS, 3 * TEMPS + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<Sable lumiere={{x: 50, y: 32, rayon: 75}} />

			{/* billes qui gravitent autour de la mascotte */}
			{billes.map((c, i) => {
				const a = (i / billes.length) * Math.PI * 2 + frame / 40;
				const r = 400 + Math.sin(frame / 18 + i) * 20;
				const s = spring({frame: frame - 10 - i * 3, fps, config: {damping: 14}});
				return (
					<div
						key={c}
						style={{
							position: 'absolute',
							left: 540 + Math.cos(a) * r * s - 40,
							top: 600 + Math.sin(a) * r * 0.55 * s - 40,
							zIndex: Math.sin(a) > 0 ? 2 : 0,
						}}
					>
						<Bille taille={80} couleur={c} rotation={frame * 10 + i * 50} ombre={false} />
					</div>
				);
			})}

			<div
				style={{
					position: 'absolute',
					left: 540 - 380,
					top: 600 - 240,
					width: 760,
					height: 480,
					transform: `scale(${logo}) rotate(${(1 - logo) * -12}deg)`,
					zIndex: 1,
					filter: 'drop-shadow(0 24px 30px rgba(0,0,0,0.55))',
				}}
			>
				<Img src={staticFile('club/logo.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
			</div>

			<AbsoluteFill style={{top: 1000, alignItems: 'center'}}>
				<Revele
					texte="INSCRIPTIONS"
					debut={TEMPS}
					style={{fontFamily: polices.titre, fontSize: 150, lineHeight: 1, color: couleurs.craie, letterSpacing: 2}}
				/>
				<Revele
					texte="BIENTÔT OUVERTES"
					debut={TEMPS + 8}
					decalage={1}
					style={{fontFamily: polices.titre, fontSize: 116, lineHeight: 1.05, color: couleurs.jaune}}
				/>
				<div
					style={{
						marginTop: 60,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 20,
						opacity: bas,
						transform: `translateY(${(1 - bas) * 30}px)`,
					}}
				>
					<div
						style={{
							fontFamily: polices.mono,
							fontWeight: 800,
							fontSize: 38,
							color: couleurs.nuit,
							background: couleurs.craie,
							padding: '10px 26px',
						}}
					>
						24heuresdelabille-sarthe.com
					</div>
					<div style={{fontFamily: polices.titre, fontSize: 64, color: couleurs.orange, letterSpacing: 2}}>#24HBILLE2027</div>
				</div>
			</AbsoluteFill>

			<div
				style={{
					position: 'absolute',
					bottom: 70,
					width: '100%',
					textAlign: 'center',
					fontFamily: polices.texte,
					fontWeight: 500,
					fontSize: 22,
					lineHeight: 1.5,
					color: 'rgba(247,242,232,0.6)',
					opacity: bas,
				}}
			>
				Comité des Fêtes de Saint-Mars-de-Locquenay
				<br />
				« 24 Heures » avec l'aimable autorisation de l'Automobile Club de l'Ouest
				<br />
				<span style={{color: couleurs.sableClair, fontWeight: 700}}>Vidéo : Léo Chartrain</span>
			</div>

			<AbsoluteFill style={{background: '#000', opacity: noir}} />
		</AbsoluteFill>
	);
};
