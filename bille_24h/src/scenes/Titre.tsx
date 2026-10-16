import React from 'react';
import {AbsoluteFill, interpolate, spring} from 'remotion';
import {FPS_BASE, useImage} from '../temps';
import {Bille} from '../components/Bille';
import {Damier} from '../components/Damier';
import {Revele} from '../components/Revele';
import {billes, couleurs, polices} from '../theme';

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

export const Titre: React.FC = () => {
	const frame = useImage();
	const fps = FPS_BASE;

	const impact = spring({frame, fps, config: {damping: 12, stiffness: 200, mass: 0.8}});
	const echelle24 = interpolate(impact, [0, 1], [2.6, 1]);
	const fondOrange = interpolate(frame, [0, 6], [1, 0], {extrapolateRight: 'clamp'});
	const zoom = interpolate(frame, [0, 120], [1, 1.06]);

	return (
		<AbsoluteFill style={{background: couleurs.nuit, overflow: 'hidden'}}>
			<AbsoluteFill style={{opacity: 0.07, transform: `rotate(-12deg) scale(1.4) translateX(${-frame * 1.5}px)`}}>
				<Damier colonnes={30} lignes={46} case_={60} />
			</AbsoluteFill>
			<Bandes />
			<AbsoluteFill style={{background: couleurs.orange, opacity: fondOrange}} />

			<AbsoluteFill style={{alignItems: 'center', top: 300, transform: `scale(${zoom})`}}>
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
					{billes.map((c, i) => {
						const chute = spring({frame: frame - 24 - i * 4, fps, config: {damping: 7, stiffness: 140, mass: 0.7}});
						return (
							<div
								key={c}
								style={{
									position: 'absolute',
									left: 30 + i * 150,
									top: interpolate(chute, [0, 1], [-1500, 20]),
								}}
							>
								<Bille taille={104} couleur={c} rotation={frame * 6 + i * 70} />
							</div>
						);
					})}
				</div>

				<div
					style={{
						marginTop: 40,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 18,
						opacity: interpolate(frame, [44, 54], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						transform: `translateY(${interpolate(frame, [44, 58], [30, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
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
