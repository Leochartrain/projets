// Outils communs : hasard déterministe, bruit, maths, morceaux de GLSL.
import * as THREE from 'three';

export const SEED = 20261110;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sat = (x) => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = (t) => { t = sat(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - sat(t), 3);
export const easeIn = (t) => Math.pow(sat(t), 3);
export const fract = (x) => x - Math.floor(x);

export function hash(ix, iy, s = 0) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x, y, oct = 5, s = 0, lac = 2.03, gain = 0.5) {
  let v = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { v += a * vnoise(x, y, s + i * 17); n += a; x *= lac; y *= lac; a *= gain; }
  return v / n;
}

export function ridged(x, y, oct = 5, s = 0) {
  let v = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(2 * vnoise(x, y, s + i * 31) - 1);
    v += a * r * r; n += a; x *= 2.07; y *= 2.07; a *= 0.5;
  }
  return v / n;
}

// Bruit 1D lisse et déterministe (secousses de caméra, tremblements).
export function noise1(t, s = 0) { return vnoise(t, s * 7.31 + 0.5, s) * 2 - 1; }

// Direction du soleil : levant, bas, dans l'axe de la vallée (+X).
export const SUN_EL = 9.5 * Math.PI / 180;
export const SUN_AZ = 5 * Math.PI / 180;
export const SUN = new THREE.Vector3(
  Math.cos(SUN_EL) * Math.cos(SUN_AZ), Math.sin(SUN_EL), Math.cos(SUN_EL) * Math.sin(SUN_AZ)).normalize();

const f = (v) => v.toFixed(5);
export const GLSL_SUN = `const vec3 SUN = vec3(${f(SUN.x)}, ${f(SUN.y)}, ${f(SUN.z)});
const vec3 SUNCOL = vec3(1.0, 0.68, 0.38);
`;

export const GLSL_NOISE = `
float h11(float n){ return fract(sin(n)*43758.5453123); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p=fract(p*vec3(.1031,.11369,.13787)); p+=dot(p,p.yzx+19.19); return fract((p.x+p.y)*p.z); }
vec3 h33(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453123); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float vn3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm2(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vn2(p); p=p*2.03+vec2(17.3,9.1); a*=.5; } return v; }
float fbm3(vec3 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*vn3(p); p=p*2.03+vec3(7.3,19.1,3.7); a*=.5; } return v; }
// Cellules de Voronoï 3D : x = distance au bord de l'écaille, y = identifiant.
vec2 voro3(vec3 p){ vec3 i=floor(p), f=fract(p); float d1=8., d2=8., id=0.;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g=vec3(float(x),float(y),float(z)); vec3 o=h33(i+g); vec3 r=g+o-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; id=o.x; } else if(d<d2){ d2=d; } }
  return vec2(sqrt(d2)-sqrt(d1), id); }
// Relief procédural : perturbe la normale à partir d'une hauteur (dérivées écran).
vec3 bumpN(vec3 N, vec3 P, float h, float k){
  vec3 dpdx=dFdx(P), dpdy=dFdy(P); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpdy,N), r2=cross(N,dpdx); float det=dot(dpdx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2);
  return normalize(abs(det)*N - k*g); }
`;

// Uniformes partagés par tous les shaders (temps, tremblement du sol...).
export const U = {
  uTime: { value: 0 },
  uQuake: { value: 0 },
  uWet: { value: 0 },
};

// Injection de code dans les matériaux standards de Three.js.
export function patch(mat, o) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, o.uniforms || {});
    const rep = (src, key, code, before = false) =>
      code ? src.replace(key, before ? code + '\n' + key : key + '\n' + code) : src;
    let v = sh.vertexShader, fr = sh.fragmentShader;
    v = rep(v, '#include <common>', o.vpars);
    v = rep(v, '#include <begin_vertex>', o.vbegin);
    v = rep(v, '#include <project_vertex>', o.vend);
    fr = rep(fr, '#include <common>', o.fpars);
    if (o.sunShadow) fr = rep(fr, '#include <shadowmap_pars_fragment>', GLSL_SUNSHADOW);
    fr = rep(fr, '#include <color_fragment>', o.fcolor);
    fr = rep(fr, '#include <roughnessmap_fragment>', o.frough);
    fr = rep(fr, '#include <normal_fragment_maps>', o.fnormal);
    fr = rep(fr, '#include <opaque_fragment>', o.fend, true);
    sh.vertexShader = v; sh.fragmentShader = fr;
  };
  mat.customProgramCacheKey = () => o.key || 'patched';
  return mat;
}

// Ombre du soleil relue dans un shader injecté (translucidité, peau).
export const GLSL_SUNSHADOW = `
float sunShadow(){
  float sh = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow dls = directionalLightShadows[0];
    sh = getShadow( directionalShadowMap[0], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[0] );
  #endif
  return sh;
}
`;
