import React from 'react';
import {polices} from '../theme';

type Props = {
	couleur: string;
	numero: number;
	// Longueur de la voiture en pixels (vue de dessus, avant vers le haut).
	longueur?: number;
	angle?: number;
	style?: React.CSSProperties;
};

// Miniature 1/24e vue de dessus, aux couleurs d'un équipage.
export const Voiture: React.FC<Props> = ({couleur, numero, longueur = 90, angle = 0, style}) => {
	const l = longueur;
	const w = l * 0.48;
	return (
		<svg
			width={w}
			height={l}
			viewBox="-24 -50 48 100"
			style={{overflow: 'visible', transform: `rotate(${angle}deg)`, ...style}}
		>
			<ellipse cx={4} cy={6} rx={26} ry={50} fill="#000" opacity={0.35} />
			{/* roues */}
			{[-32, 30].map((y) => (
				<g key={y}>
					<rect x={-25} y={y - 9} width={7} height={18} rx={2} fill="#151515" />
					<rect x={18} y={y - 9} width={7} height={18} rx={2} fill="#151515" />
				</g>
			))}
			<path
				d="M -18 -40 C -18 -48, 18 -48, 18 -40 L 21 30 C 21 46, -21 46, -21 30 Z"
				fill={couleur}
				stroke="#000"
				strokeOpacity={0.35}
				strokeWidth={1.2}
			/>
			{/* bandes de course */}
			<rect x={-4} y={-46} width={8} height={90} fill="#fff" opacity={0.85} />
			{/* pare-brise et lunette */}
			<path d="M -14 -18 L 14 -18 L 11 -5 L -11 -5 Z" fill="#1c2a3a" />
			<path d="M -13 16 L 13 16 L 11 24 L -11 24 Z" fill="#1c2a3a" />
			<rect x={-12} y={-4} width={24} height={20} rx={3} fill={couleur} />
			<circle cx={0} cy={6} r={8} fill="#fff" />
			<text
				x={0}
				y={6}
				textAnchor="middle"
				dominantBaseline="central"
				fontFamily={polices.titre}
				fontSize={11}
				fill="#111"
			>
				{numero}
			</text>
			<path d="M -16 -40 C -10 -45, 10 -45, 16 -40" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
		</svg>
	);
};
