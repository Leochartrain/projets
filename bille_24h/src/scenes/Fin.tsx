import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Revele} from '../components/Revele';
import {Bille3D} from '../three/Bille3D';
import {Plateau3D} from '../three/Plateau3D';
import {billes, couleurs, courbes, polices, TEMPS} from '../theme';

export const DUREE_FIN = 10 * TEMPS;

export const Fin: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;
	const logo = spring({frame: frame - 4, fps, config: {damping: 9, stiffness: 120}});
	const noir = interpolate(frame, [DUREE_FIN - 14, DUREE_FIN], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const bas = interpolate(frame, [3 * TEMPS, 3 * TEMPS + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: courbes.entree});
	const voile = interpolate(frame, [TEMPS - 6, TEMPS + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			{/* les cinq billes tournent en rond sur le sable, comme un tour d'honneur */}
			<Plateau3D camera={{position: [0, 9, 3.6], cible: [0, 0, 1.3], fov: 30}} mise_au_point={9.4} ouverture={0.003} halo={0.55} exposition={0.95}>
				{billes.map((c, i) => {
					const arrivee = spring({frame: frame - 6 - i * 3, fps, config: {damping: 16}});
					const angle = (i / billes.length) * Math.PI * 2 + frame / 45;
					const r = 1.05 * arrivee + 6 * (1 - arrivee);
					return (
						<Bille3D
							key={c}
							couleur={c}
							rayon={0.2}
							position={[Math.cos(angle) * r, 0.19, Math.sin(angle) * r]}
							roulis={(angle * r) / 0.2}
							axe={[Math.cos(angle), 0, Math.sin(angle)]}
						/>
					);
				})}
			</Plateau3D>

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

			{/* voile sombre sous les textes : ils restent lisibles sur le sable clair */}
			<AbsoluteFill
				style={{
					background: 'linear-gradient(180deg, rgba(7,10,20,0) 44%, rgba(7,10,20,0.72) 58%, rgba(7,10,20,0.9) 100%)',
					opacity: voile,
				}}
			/>

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
					fontSize: 25,
					lineHeight: 1.5,
					color: 'rgba(247,242,232,0.78)',
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
