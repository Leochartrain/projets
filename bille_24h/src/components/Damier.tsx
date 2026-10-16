import React from 'react';

type Props = {
	colonnes: number;
	lignes: number;
	case_: number;
	// Ondulation du drapeau : phase en radians (0 = drapeau plat).
	phase?: number;
	amplitude?: number;
	clair?: string;
	sombre?: string;
	style?: React.CSSProperties;
};

// Damier de course ; avec une phase, il ondule comme un drapeau à l'arrivée.
export const Damier: React.FC<Props> = ({
	colonnes,
	lignes,
	case_,
	phase,
	amplitude = 0,
	clair = '#F7F2E8',
	sombre = '#0b0b0b',
	style,
}) => {
	const cases: React.ReactNode[] = [];
	for (let x = 0; x < colonnes; x++) {
		const onde = phase === undefined ? 0 : Math.sin(x * 0.45 - phase);
		const pente = phase === undefined ? 0 : Math.cos(x * 0.45 - phase);
		const dy = onde * amplitude;
		// Ombrage selon la pente de la vague : le drapeau prend du volume.
		const lumiere = 1 + pente * 0.22;
		for (let y = 0; y < lignes; y++) {
			const noir = (x + y) % 2 === 0;
			cases.push(
				<rect
					key={`${x}-${y}`}
					x={x * case_}
					y={y * case_ + dy}
					width={case_ + 0.6}
					height={case_ + 0.6}
					fill={noir ? sombre : clair}
					style={{filter: `brightness(${lumiere})`}}
				/>,
			);
		}
	}
	return (
		<svg
			width={colonnes * case_}
			height={lignes * case_ + amplitude * 2}
			viewBox={`0 ${-amplitude} ${colonnes * case_} ${lignes * case_ + amplitude * 2}`}
			style={{overflow: 'visible', ...style}}
		>
			{cases}
		</svg>
	);
};
