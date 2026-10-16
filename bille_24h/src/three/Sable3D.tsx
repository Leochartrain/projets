import React, {useMemo} from 'react';
import * as THREE from 'three';
import {noise2D} from '@remotion/noise';

// Texture de sable mouillé générée une fois (grains clairs et sombres sur fond ocre).
export const fabriquerTextures = (taille: number, plateau: number) => {
	const toile = document.createElement('canvas');
	toile.width = taille;
	toile.height = taille;
	const ctx = toile.getContext('2d')!;
	const img = ctx.createImageData(taille, taille);
	const relief = document.createElement('canvas');
	relief.width = taille;
	relief.height = taille;
	const ctxR = relief.getContext('2d')!;
	const imgR = ctxR.createImageData(taille, taille);
	let graine = 12345;
	const alea = () => {
		graine = (graine * 1664525 + 1013904223) >>> 0;
		return graine / 4294967296;
	};
	for (let y = 0; y < taille; y++) {
		for (let x = 0; x < taille; x++) {
			const i = (y * taille + x) * 4;
			const grain = alea();
			const tache = noise2D('tache', x / 90, y / 90) * 0.5 + 0.5;
			let r = 186 - tache * 26;
			let g = 136 - tache * 22;
			let b = 82 - tache * 16;
			if (grain > 0.93) {
				r += 50;
				g += 46;
				b += 36;
			} else if (grain < 0.12) {
				r -= 60;
				g -= 48;
				b -= 34;
			}
			const v = (grain - 0.5) * 18;
			img.data[i] = r + v;
			img.data[i + 1] = g + v;
			img.data[i + 2] = b + v * 0.8;
			img.data[i + 3] = 255;
			const h = 128 + (grain - 0.5) * 120 + tache * 40;
			imgR.data[i] = h;
			imgR.data[i + 1] = h;
			imgR.data[i + 2] = h;
			imgR.data[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	ctxR.putImageData(imgR, 0, 0);
	const couleur = new THREE.CanvasTexture(toile);
	couleur.colorSpace = THREE.SRGBColorSpace;
	const bosses = new THREE.CanvasTexture(relief);
	for (const t of [couleur, bosses]) {
		t.wrapS = THREE.RepeatWrapping;
		t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(plateau / 4, plateau / 4);
		t.anisotropy = 8;
	}
	return {couleur, bosses};
};

// Plateau de sable en relief, avec les petites ondulations laissées par les billes.
export const Sable3D: React.FC<{taille?: number}> = ({taille = 24}) => {
	const {couleur, bosses} = useMemo(() => fabriquerTextures(1024, taille), [taille]);
	const geometrie = useMemo(() => {
		const geo = new THREE.PlaneGeometry(taille, taille, 384, 384);
		const pos = geo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const y = pos.getY(i);
			const h = noise2D('dune', x / 3, y / 3) * 0.05 + noise2D('ride', x * 1.6, y * 1.6) * 0.012;
			pos.setZ(i, h);
		}
		geo.computeVertexNormals();
		return geo;
	}, [taille]);

	return (
		<mesh geometry={geometrie} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
			<meshStandardMaterial map={couleur} bumpMap={bosses} bumpScale={2.2} roughness={0.92} metalness={0} />
		</mesh>
	);
};
