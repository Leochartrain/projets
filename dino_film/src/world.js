// Le décor : ciel, brume, soleil, terrain érodé, rivière, rochers.
import * as THREE from 'three';
import { rng, SEED, fbm, ridged, vnoise, smooth, clamp, SUN, GLSL_SUN, GLSL_NOISE, U, patch } from './util.js';

export const WORLD = { x0: -460, x1: 460, z0: -300, z1: 300, cell: 1.5 };
export const riverZ = (x) => 10 * Math.sin(x / 90) + 3 * Math.sin(x / 31 + 1.3);
export const riverSlope = (x) => (10 / 90) * Math.cos(x / 90) + (3 / 31) * Math.cos(x / 31 + 1.3);
// Rocher du plan final et berge boueuse du gros plan.
export const ROCK = { x: 96, z: riverZ(96) - 14 };
export const PATCH = { x: 48, z: riverZ(48) - 13.5, half: 5 };

function rawHeight(x, z) {
  const wx = x + (fbm(x * 0.008, z * 0.008, 3, 5) - 0.5) * 40;
  const wz = z + (fbm(x * 0.008 + 9, z * 0.008 + 4, 3, 6) - 0.5) * 40;
  const ad = Math.abs(z - riverZ(x));
  let h = -0.24 * (1 - smooth(2.5, 11.5, ad));
  h += (fbm(x * 0.25, z * 0.25, 3, 11) - 0.5) * 0.1 * (1 - smooth(8, 16, ad));
  h += smooth(10, 24, ad) * 0.9;
  h += smooth(16, 60, ad) * (1.2 + (fbm(x * 0.03, z * 0.03, 4, 21) - 0.4) * 5.0);
  h += (fbm(x * 0.15, z * 0.15, 3, 22) - 0.5) * 0.5 * smooth(12, 30, ad);
  const adw = Math.abs(wz - riverZ(wx));
  h += Math.pow(Math.max(adw - 45, 0) / 120, 1.8) * 26;
  const c = smooth(135, 178, adw + (fbm(x * 0.02, z * 0.02, 3, 31) - 0.5) * 50);
  h += c * (85 + ridged(wx * 0.012, wz * 0.012, 5, 41) * 90 + fbm(x * 0.05, z * 0.05, 3, 43) * 14);
  h += c * ridged(x * 0.045, z * 0.045, 4, 45) * 26;
  return h;
}

let NX, NZ, H;
export function buildHeights() {
  const { x0, x1, z0, z1, cell } = WORLD;
  NX = Math.round((x1 - x0) / cell) + 1; NZ = Math.round((z1 - z0) / cell) + 1;
  H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = rawHeight(x0 + i * cell, z0 + j * cell);
  // Érosion thermique : les pentes trop raides s'éboulent vers le bas (éboulis au pied des falaises).
  const talus = cell * 1.25;
  for (let pass = 0; pass < 7; pass++) {
    for (let j = 1; j < NZ - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i, h = H[k];
      if (h < 6) continue;
      let lo = k, dm = 0;
      for (const n of [k - 1, k + 1, k - NX, k + NX]) { const d = h - H[n]; if (d > dm) { dm = d; lo = n; } }
      if (dm > talus) { const m = (dm - talus) * 0.28; H[k] -= m; H[lo] += m; }
    }
  }
  return H;
}

export function rockH(x, z) {
  const dx = x - ROCK.x, dz = z - ROCK.z, r = Math.hypot(dx * 0.82, dz);
  if (r > 9) return 0;
  const a = Math.atan2(dz, dx), rr = r * (1 + 0.2 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7 + 2) + 0.25 * (fbm(x * 0.5, z * 0.5, 3, 53) - 0.5));
  const body = 1 - smooth(3.4, 5.6, rr); if (body <= 0) return 0;
  const top = 1.95 + 0.3 * fbm(x * 0.6, z * 0.6, 3, 51) + 0.16 * ridged(x * 1.3, z * 1.3, 3, 52);
  const steps = Math.floor(body * 3.2 + fbm(x * 0.9, z * 0.9, 2, 54)) / 3.2; // gradins de basalte
  return Math.pow(body, 0.5) * top * (0.72 + 0.28 * Math.min(1, steps + 0.35));
}
export function groundY(x, z) { return baseY(x, z) + rockH(x, z); }
function baseY(x, z) {
  const { x0, z0, cell } = WORLD;
  const fx = clamp((x - x0) / cell, 0, NX - 1.001), fz = clamp((z - z0) / cell, 0, NZ - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NX + i;
  return H[k] * (1 - u) * (1 - v) + H[k + 1] * u * (1 - v) + H[k + NX] * (1 - u) * v + H[k + NX + 1] * u * v;
}

// ---------- Brume : remplace le brouillard standard par une brume de vallée dorée à contre-jour.
export function installFog() {
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG\n varying vec3 vFogV;\n#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG\n vFogV = mvPosition.xyz;\n#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying vec3 vFogV;
  #ifdef FOG_EXP2
   uniform float fogDensity;
  #else
   uniform float fogNear; uniform float fogFar;
  #endif
  vec3 dinoFogColor(vec3 d){
    vec3 S = vec3(${SUN.x.toFixed(5)}, ${SUN.y.toFixed(5)}, ${SUN.z.toFixed(5)});
    float sd = max(dot(d, S), 0.0);
    vec3 warm = vec3(1.0, 0.60, 0.27);
    return fogColor * (1.0 + 0.5 * d.y) + warm * (pow(sd, 4.0) * 0.55 + pow(sd, 28.0) * 1.5);
  }
  vec3 dinoFog(vec3 col, vec3 v){
    #ifdef FOG_EXP2
    vec3 w = transpose(mat3(viewMatrix)) * v; float dist = length(w); vec3 d = w / max(dist, 1e-4);
    const float b = 0.055;
    float x = clamp(b * d.y * dist, -30.0, 30.0);
    float k = abs(x) < 1e-3 ? 1.0 : (1.0 - exp(-x)) / x;
    float od = fogDensity * exp(-b * max(cameraPosition.y, -5.0)) * dist * k + fogDensity * 0.035 * dist;
    float f = 1.0 - exp(-od);
    return mix(col, dinoFogColor(d), f);
    #else
    return col;
    #endif
  }
#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG\n gl_FragColor.rgb = dinoFog(gl_FragColor.rgb, vFogV);\n#endif`;
}

export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDisc: { value: 1 } }]),
    vertexShader: `varying vec3 vDir; #include <fog_pars_vertex>
      void main(){ vDir = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; #include <fog_vertex>
      }`.replace(/#include/g, '\n#include'),
    fragmentShader: (`uniform float uDisc; varying vec3 vDir;
      ${GLSL_SUN} ${GLSL_NOISE}
      #include <fog_pars_fragment>
      void main(){
        vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(vec3(0.62,0.44,0.30), vec3(0.06,0.15,0.33), pow(h, 0.45));
        float sd = max(dot(d, SUN), 0.0);
        c += SUNCOL * (pow(sd, 6.0) * 0.45 + pow(sd, 48.0) * 1.4 + pow(sd, 500.0) * 5.0);
        vec2 cp = d.xz / (d.y + 0.14) * 1.5;
        float cl = smoothstep(0.48, 0.82, fbm2(cp * vec2(1.0, 2.7) + 3.0)) * smoothstep(0.03, 0.22, d.y);
        vec3 clc = mix(vec3(0.42,0.30,0.30), SUNCOL * 2.6, pow(sd, 2.5));
        c = mix(c, clc, cl * 0.6);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        gl_FragColor.rgb += SUNCOL * 60.0 * uDisc * smoothstep(0.99990, 0.99996, dot(d, SUN));
      }`).replace(/#include/g, '\n#include'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), mat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  return sky;
}

// ---------- Sol (terrain + zone détaillée du gros plan).
const GROUND_FCOLOR = `
  vec3 P = vW; float dcam = length(vViewPosition);
  float n1 = fbm2(P.xz * 0.35), n2 = fbm2(P.xz * 2.7), n3 = fbm2(P.xz * 14.0);
  float slope = 1.0 - normalize(vNw).y;
  vec3 mud = mix(vec3(0.075,0.054,0.036), vec3(0.135,0.10,0.066), n2);
  vec3 litter = mix(vec3(0.06,0.046,0.026), vec3(0.12,0.09,0.045), n2);
  vec3 moss = mix(vec3(0.03,0.062,0.014), vec3(0.075,0.12,0.03), n3);
  vec3 ground = mix(litter, moss, smoothstep(0.42, 0.62, n1 + n3 * 0.2));
  float strata = sin(P.y * 1.6 + n1 * 7.0) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.040,0.040,0.046), vec3(0.105,0.10,0.095), fbm2(P.xz * 0.9 + P.y * 0.5)) * (0.75 + 0.35 * strata);
  rock = mix(rock, vec3(0.07,0.10,0.04), smoothstep(0.6, 0.8, fbm2(P.xz * 0.2 + 7.0)) * 0.5);
  float gWet = 1.0 - smoothstep(0.05, 0.95, P.y + (n2 - 0.5) * 0.3);
  float gRock = max(smoothstep(0.26, 0.48, slope + (n2 - 0.5) * 0.14), vRock);
  float peb = smoothstep(0.60, 0.70, vn2(P.xz * 9.0)) * smoothstep(0.55, 0.4, vn2(P.xz * 0.6 + 3.0)) * gWet;
  #ifdef IS_PATCH
    float gPud = vPud;
  #else
    float gPud = smoothstep(0.34, 0.27, vn2(P.xz * 0.8)) * gWet * step(0.0, P.y);
  #endif
  vec3 gc = mix(ground, mud, gWet);
  gc = mix(gc, vec3(0.19,0.18,0.16) * (0.6 + 0.8 * n3), peb * 0.7);
  gc = mix(gc, vec3(0.03,0.024,0.018), gPud * 0.8);
  gc = mix(gc, rock, gRock);
  float dw = max(-P.y, 0.0);
  gc *= mix(1.0, 0.5, smoothstep(0.0, 0.4, dw));
  gc = mix(gc, vec3(0.025,0.05,0.04), smoothstep(0.0, 0.9, dw) * 0.6);
  float ca = 1.0 - abs(vn2(P.xz * 3.1 + uTime * vec2(0.5, 0.2)) - vn2(P.xz * 3.4 - uTime * vec2(0.3, 0.45) + 5.0)) * 4.0;
  gc += vec3(0.5,0.4,0.22) * pow(max(ca, 0.0), 6.0) * smoothstep(0.0, 0.12, dw) * 0.12;
  diffuseColor.rgb = gc;
  #ifndef IS_PATCH
    if (uHole.w > 0.5 && abs(P.x - uHole.x) < uHole.z && abs(P.z - uHole.y) < uHole.z) discard;
  #endif
`;
const GROUND_FROUGH = `
  roughnessFactor = mix(0.96, 0.30, gWet * (0.55 + 0.45 * n2));
  roughnessFactor = mix(roughnessFactor, 0.05, gPud);
  roughnessFactor = mix(roughnessFactor, 0.82, gRock);
`;
const GROUND_FNORMAL = `
  {
    float hh = n2 * 0.05 + n3 * 0.014 + peb * 0.03 + gRock * (fbm2(P.xz * 1.3 + P.y) * 0.5 + strata * 0.08);
    hh *= 1.0 - gPud;
    float q = uQuake * gPud * sin(length(P.xz - uQuakeC) * 55.0 - uTime * 42.0) * 0.004;
    normal = bumpN(normal, -vViewPosition, hh + q, 1.0 / (1.0 + dcam * 0.04));
  }
`;

export const groundU = {
  uHole: { value: new THREE.Vector4(PATCH.x, PATCH.z, PATCH.half - 0.35, 1) },
  uQuakeC: { value: new THREE.Vector2(PATCH.x, PATCH.z) },
  uFoot: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
  uFootS: { value: 1 },
};

function groundMaterial(isPatch) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  if (isPatch) m.defines = { IS_PATCH: 1 };
  const foot = `
    float footMask(vec2 p, vec4 f, float grow){
      vec2 q = p - f.xy; float c = cos(f.z), s = sin(f.z);
      vec2 l = vec2(q.x * c + q.y * s, -q.x * s + q.y * c) / uFootS;
      float d = length(l - vec2(-0.12, 0.0)) - 0.17;
      for (int i = -1; i <= 1; i++) {
        float a = float(i) * 0.52; vec2 e = vec2(cos(a), sin(a)) * (i == 0 ? 0.86 : 0.68);
        float t = clamp(dot(l, e) / dot(e, e), 0.0, 1.0);
        d = min(d, length(l - e * t) - mix(0.115, 0.07, t));
      }
      return smoothstep(0.035 + grow, -0.035 + grow, d);
    }
    float footDisp(vec2 p){
      float h = 0.0;
      for (int i = 0; i < 3; i++) { vec4 f = uFoot[i]; if (f.w > 0.0) {
        float m = footMask(p, f, 0.0), rim = footMask(p, f, 0.10 * uFootS) - m;
        h += f.w * (-m + rim * 0.38); } }
      return h;
    }`;
  return patch(m, {
    key: isPatch ? 'groundPatch' : 'ground',
    uniforms: groundU,
    vpars: `varying vec3 vW; varying vec3 vNw; varying float vRock; attribute float aRock;
      #ifdef IS_PATCH
      attribute float aPud; varying float vPud; uniform vec4 uFoot[3]; uniform float uFootS; ${foot}
      #endif`,
    vbegin: `
      #ifdef IS_PATCH
        vPud = aPud;
        float fd0 = footDisp(position.xz), e = 0.02;
        transformed.y += fd0;
        vec3 nn = normalize(vec3(objectNormal.x - (footDisp(position.xz + vec2(e, 0.0)) - fd0) / e, objectNormal.y, objectNormal.z - (footDisp(position.xz + vec2(0.0, e)) - fd0) / e));
        vNormal = normalize(normalMatrix * nn);
        vNw = nn;
      #else
        vNw = normal;
      #endif
      vRock = aRock; vW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    fpars: `varying vec3 vW; varying vec3 vNw; varying float vRock; uniform float uTime, uQuake; uniform vec4 uHole; uniform vec2 uQuakeC;
      #ifdef IS_PATCH
      varying float vPud;
      #endif
      ${GLSL_NOISE}`,
    fcolor: GROUND_FCOLOR, frough: GROUND_FROUGH, fnormal: GROUND_FNORMAL,
  });
}

export function buildTerrain() {
  const { x0, z0, cell } = WORLD;
  const pos = new Float32Array(NX * NZ * 3), rock = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = x0 + i * cell, z = z0 + j * cell;
    pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
    rock[k] = 0;
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
  let n = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, groundMaterial(false));
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

// Zone de boue finement maillée devant la caméra du gros plan (empreintes, flaques).
export function buildPatch() {
  const N = 380, S = PATCH.half * 2;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, pud = new Float32Array(p.count), rock = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + PATCH.x, z = p.getZ(i) + PATCH.z;
    const edge = smooth(PATCH.half, PATCH.half - 0.8, Math.max(Math.abs(x - PATCH.x), Math.abs(z - PATCH.z)));
    const basin = smooth(0.40, 0.30, vnoise(x * 0.9, z * 0.9, 77));
    const micro = (fbm(x * 2.2, z * 2.2, 4, 71) - 0.5) * 0.085 + (fbm(x * 11, z * 11, 3, 72) - 0.5) * 0.02;
    pud[i] = basin * edge;
    p.setXYZ(i, x, groundY(x, z) + 0.012 + edge * (micro * (1 - basin) - basin * 0.03), z);
  }
  g.setAttribute('aPud', new THREE.BufferAttribute(pud, 1));
  g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, groundMaterial(true));
  mesh.receiveShadow = true;
  return mesh;
}

// Rocher du plan final : maillage fin posé sur le terrain.
export function buildHeroRock() {
  const N = 240, S = 19, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ROCK.x, z = p.getZ(i) + ROCK.z, h = rockH(x, z);
    p.setXYZ(i, x, baseY(x, z) + (h > 0.01 ? h : -0.5), z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, rockMaterial()); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- Rochers et galets instanciés.
function rockGeometry(detail, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.9, 4, seed) + 0.35 * fbm(v.z * 3.1, v.x * 3.1 - v.y, 3, seed + 3);
    v.multiplyScalar(0.62 + n * 0.62); v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // Soude les sommets dupliqués pour un ombrage lisse.
  const map = new Map(), pn = new Float32Array(p.count * 3);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    const a = map.get(key) || [0, 0, 0]; a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); map.set(key, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = map.get(`${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`);
    const l = Math.hypot(a[0], a[1], a[2]) || 1; pn.set([a[0] / l, a[1] / l, a[2] / l], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(pn, 3));
  return g;
}

function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  return patch(m, {
    key: 'rock',
    vpars: `varying vec3 vOb; varying vec3 vWr;`,
    vbegin: `vOb = position; vec4 wr = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        wr = instanceMatrix * wr;
      #endif
      vWr = (modelMatrix * wr).xyz;`,
    fpars: `varying vec3 vOb; varying vec3 vWr; ${GLSL_NOISE}`,
    fcolor: `float rn = fbm3(vOb * 2.3 + vWr * 0.07), rn2 = fbm3(vOb * 11.0);
      vec3 rc = mix(vec3(0.05,0.05,0.055), vec3(0.17,0.16,0.145), rn) * (0.7 + 0.6 * rn2);
      float rwet = 1.0 - smoothstep(0.0, 0.5, vWr.y);
      rc = mix(rc, vec3(0.05,0.08,0.03), smoothstep(0.55, 0.75, fbm3(vOb * 1.4 + 9.0)) * 0.6 * (1.0 - rwet));
      rc *= mix(1.0, 0.55, rwet);
      diffuseColor.rgb *= rc;`,
    frough: `roughnessFactor = mix(0.85, 0.25, rwet);`,
    fnormal: `normal = bumpN(normal, -vViewPosition, (rn * 0.25 + rn2 * 0.05) * length(fwidth(vWr)) / max(length(fwidth(vOb)), 1e-5), 1.0 / (1.0 + length(vViewPosition) * 0.05));`,
  });
}

export function buildRocks(scene) {
  const R = rng(SEED + 5), mat = rockMaterial(), dummy = new THREE.Object3D();
  const out = {};
  const make = (name, geo, count, place) => {
    const im = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) { place(dummy, i); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, new THREE.Color().setScalar(0.8 + R() * 0.4)); }
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im); out[name] = im; return im;
  };
  // Gros blocs volcaniques le long des berges et dans le lit.
  make('boulders', rockGeometry(4, 1), 260, (d) => {
    const x = -120 + R() * 320, side = R() < 0.5 ? -1 : 1, ad = R() < 0.3 ? R() * 9 : 9 + R() * 22;
    const z = riverZ(x) + side * ad, s = 0.25 + Math.pow(R(), 2.2) * 1.9;
    d.position.set(x, groundY(x, z) + s * 0.12, z); d.scale.set(s * (0.8 + R() * 0.6), s * (0.6 + R() * 0.5), s * (0.8 + R() * 0.6));
    d.rotation.set(R() * 0.5, R() * 6.28, R() * 0.5);
  });
  // Galets des bancs de gravier.
  make('pebbles', rockGeometry(2, 2), 5200, (d) => {
    const x = -40 + R() * 170, side = R() < 0.5 ? -1 : 1, z = riverZ(x) + side * (5 + R() * 13), s = 0.025 + Math.pow(R(), 2) * 0.11;
    d.position.set(x, groundY(x, z) + s * 0.25, z); d.scale.set(s * (0.8 + R()), s * (0.5 + R() * 0.4), s * (0.8 + R()));
    d.rotation.set(0, R() * 6.28, 0);
  });
  // Galets du gros plan : ceux-là sautent à l'impact du pas (mis à jour à chaque image).
  const hero = [];
  make('heroPebbles', rockGeometry(3, 3), 420, (d) => {
    let a = R() * 6.28, r = 0.3 + Math.pow(R(), 0.7) * 4.3, x = PATCH.x + Math.cos(a) * r, z = PATCH.z + Math.sin(a) * r;
    if (x < PATCH.x - 0.75 && Math.abs(z - PATCH.z) < 0.7) z += z > PATCH.z ? 0.9 : -0.9;
    const s = 0.012 + Math.pow(R(), 2.4) * 0.07;
    const o = { x, z, y: groundY(x, z) + 0.012 + s * 0.3, sx: s * (0.8 + R()), sy: s * (0.5 + R() * 0.4), sz: s * (0.8 + R()), ry: R() * 6.28, ph: R(), s };
    hero.push(o);
    d.position.set(o.x, o.y, o.z); d.scale.set(o.sx, o.sy, o.sz); d.rotation.set(0, o.ry, 0);
  });
  out.hero = hero;
  // Les galets rebondissent : fonction pure du temps écoulé depuis chaque impact.
  out.updateHero = (impacts) => {
    const im = out.heroPebbles;
    for (let i = 0; i < hero.length; i++) {
      const o = hero[i]; let dy = 0, rot = 0;
      for (const [age, ix, iz, amp] of impacts) {
        if (age <= 0) continue;
        const dist = Math.hypot(o.x - ix, o.z - iz), a = age - dist * 0.02;
        if (a <= 0) continue;
        const v0 = amp * (0.5 + o.ph) * 1.6 / (1 + dist * 0.9) / (1 + o.s * 14), T = 2 * v0 / 9.81;
        let tt = a, v = v0, tb = T, n = 0;
        while (tt > tb && n < 3) { tt -= tb; v *= 0.38; tb = 2 * v / 9.81; n++; }
        if (n < 3) { dy += Math.max(0, v * tt - 4.905 * tt * tt); rot += v * tt * 6; }
      }
      dummy.position.set(o.x, o.y + dy, o.z); dummy.scale.set(o.sx, o.sy, o.sz); dummy.rotation.set(rot, o.ry, rot * 0.6);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  return out;
}

// ---------- Rivière : reflet plan, transparence selon la profondeur, ondulations et ronds dans l'eau.
export const MAX_RIP = 24;
export function buildWater(renderer) {
  const { x0, x1, z0, z1 } = WORLD;
  const tex = new THREE.DataTexture(H, NX, NZ, THREE.RedFormat, THREE.FloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const rt = new THREE.WebGLRenderTarget(960, 402, { type: THREE.HalfFloatType, depthBuffer: true });
  const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(uni, {
    uTime: U.uTime, uQuake: U.uQuake,
    tRefl: { value: rt.texture }, tHeight: { value: tex }, uReflM: { value: new THREE.Matrix4() },
    uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uBounds: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) },
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, fog: true,
    vertexShader: `varying vec3 vW; varying vec4 vR; uniform mat4 uReflM;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = uReflM * w;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW; varying vec4 vR;
      uniform sampler2D tRefl, tHeight; uniform float uTime, uQuake; uniform vec4 uRip[${MAX_RIP}]; uniform vec4 uBounds;
      ${GLSL_SUN} ${GLSL_NOISE}
      #include <fog_pars_fragment>
      float wh(vec2 p){
        float t = uTime;
        float h = vn2(p * 1.1 + vec2(t * 0.9, t * 0.12)) * 0.05 + vn2(p * 3.3 + vec2(t * 1.5, -t * 0.3)) * 0.02 + vn2(p * 9.1 + vec2(t * 2.3, t * 0.6)) * 0.006;
        for (int i = 0; i < ${MAX_RIP}; i++) { vec4 r = uRip[i]; float age = t - r.z;
          if (age > 0.0 && age < 3.5) { float d = distance(p, r.xy), fr = age * 1.5;
            h += sin((d - fr) * 13.0) * exp(-pow((d - fr) * 1.3, 2.0)) * r.w * exp(-age * 1.1) / (1.0 + d * 0.8); } }
        h += uQuake * sin(p.x * 61.0 + t * 47.0) * sin(p.y * 53.0 - t * 41.0) * 0.0025;
        return h;
      }
      void main(){
        vec2 p = vW.xz;
        float depth = -texture2D(tHeight, (p - uBounds.xy) / uBounds.zw).r;
        if (depth <= 0.0) discard;
        float e = 0.04, h0 = wh(p);
        vec3 N = normalize(vec3(-(wh(p + vec2(e, 0.0)) - h0) / e, 1.0, -(wh(p + vec2(0.0, e)) - h0) / e));
        vec3 V = normalize(cameraPosition - vW);
        float dist = distance(cameraPosition, vW);
        N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(30.0, 260.0, dist) * 0.8));
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec2 ruv = vR.xy / vR.w + N.xz * (0.035 + 0.5 / (1.0 + dist));
        vec3 refl = texture2D(tRefl, clamp(ruv, 0.002, 0.998)).rgb;
        vec3 Rd = reflect(-V, N);
        float sp = pow(max(dot(Rd, SUN), 0.0), 900.0);
        refl += SUNCOL * sp * 40.0;
        float tr = exp(-depth * 5.0) * (1.0 - fres);
        vec3 scat = vec3(0.03, 0.065, 0.05) * (1.0 - exp(-depth * 5.0)) * (1.0 - fres);
        float a = 1.0 - tr;
        vec3 c = (scat + refl * fres) / max(a, 1e-3);
        a *= smoothstep(0.0, 0.025, depth);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
  // Ruban de maillage qui suit le cours d'eau.
  const pos = [], idx = [];
  let n = 0;
  for (let x = x0; x <= x1; x += 4) { pos.push(x, 0, riverZ(x) - 15, x, 0, riverZ(x) + 15); if (x > x0) { idx.push(n - 2, n - 1, n, n, n - 1, n + 1); } n += 2; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;

  const vcam = new THREE.PerspectiveCamera(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.03);
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const t = new THREE.Vector3(), up = new THREE.Vector3(), fw = new THREE.Vector3();
  // Rend la scène vue par une caméra miroir sous le plan d'eau.
  function renderReflection(scene, camera, hidden) {
    camera.updateMatrixWorld();
    vcam.fov = camera.fov; vcam.aspect = camera.aspect; vcam.near = camera.near; vcam.far = camera.far; vcam.updateProjectionMatrix();
    fw.set(0, 0, -1).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    vcam.position.set(camera.position.x, -camera.position.y, camera.position.z);
    t.copy(camera.position).add(fw); t.y = -t.y;
    vcam.up.set(up.x, -up.y, up.z); // « haut » en miroir
    vcam.lookAt(t); vcam.updateMatrixWorld();
    uni.uReflM.value.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    for (const o of hidden) o.userData._v = o.visible, o.visible = false;
    mesh.visible = false;
    const old = renderer.getRenderTarget();
    renderer.clippingPlanes = [plane];
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam);
    renderer.clippingPlanes = [];
    renderer.setRenderTarget(old);
    mesh.visible = true;
    for (const o of hidden) o.visible = o.userData._v;
  }
  return { mesh, uni, renderReflection, rt };
}

export function buildSun(scene) {
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.68, 0.38), 11);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const setBox = (cx, cy, cz, half) => {
    sun.target.position.set(cx, cy, cz); sun.position.set(cx, cy, cz).addScaledVector(SUN, 600);
    const c = sun.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 600 + half * 7;
    c.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = half / 4096 * 6.0;
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  };
  return { sun, setBox };
}
