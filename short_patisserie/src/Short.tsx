import React from 'react';
import {
	AbsoluteFill,
	Img,
	interpolate,
	OffthreadVideo,
	Sequence,
	spring,
	staticFile,
	getStaticFiles,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import {Plan, PLANS} from './plan';

export const FPS = 30;
export const DUREE_SHORT = PLANS.reduce((total, p) => total + Math.round(p.duree * FPS), 0);

const {fontFamily} = loadFont('normal', {weights: ['600', '700'], subsets: ['latin', 'latin-ext']});

const VIDEO = /\.(mp4|mov|webm|m4v)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;

// Le rush peut être une vidéo ou une photo, quelle que soit son extension.
const trouverRush = (rush: string) => {
	const base = 'rushes/' + rush.replace(/\.[^.]+$/, '') + '.';
	return getStaticFiles().find((f) => f.name.startsWith(base) && (VIDEO.test(f.name) || IMAGE.test(f.name)));
};

// Bois de la planche, en dégradés : sert de fond tant qu'il n'y a pas de rush.
const Planche: React.FC = () => (
	<AbsoluteFill
		style={{
			background: [
				'repeating-linear-gradient(97deg, rgba(0,0,0,0.10) 0 3px, transparent 3px 22px)',
				'repeating-linear-gradient(93deg, rgba(255,220,180,0.06) 0 9px, transparent 9px 47px)',
				'radial-gradient(ellipse at 30% 40%, #8a4a2b 0%, #6b3520 45%, #4a2414 100%)',
			].join(','),
		}}
	/>
);

const CarteAFilmer: React.FC<{plan: Plan; numero: number}> = ({plan, numero}) => {
	const frame = useCurrentFrame();
	const flotte = Math.sin(frame / 12) * 10;
	return (
		<AbsoluteFill>
			<Planche />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
				<div style={{fontSize: 300, transform: `translateY(${flotte}px)`, filter: 'drop-shadow(0 30px 30px rgba(0,0,0,0.35))'}}>
					{plan.emoji}
				</div>
			</AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 70,
					right: 70,
					bottom: 260,
					padding: '34px 40px',
					borderRadius: 28,
					background: 'rgba(255,248,240,0.92)',
					color: '#4a2414',
					fontFamily,
					fontWeight: 600,
					fontSize: 38,
					lineHeight: 1.35,
				}}
			>
				<div style={{fontWeight: 700, fontSize: 30, letterSpacing: 2, opacity: 0.6, marginBottom: 10}}>
					PLAN {numero}/{PLANS.length} · À FILMER
				</div>
				{plan.aFilmer}
			</div>
		</AbsoluteFill>
	);
};

// Léger zoom continu, comme une caméra à la main qui s'approche.
const Rush: React.FC<{fichier: string; duree: number}> = ({fichier, duree}) => {
	const frame = useCurrentFrame();
	const zoom = interpolate(frame, [0, duree], [1.04, 1.12]);
	const style: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`};
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{VIDEO.test(fichier) ? <OffthreadVideo src={staticFile(fichier)} muted style={style} /> : <Img src={staticFile(fichier)} style={style} />}
		</AbsoluteFill>
	);
};

// Sous-titre façon TikTok : blanc, centré dans le tiers haut, ombre douce.
const SousTitre: React.FC<{texte: string}> = ({texte}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const entree = spring({frame, fps, config: {damping: 14, stiffness: 180}, durationInFrames: 10});
	return (
		<div
			style={{
				position: 'absolute',
				top: 300,
				left: 110,
				right: 110,
				textAlign: 'center',
				color: '#fff',
				fontFamily,
				fontWeight: 600,
				fontSize: 58,
				lineHeight: 1.22,
				textShadow: '0 2px 6px rgba(0,0,0,0.55), 0 0 22px rgba(0,0,0,0.35)',
				opacity: entree,
				transform: `scale(${interpolate(entree, [0, 1], [0.92, 1])})`,
			}}
		>
			{texte}
		</div>
	);
};

export const Short: React.FC = () => {
	let debut = 0;
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{PLANS.map((plan, i) => {
				const duree = Math.round(plan.duree * FPS);
				const from = debut;
				debut += duree;
				const fichier = trouverRush(plan.rush)?.name;
				return (
					<Sequence key={plan.rush} from={from} durationInFrames={duree} name={plan.rush}>
						{fichier ? <Rush fichier={fichier} duree={duree} /> : <CarteAFilmer plan={plan} numero={i + 1} />}
						<SousTitre texte={plan.texte} />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
