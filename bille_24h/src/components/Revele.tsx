import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {
	texte: string;
	debut?: number;
	// Décalage entre deux éléments (images).
	decalage?: number;
	// Découpe par lettre ou par mot.
	par?: 'lettre' | 'mot';
	// Image à laquelle le texte repart (vers le haut).
	sortie?: number;
	style?: React.CSSProperties;
	// Style appliqué à certains mots (index de mot → style).
	accents?: Record<number, React.CSSProperties>;
};

// Texte qui monte depuis un cache, élément par élément, avec un ressort sec.
export const Revele: React.FC<Props> = ({
	texte,
	debut = 0,
	decalage = 2,
	par = 'lettre',
	sortie,
	style,
	accents = {},
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const mots = texte.split(' ');
	let index = 0;

	const sortieP =
		sortie === undefined
			? 0
			: interpolate(frame, [sortie, sortie + 10], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				});

	return (
		<div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', ...style}}>
			{mots.map((mot, m) => {
				const morceaux = par === 'lettre' ? Array.from(mot) : [mot];
				return (
					<span
						key={m}
						style={{
							display: 'inline-flex',
							overflow: 'hidden',
							paddingBottom: '0.06em',
							paddingTop: '0.16em',
							marginTop: '-0.16em',
							marginRight: m < mots.length - 1 ? '0.25em' : 0,
							...accents[m],
						}}
					>
						{morceaux.map((c, i) => {
							const delai = debut + index++ * decalage;
							const p = spring({frame: frame - delai, fps, config: {damping: 16, stiffness: 160, mass: 0.6}});
							const y = interpolate(p, [0, 1], [110, 0]) - sortieP * 110;
							return (
								<span
									key={i}
									style={{
										display: 'inline-block',
										transform: `translateY(${y}%) rotate(${(1 - p) * 6}deg)`,
										whiteSpace: 'pre',
									}}
								>
									{c}
								</span>
							);
						})}
					</span>
				);
			})}
		</div>
	);
};
