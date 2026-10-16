import React, {useId} from 'react';

const melange = (hex: string, cible: string, t: number) => {
	const a = parseInt(hex.slice(1), 16);
	const b = parseInt(cible.slice(1), 16);
	const canal = (v: number, d: number) => Math.round(((v >> d) & 255) * (1 - t) + ((b >> d) & 255) * t);
	const r = canal(a, 16);
	const g = canal(a, 8);
	const bl = canal(a, 0);
	return `rgb(${r},${g},${bl})`;
};

type Props = {
	taille: number;
	couleur: string;
	// Rotation de la spirale intérieure (degrés) : donne l'impression que la bille roule.
	rotation?: number;
	// Ombre portée sur le sable sous la bille.
	ombre?: boolean;
	style?: React.CSSProperties;
};

// Bille « œil de chat » : verre teinté, spirale intérieure, reflets et caustique.
export const Bille: React.FC<Props> = ({taille, couleur, rotation = 0, ombre = true, style}) => {
	const id = useId().replace(/[^a-zA-Z0-9]/g, '');
	const clair = melange(couleur, '#ffffff', 0.55);
	const sombre = melange(couleur, '#000000', 0.6);
	const roulis = Math.cos((rotation * Math.PI) / 180);

	return (
		<svg
			width={taille}
			height={taille}
			viewBox="-50 -50 100 100"
			style={{overflow: 'visible', ...style}}
		>
			<defs>
				<radialGradient id={`${id}corps`} cx="38%" cy="32%" r="78%">
					<stop offset="0%" stopColor={clair} stopOpacity={1} />
					<stop offset="35%" stopColor={couleur} stopOpacity={0.92} />
					<stop offset="82%" stopColor={sombre} stopOpacity={1} />
					<stop offset="100%" stopColor="#050505" stopOpacity={1} />
				</radialGradient>
				<radialGradient id={`${id}bord`} cx="50%" cy="50%" r="50%">
					<stop offset="70%" stopColor="#000" stopOpacity={0} />
					<stop offset="100%" stopColor="#000" stopOpacity={0.55} />
				</radialGradient>
				<radialGradient id={`${id}caustique`} cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor={clair} stopOpacity={0.9} />
					<stop offset="100%" stopColor={clair} stopOpacity={0} />
				</radialGradient>
				<radialGradient id={`${id}ombre`} cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor="#000" stopOpacity={0.55} />
					<stop offset="100%" stopColor="#000" stopOpacity={0} />
				</radialGradient>
				<clipPath id={`${id}clip`}>
					<circle r={48} />
				</clipPath>
				<filter id={`${id}flou`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={1.6} />
				</filter>
				<filter id={`${id}flouFort`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={4} />
				</filter>
			</defs>

			{ombre ? <ellipse cx={14} cy={50} rx={52} ry={13} fill={`url(#${id}ombre)`} /> : null}
			{/* lumière qui traverse le verre et se colore sur le sable */}
			{ombre ? (
				<ellipse cx={20} cy={46} rx={22} ry={6} fill={`url(#${id}caustique)`} opacity={0.6} />
			) : null}

			<circle r={48} fill="#0b0b0b" />
			<circle r={48} fill={`url(#${id}corps)`} />

			<g clipPath={`url(#${id}clip)`}>
				<g transform={`rotate(${rotation}) scale(${0.55 + 0.45 * Math.abs(roulis)}, 1)`}>
					{[0, 120, 240].map((a) => (
						<path
							key={a}
							transform={`rotate(${a})`}
							d="M 0 0 C 10 -12, 30 -18, 44 -6 C 28 -10, 14 -6, 0 0 Z"
							fill={a === 0 ? '#fff' : clair}
							opacity={a === 0 ? 0.7 : 0.9}
							filter={`url(#${id}flou)`}
						/>
					))}
					<circle r={5} fill={sombre} opacity={0.6} filter={`url(#${id}flou)`} />
				</g>
			</g>

			<circle r={48} fill={`url(#${id}bord)`} />
			{/* reflet principal + reflet secondaire */}
			<ellipse
				cx={-17}
				cy={-21}
				rx={15}
				ry={9}
				transform="rotate(-35 -17 -21)"
				fill="#fff"
				opacity={0.9}
				filter={`url(#${id}flou)`}
			/>
			<ellipse cx={-22} cy={-25} rx={4} ry={2.5} transform="rotate(-35 -22 -25)" fill="#fff" />
			<ellipse
				cx={20}
				cy={26}
				rx={14}
				ry={6}
				transform="rotate(-35 20 26)"
				fill={clair}
				opacity={0.45}
				filter={`url(#${id}flouFort)`}
			/>
			<circle r={48} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={1} />
		</svg>
	);
};
