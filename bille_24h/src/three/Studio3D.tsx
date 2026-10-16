import React, {useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

// Environnement de reflets (une pièce virtuelle éclairée) : indispensable pour que le verre brille.
export const Reflets: React.FC<{intensite?: number}> = ({intensite = 0.6}) => {
	const {gl, scene} = useThree();
	useLayoutEffect(() => {
		const pmrem = new THREE.PMREMGenerator(gl);
		const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		scene.environment = env;
		scene.environmentIntensity = intensite;
		return () => {
			env.dispose();
			pmrem.dispose();
		};
	}, [gl, scene, intensite]);
	return null;
};

// Caméra pilotée image par image (position + point visé).
export const Camera: React.FC<{position: [number, number, number]; cible: [number, number, number]; fov?: number}> = ({
	position,
	cible,
	fov = 28,
}) => {
	const {camera, size} = useThree();
	useLayoutEffect(() => {
		const cam = camera as THREE.PerspectiveCamera;
		cam.position.set(...position);
		cam.fov = fov;
		cam.aspect = size.width / size.height;
		cam.near = 0.05;
		cam.far = 100;
		cam.lookAt(...cible);
		cam.updateProjectionMatrix();
	});
	return null;
};

// Projecteur orienté vers un point précis (la cible doit faire partie de la scène).
export const Projecteur: React.FC<{
	position: [number, number, number];
	cible: [number, number, number];
	intensite: number;
	couleur?: string;
	angle?: number;
	ombres?: boolean;
}> = ({position, cible, intensite, couleur = '#ffe2b8', angle = 0.6, ombres = true}) => {
	const lumiere = React.useMemo(() => new THREE.SpotLight(), []);
	useLayoutEffect(() => {
		lumiere.position.set(...position);
		lumiere.target.position.set(...cible);
		lumiere.target.updateMatrixWorld();
		lumiere.intensity = intensite;
		lumiere.color.set(couleur);
		lumiere.angle = angle;
		lumiere.penumbra = 0.7;
		lumiere.decay = 1.2;
		lumiere.castShadow = ombres;
		lumiere.shadow.mapSize.set(2048, 2048);
		lumiere.shadow.bias = -0.0005;
	});
	return (
		<>
			<primitive object={lumiere} />
			<primitive object={lumiere.target} />
		</>
	);
};
