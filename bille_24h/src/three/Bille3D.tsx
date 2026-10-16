import React, {useMemo} from 'react';
import * as THREE from 'three';

// Ailettes de l'« œil de chat » : trois pétales courbes pris dans le verre.
const usePetale = () =>
	useMemo(() => {
		// Feuille dessinée dans le plan (rayon, profondeur), puis redressée et vrillée :
		// chaque ailette traverse la bille en profondeur, comme dans le vrai verre.
		const forme = new THREE.Shape();
		forme.moveTo(0, 0);
		forme.bezierCurveTo(0.22, 0.2, 0.62, 0.17, 0.9, 0);
		forme.bezierCurveTo(0.62, -0.17, 0.22, -0.2, 0, 0);
		const geo = new THREE.ShapeGeometry(forme, 48);
		const pos = geo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const profondeur = pos.getY(i);
			const vrille = x * 1.6;
			pos.setXYZ(i, x, Math.sin(vrille) * profondeur * 0.5 + Math.sin(x * 3) * 0.06, Math.cos(vrille) * profondeur);
		}
		geo.computeVertexNormals();
		return geo;
	}, []);

type Props = {
	couleur: string;
	rayon?: number;
	position?: [number, number, number];
	// Rotation de roulement (radians) autour de l'axe donné.
	roulis?: number;
	axe?: [number, number, number];
};

// Ombre de contact : un disque sombre et flou sous la bille, qui la pose sur le sol.
const textureContact = () => {
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 128;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
	g.addColorStop(0, 'rgba(0,0,0,0.85)');
	g.addColorStop(0.35, 'rgba(0,0,0,0.45)');
	g.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
};

// Bille en verre physique : transmission, réfraction, vernis, et ailettes colorées à l'intérieur.
export const Bille3D: React.FC<Props> = ({couleur, rayon = 1, position = [0, rayon, 0], roulis = 0, axe = [1, 0, 0]}) => {
	const petale = usePetale();
	const contact = useMemo(textureContact, []);
	const quaternion = useMemo(
		() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axe).normalize(), roulis),
		[axe, roulis],
	);
	const teinte = useMemo(() => new THREE.Color(couleur), [couleur]);
	const verre = useMemo(() => teinte.clone().lerp(new THREE.Color('#ffffff'), 0.75), [teinte]);

	return (
		<group position={position} scale={rayon}>
			<mesh position={[0, -0.985, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[1.5, 1.5]} />
				<meshBasicMaterial map={contact} transparent depthWrite={false} />
			</mesh>
			<mesh castShadow>
				<sphereGeometry args={[1, 128, 128]} />
				<meshPhysicalMaterial
					color={verre}
					transmission={1}
					thickness={1.6}
					roughness={0.03}
					ior={1.52}
					attenuationColor={teinte}
					attenuationDistance={2.4 * rayon}
					clearcoat={1}
					clearcoatRoughness={0.02}
					specularIntensity={1}
					envMapIntensity={1.4}
				/>
			</mesh>
			<group quaternion={quaternion}>
				{[0, 1, 2].map((i) => (
					<mesh key={i} geometry={petale} rotation={[0, 0, (i * Math.PI * 2) / 3]} scale={0.92}>
						<meshStandardMaterial
							color={couleur}
							emissive={couleur}
							emissiveIntensity={0.55}
							roughness={0.35}
							side={THREE.DoubleSide}
						/>
					</mesh>
				))}
				<mesh>
					<sphereGeometry args={[0.07, 24, 24]} />
					<meshStandardMaterial color={teinte.clone().multiplyScalar(0.4)} />
				</mesh>
			</group>
		</group>
	);
};
