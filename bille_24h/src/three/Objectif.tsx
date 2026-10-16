import React, {useLayoutEffect, useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {BokehPass} from 'three/examples/jsm/postprocessing/BokehPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

type Props = {
	// Distance de mise au point (unités de la scène, depuis la caméra).
	mise_au_point: number;
	// Ouverture : plus c'est grand, plus le flou d'arrière-plan est fort.
	ouverture?: number;
	halo?: number;
};

// « Objectif de cinéma » : profondeur de champ + halo lumineux sur les reflets.
// Remplace le rendu normal de la scène (priorité 1 dans la boucle de R3F).
export const Objectif: React.FC<Props> = ({mise_au_point, ouverture = 0.004, halo = 0.45}) => {
	const {gl, scene, camera, size} = useThree();

	const {composer, bokeh, bloom} = useMemo(() => {
		const c = new EffectComposer(gl);
		c.addPass(new RenderPass(scene, camera));
		const b = new BokehPass(scene, camera, {focus: mise_au_point, aperture: ouverture, maxblur: 0.025});
		c.addPass(b);
		const u = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), halo, 0.6, 0.82);
		c.addPass(u);
		c.addPass(new OutputPass());
		return {composer: c, bokeh: b, bloom: u};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gl, scene, camera]);

	useLayoutEffect(() => {
		composer.setSize(size.width, size.height);
		composer.setPixelRatio(gl.getPixelRatio());
	}, [composer, gl, size.width, size.height]);

	useLayoutEffect(() => {
		const u = bokeh.uniforms as Record<string, {value: number}>;
		u.focus.value = mise_au_point;
		u.aperture.value = ouverture;
		bloom.strength = halo;
	});

	useLayoutEffect(() => () => composer.dispose(), [composer]);

	useFrame(() => {
		composer.render();
	}, 1);

	return null;
};
