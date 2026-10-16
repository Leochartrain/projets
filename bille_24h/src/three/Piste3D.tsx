import React, {useMemo} from 'react';
import * as THREE from 'three';
import {fabriquerTextures} from './Sable3D';

export const HAUTEUR_TABLE = 0.7;
export const LARGEUR_PISTE = 0.9;

// Le serpentin de la piste, posé à plat (plan XZ) à hauteur des tables.
export const tracePiste = (() => {
	const pts: [number, number][] = [
		[0, 6],
		[0, -3],
		[0.4, -4.6],
		[1.4, -5.2],
		[2.4, -4.6],
		[2.8, -3],
		[2.8, 3],
		[3.2, 4.6],
		[4.2, 5.2],
		[5.2, 4.6],
		[5.6, 3],
		[5.6, -6],
	];
	return new THREE.CatmullRomCurve3(
		pts.map(([x, z]) => new THREE.Vector3(x, HAUTEUR_TABLE, z)),
		false,
		'centripetal',
	);
})();

// Point, direction et côté de la piste à une fraction donnée (0 = départ, 1 = arrivée).
export const repere = (f: number) => {
	const u = Math.min(1, Math.max(0, f));
	const p = tracePiste.getPointAt(u);
	const t = tracePiste.getTangentAt(u).setY(0).normalize();
	const cote = new THREE.Vector3(-t.z, 0, t.x);
	return {p, t, cote};
};

// Extrude un profil (décalage latéral, hauteur) le long de la piste.
const ruban = (profil: [number, number][], echantillons = 900, repetition = 1) => {
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const longueur = tracePiste.getLength();
	for (let i = 0; i <= echantillons; i++) {
		const {p, cote} = repere(i / echantillons);
		profil.forEach(([lat, h], j) => {
			positions.push(p.x + cote.x * lat, p.y + h, p.z + cote.z * lat);
			uvs.push((j / (profil.length - 1)) * repetition, ((i / echantillons) * longueur) / LARGEUR_PISTE * repetition);
		});
	}
	const n = profil.length;
	for (let i = 0; i < echantillons; i++) {
		for (let j = 0; j < n - 1; j++) {
			const a = i * n + j;
			const b = a + n;
			indices.push(a, b, a + 1, a + 1, b, b + 1);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return geo;
};

const damierTexture = () => {
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 64;
	const ctx = c.getContext('2d')!;
	for (let x = 0; x < 8; x++)
		for (let y = 0; y < 2; y++) {
			ctx.fillStyle = (x + y) % 2 ? '#f4efe4' : '#111';
			ctx.fillRect(x * 32, y * 32, 32, 32);
		}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
};

const panneauTexture = (texte: string, fond: string, encre: string) => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 128;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = fond;
	ctx.fillRect(0, 0, 512, 128);
	ctx.fillStyle = encre;
	ctx.font = 'bold 96px Anton, Impact, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(texte, 256, 70);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
};

const Ligne: React.FC<{f: number}> = ({f}) => {
	const tex = useMemo(damierTexture, []);
	const {p, t} = repere(f);
	return (
		<mesh position={[p.x, p.y + 0.031, p.z]} rotation={[-Math.PI / 2, 0, Math.atan2(t.x, t.z)]}>
			<planeGeometry args={[LARGEUR_PISTE, LARGEUR_PISTE / 4]} />
			<meshStandardMaterial map={tex} roughness={0.8} />
		</mesh>
	);
};

// Le pont Dunlop : une arche noire qui enjambe la piste.
const Pont: React.FC<{f: number}> = ({f}) => {
	const tex = useMemo(() => panneauTexture('DUNLOP', '#111', '#FFC928'), []);
	const {p, t} = repere(f);
	const angle = Math.atan2(t.x, t.z);
	return (
		<group position={[p.x, p.y, p.z]} rotation={[0, angle, 0]}>
			{[-1, 1].map((s) => (
				<mesh key={s} position={[s * 0.55, 0.3, 0]} castShadow>
					<boxGeometry args={[0.08, 0.6, 0.12]} />
					<meshStandardMaterial color="#151515" roughness={0.6} />
				</mesh>
			))}
			<mesh position={[0, 0.66, 0]} castShadow>
				<boxGeometry args={[1.26, 0.26, 0.12]} />
				<meshStandardMaterial color="#151515" roughness={0.5} />
			</mesh>
			{[1, -1].map((s) => (
				<mesh key={s} position={[0, 0.66, s * 0.062]} rotation={[0, s === 1 ? 0 : Math.PI, 0]}>
					<planeGeometry args={[1.18, 0.24]} />
					<meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.35} />
				</mesh>
			))}
		</group>
	);
};

// Voiture 1/24e très simplifiée, aux couleurs d'un équipage.
export const Voiture3D: React.FC<{f: number; couleur: string; decalage?: number}> = ({f, couleur, decalage = 0}) => {
	const {p, t, cote} = repere(f);
	const angle = Math.atan2(t.x, t.z);
	return (
		<group position={[p.x + cote.x * decalage, p.y + 0.03, p.z + cote.z * decalage]} rotation={[0, angle, 0]} scale={0.55}>
			<mesh position={[0, 0.09, 0]} castShadow>
				<boxGeometry args={[0.36, 0.12, 0.78]} />
				<meshPhysicalMaterial color={couleur} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
			</mesh>
			<mesh position={[0, 0.19, -0.04]} castShadow>
				<boxGeometry args={[0.3, 0.1, 0.36]} />
				<meshPhysicalMaterial color="#141c26" roughness={0.1} clearcoat={1} />
			</mesh>
			<mesh position={[0, 0.155, 0]}>
				<boxGeometry args={[0.07, 0.005, 0.79]} />
				<meshStandardMaterial color="#f4efe4" />
			</mesh>
			{[
				[-0.19, 0.25],
				[0.19, 0.25],
				[-0.19, -0.25],
				[0.19, -0.25],
			].map(([x, z]) => (
				<mesh key={`${x}${z}`} position={[x, 0.06, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.065, 0.065, 0.06, 20]} />
					<meshStandardMaterial color="#111" roughness={0.8} />
				</mesh>
			))}
		</group>
	);
};

// La piste complète : lit de sable, bordures en bois, pieds des tables, départ, arrivée, pont.
export const Piste3D: React.FC = () => {
	const longueur = tracePiste.getLength();
	const {sable, bois, pieds} = useMemo(() => {
		const tex = fabriquerTextures(1024, 1);
		tex.couleur.repeat.set(1, 1);
		tex.bosses.repeat.set(1, 1);
		const demi = LARGEUR_PISTE / 2;
		const sableGeo = ruban(
			[
				[-demi, 0.03],
				[demi, 0.03],
			],
			900,
			0.25,
		);
		const boisGeo = ruban(
			[
				[demi, 0.03],
				[demi, 0.12],
				[demi + 0.07, 0.12],
				[demi + 0.07, -0.08],
				[-demi - 0.07, -0.08],
				[-demi - 0.07, 0.12],
				[-demi, 0.12],
				[-demi, 0.03],
			],
			900,
			0.2,
		);
		const p: THREE.Vector3[] = [];
		const n = Math.floor(longueur / 1.3);
		for (let i = 0; i <= n; i++) {
			const {p: c, cote} = repere(i / n);
			for (const s of [-1, 1]) p.push(new THREE.Vector3(c.x + cote.x * s * (demi + 0.02), 0, c.z + cote.z * s * (demi + 0.02)));
		}
		return {sable: {geo: sableGeo, ...tex}, bois: boisGeo, pieds: p};
	}, [longueur]);

	return (
		<group>
			<mesh geometry={sable.geo} receiveShadow>
				<meshStandardMaterial map={sable.couleur} bumpMap={sable.bosses} bumpScale={1.2} roughness={0.95} side={THREE.DoubleSide} />
			</mesh>
			<mesh geometry={bois} castShadow receiveShadow>
				<meshStandardMaterial color="#9a6a3c" roughness={0.7} side={THREE.DoubleSide} />
			</mesh>
			{pieds.map((p, i) => (
				<mesh key={i} position={[p.x, HAUTEUR_TABLE / 2 - 0.05, p.z]} castShadow>
					<cylinderGeometry args={[0.035, 0.04, HAUTEUR_TABLE - 0.1, 10]} />
					<meshStandardMaterial color="#6b4524" roughness={0.9} />
				</mesh>
			))}
			<Ligne f={0.01} />
			<Ligne f={0.99} />
			<Pont f={0.43} />
		</group>
	);
};
