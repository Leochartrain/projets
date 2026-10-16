import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {random} from 'remotion';

type Props = {
	// Temps écoulé depuis le tir (en images à 30 i/s) ; négatif = rien.
	t: number;
	origine: [number, number, number];
	nombre?: number;
};

// Gerbe de grains de sable soulevée par le tir, avec gravité et rebond au sol.
export const Gerbe3D: React.FC<Props> = ({t, origine, nombre = 700}) => {
	const ref = useRef<THREE.InstancedMesh>(null);
	const grains = useMemo(
		() =>
			new Array(nombre).fill(0).map((_, i) => {
				const angle = (random(`g3a${i}`) - 0.5) * 2.4;
				const montee = 0.4 + random(`g3m${i}`) * 1.6;
				const vitesse = 0.02 + random(`g3v${i}`) * 0.07;
				return {
					vx: Math.sin(angle) * vitesse,
					vy: montee * vitesse,
					vz: Math.cos(angle) * vitesse * 0.9,
					taille: 0.5 + random(`g3t${i}`) * 1.3,
				};
			}),
		[nombre],
	);
	const matrice = useMemo(() => new THREE.Matrix4(), []);

	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		grains.forEach((g, i) => {
			const tt = Math.max(0, t);
			let y = origine[1] + g.vy * tt - 0.0016 * tt * tt;
			const x = origine[0] + g.vx * tt;
			const z = origine[2] + g.vz * tt;
			y = Math.max(0.01, y);
			const s = t < 0 ? 0 : g.taille * Math.max(0, 1 - tt / 70);
			matrice.makeScale(s, s, s);
			matrice.setPosition(x, y, z);
			mesh.setMatrixAt(i, matrice);
		});
		mesh.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh ref={ref} args={[undefined, undefined, nombre]} castShadow>
			<icosahedronGeometry args={[0.006, 0]} />
			<meshStandardMaterial color="#a87a45" roughness={1} toneMapped={false} />
		</instancedMesh>
	);
};
