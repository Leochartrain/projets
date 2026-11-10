// Post-production : profondeur de champ anamorphique, flou de mouvement par accumulation,
// rayons de lumière, halo, flare horizontal, aberration chromatique, ACES, étalonnage, grain.
import * as THREE from 'three';
import { SUN, GLSL_SUN } from './util.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const HALTON = Array.from({ length: 64 }, (_, i) => { const h = (b) => { let f = 1, r = 0, k = i + 1; while (k > 0) { f /= b; r += f * (k % b); k = Math.floor(k / b); } return r; }; return [h(2) - 0.5, h(3) - 0.5]; });

export class Post {
  constructor(renderer, W, H, CW, CH) {
    this.r = renderer; this.W = W; this.H = H; this.CW = CW; this.CH = CH;
    const rt = (w, h, depth = false) => {
      w = Math.floor(w); h = Math.floor(h);
      const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      if (depth) { t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; }
      return t;
    };
    this.scene = rt(W, H, true); this.acc = rt(W, H);
    this.h = [rt(W / 2, H / 2), rt(W / 2, H / 2)]; this.q = [rt(W / 4, H / 4), rt(W / 4, H / 4)]; this.e = [rt(W / 8, H / 8), rt(W / 8, H / 8)];
    this.st = [rt(W / 4, H / 4), rt(W / 4, H / 4)]; this.god = [rt(W / 4, H / 4), rt(W / 4, H / 4)];
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const M = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });

    this.mDof = M(`varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uFocus, uApert, uMaxCoc, uSeed, uWeight;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      float coc(float dep){ return clamp(uApert * (dep - uFocus) / dep, -uMaxCoc, uMaxCoc); }
      void main(){
        float rd = texture2D(tDepth, vUv).r, d0 = lin(rd), c0 = abs(coc(d0));
        vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0;
        if (uMaxCoc > 0.6) {
          for (int i = 0; i < 64; i++) {
            float r = sqrt((float(i) + 0.5) / 64.0), a = float(i) * 2.39996323 + uSeed * 6.2831;
            vec2 o = vec2(cos(a) * 0.56, sin(a)) * r;                 // bokeh ovale des optiques anamorphiques
            vec2 suv = vUv + o * uMaxCoc / uRes;
            float ds = lin(texture2D(tDepth, suv).r), cs = abs(coc(ds));
            if (ds > d0) cs = min(cs, c0 * 2.0);
            float m = smoothstep(r * uMaxCoc - 1.0, r * uMaxCoc + 1.0, cs);
            vec3 s = min(texture2D(tColor, suv).rgb, vec3(60.0));
            float lw = 1.0 + min(dot(s, vec3(0.3, 0.6, 0.1)), 6.0) * 0.2;
            acc += s * m * lw; ws += m * lw;
          }
        }
        gl_FragColor = vec4(acc / ws, rd >= 0.99999 ? 1.0 : 0.0) * uWeight;
      }`, { tColor: { value: this.scene.texture }, tDepth: { value: this.scene.depthTexture }, uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 10 }, uApert: { value: 0 }, uMaxCoc: { value: 0 }, uSeed: { value: 0 }, uWeight: { value: 1 } },
    { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, transparent: true });

    this.mBright = M(`varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uTexel; uniform float uThr;
      void main(){ vec4 c = vec4(0.0);
        c += texture2D(tColor, vUv + uTexel * vec2(-0.5, -0.5)); c += texture2D(tColor, vUv + uTexel * vec2(0.5, -0.5));
        c += texture2D(tColor, vUv + uTexel * vec2(-0.5, 0.5)); c += texture2D(tColor, vUv + uTexel * vec2(0.5, 0.5)); c *= 0.25;
        c.rgb = min(c.rgb, vec3(40.0));
        float l = dot(c.rgb, vec3(0.3, 0.6, 0.1));
        gl_FragColor = vec4(c.rgb * smoothstep(uThr, uThr * 2.5, l), c.a * min(l, 6.0)); }`,
    { tColor: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uThr: { value: 1.2 } });

    this.mCopy = M(`varying vec2 vUv; uniform sampler2D tColor; void main(){ gl_FragColor = texture2D(tColor, vUv); }`, { tColor: { value: null } });
    this.mBlur = M(`varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir;
      void main(){ vec4 c = texture2D(tColor, vUv) * 0.2270270;
        c += (texture2D(tColor, vUv + uDir * 1.3846) + texture2D(tColor, vUv - uDir * 1.3846)) * 0.3162162;
        c += (texture2D(tColor, vUv + uDir * 3.2308) + texture2D(tColor, vUv - uDir * 3.2308)) * 0.0702703;
        gl_FragColor = c; }`, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mStreak = M(`varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir; uniform float uPre;
      void main(){ vec4 c = vec4(0.0); float ws = 0.0;
        for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 14.0); vec4 s = texture2D(tColor, vUv + uDir * float(i));
          if (uPre > 0.5) { float l = dot(s.rgb, vec3(0.3, 0.6, 0.1)); s.rgb *= smoothstep(1.5, 6.0, l); }
          c += s * w; ws += w; }
        gl_FragColor = c / ws; }`, { tColor: { value: null }, uDir: { value: new THREE.Vector2() }, uPre: { value: 0 } });
    this.mGod = M(`varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uSun; uniform float uLen, uFirst;
      void main(){ vec2 d = (uSun - vUv) * uLen / 20.0; float a = 0.0, w = 1.0, ws = 0.0; vec2 p = vUv;
        for (int i = 0; i < 20; i++) { float s = uFirst > 0.5 ? texture2D(tColor, clamp(p, 0.001, 0.999)).a : texture2D(tColor, clamp(p, 0.001, 0.999)).r; a += s * w; ws += w; w *= 0.965; p += d; }
        gl_FragColor = vec4(vec3(a / ws), 1.0); }`, { tColor: { value: null }, uSun: { value: new THREE.Vector2() }, uLen: { value: 0.6 }, uFirst: { value: 1 } });

    this.mFinal = M(`varying vec2 vUv; uniform sampler2D tColor, tB1, tB2, tB3, tStreak, tGod;
      uniform vec2 uCanvas; uniform float uBar, uExposure, uBloom, uStreak, uGod, uCA, uVig, uGrain, uFrame, uFade, uDist; uniform vec4 uDrops[8];
      ${GLSL_SUN}
      float hh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      vec3 aces(vec3 x){ // approximation RRT+ODT de Stephen Hill
        const mat3 A = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 B = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        vec3 v = A * x; vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return clamp(B * (a / b), 0.0, 1.0); }
      void main(){
        vec2 f = gl_FragCoord.xy / uCanvas;
        if (f.y < uBar || f.y > 1.0 - uBar) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec2 uv = vec2(f.x, (f.y - uBar) / (1.0 - 2.0 * uBar));
        vec2 c = uv - 0.5; vec2 ca = c * vec2(1.0, 0.42); float r2 = dot(ca, ca) * 3.4;
        uv = 0.5 + c * (1.0 + uDist * r2) / (1.0 + uDist * 0.3);
        float soft = 0.0;
        for (int i = 0; i < 8; i++) { vec4 d = uDrops[i]; if (d.w > 0.0) { vec2 q = (uv - d.xy) * vec2(2.39, 1.0); float l = length(q) / d.z;
          if (l < 1.0) { float k = (1.0 - l * l); uv -= q / vec2(2.39, 1.0) * k * 0.85 * d.w; soft += k * d.w; } } }
        vec2 off = c * uCA * (0.3 + r2);
        vec3 col = vec3(texture2D(tColor, uv + off).r, texture2D(tColor, uv).g, texture2D(tColor, uv - off).b);
        vec3 b1 = texture2D(tB1, uv).rgb, b2 = texture2D(tB2, uv).rgb, b3 = texture2D(tB3, uv).rgb;
        col = col * (1.0 + 0.12 * clamp(soft, 0.0, 1.0)) + b2 * 0.6 * clamp(soft, 0.0, 1.0);
        col += (b1 * 0.25 + b2 * 0.35 + b3 * 0.4) * uBloom;
        col += texture2D(tStreak, uv).rgb * vec3(0.45, 0.7, 1.0) * uStreak;
        col += SUNCOL * texture2D(tGod, uv).r * uGod;
        col *= 1.0 - uVig * pow(r2, 1.25);
        col = aces(col * uExposure);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, col * vec3(0.74, 1.03, 1.10), (1.0 - smoothstep(0.0, 0.33, l)) * 0.7);   // ombres vert-bleu
        col = mix(col, col * vec3(1.10, 1.0, 0.84), smoothstep(0.3, 0.95, l) * 0.6);             // hautes lumières chaudes
        col = pow(max(col, 0.0), vec3(1.0 / 2.2));
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.42);                                     // contraste filmique
        l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 1.06);
        vec2 gp = floor(gl_FragCoord.xy / 1.25);
        vec3 g = vec3(hh(gp + uFrame * 17.13), hh(gp + 91.7 + uFrame * 23.71), hh(gp + 47.3 + uFrame * 11.37)) - 0.5;
        g = mix(vec3(g.r + g.g + g.b) / 3.0 * 1.7, g, 0.35);
        col += g * uGrain * (1.0 - 0.55 * l);
        gl_FragColor = vec4(clamp(col * uFade, 0.0, 1.0), 1.0);
      }`, {
      tColor: { value: this.acc.texture }, tB1: { value: this.h[0].texture }, tB2: { value: this.q[0].texture }, tB3: { value: this.e[0].texture }, tStreak: { value: this.st[0].texture }, tGod: { value: this.god[0].texture },
      uCanvas: { value: new THREE.Vector2(CW, CH) }, uBar: { value: (CH - H) / 2 / CH }, uExposure: { value: 1 }, uBloom: { value: 0.5 }, uStreak: { value: 0.5 }, uGod: { value: 0.5 },
      uCA: { value: 0.004 }, uVig: { value: 0.5 }, uGrain: { value: 0.05 }, uFrame: { value: 0 }, uFade: { value: 1 }, uDist: { value: -0.03 },
      uDrops: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 1, 0)) },
    });
    this.sample = 0; this.sunV = new THREE.Vector3();
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  begin() { this.r.setRenderTarget(this.acc); this.r.setClearColor(0x000000, 0); this.r.clear(); this.sample = 0; }
  // Un sous-échantillon : la scène à un instant de l'obturateur, avec décalage sous-pixel (anticrénelage).
  renderSample(scene, camera, n, p, beforeScene) {
    const i = this.sample++, j = HALTON[i % 64];
    if (n > 1) camera.setViewOffset(this.W, this.H, j[0], j[1], this.W, this.H); else camera.clearViewOffset();
    if (beforeScene) beforeScene();
    this.r.setRenderTarget(this.scene); this.r.setClearColor(0x000000, 1); this.r.clear(); this.r.render(scene, camera);
    camera.clearViewOffset();
    const u = this.mDof.uniforms; u.uNear.value = camera.near; u.uFar.value = camera.far; u.uFocus.value = p.focus; u.uApert.value = p.apert; u.uMaxCoc.value = Math.min(p.apert, 60);
    u.uSeed.value = (i * 0.618034) % 1; u.uWeight.value = 1 / n;
    this.r.autoClear = false; this.pass(this.mDof, this.acc); this.r.autoClear = true;
    // Position du soleil à l'écran pour les rayons.
    this.sunV.copy(camera.position).addScaledVector(SUN, 1000).project(camera);
    this.sunFront = SUN.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.05;
  }
  finish(p, frame) {
    const { W, H } = this, B = this.mBright.uniforms, bl = this.mBlur.uniforms, cp = this.mCopy.uniforms, s = this.mStreak.uniforms, g = this.mGod.uniforms;
    B.tColor.value = this.acc.texture; this.pass(this.mBright, this.h[0]);
    cp.tColor.value = this.h[0].texture; this.pass(this.mCopy, this.q[1]);
    // Flare anamorphique : étirement horizontal des très hautes lumières.
    s.tColor.value = this.q[1].texture; s.uPre.value = 1; s.uDir.value.set(1.5 / (W / 4), 0); this.pass(this.mStreak, this.st[0]);
    s.uPre.value = 0; s.tColor.value = this.st[0].texture; s.uDir.value.set(5 / (W / 4), 0); this.pass(this.mStreak, this.st[1]);
    s.tColor.value = this.st[1].texture; s.uDir.value.set(15 / (W / 4), 0); this.pass(this.mStreak, this.st[0]);
    // Rayons volumétriques : flou radial du ciel lumineux vers le soleil, masqué par les silhouettes.
    const su = g.uSun.value.set(this.sunV.x * 0.5 + 0.5, this.sunV.y * 0.5 + 0.5);
    const off = Math.max(Math.abs(this.sunV.x), Math.abs(this.sunV.y)), gk = this.sunFront ? Math.max(0, 1 - Math.max(0, off - 1) / 1.6) : 0;
    g.tColor.value = this.q[1].texture; g.uFirst.value = 1; g.uLen.value = 0.75; this.pass(this.mGod, this.god[1]);
    g.tColor.value = this.god[1].texture; g.uFirst.value = 0; g.uLen.value = 0.2; this.pass(this.mGod, this.god[0]);
    // Halo : trois échelles de flou.
    const blur = (pair, w, h, n = 1) => { for (let i = 0; i < n; i++) { bl.tColor.value = pair[0].texture; bl.uDir.value.set(1 / w, 0); this.pass(this.mBlur, pair[1]); bl.tColor.value = pair[1].texture; bl.uDir.value.set(0, 1 / h); this.pass(this.mBlur, pair[0]); } };
    blur(this.h, W / 2, H / 2, 1);
    cp.tColor.value = this.h[0].texture; this.pass(this.mCopy, this.q[0]); blur(this.q, W / 4, H / 4, 2);
    cp.tColor.value = this.q[0].texture; this.pass(this.mCopy, this.e[0]); blur(this.e, W / 8, H / 8, 3);
    const f = this.mFinal.uniforms;
    f.uExposure.value = p.exposure; f.uBloom.value = p.bloom; f.uStreak.value = p.streak; f.uGod.value = p.god * gk; f.uCA.value = p.ca; f.uVig.value = p.vig; f.uGrain.value = p.grain;
    f.uFrame.value = frame; f.uFade.value = p.fade;
    for (let i = 0; i < 8; i++) { const d = p.drops && p.drops[i]; if (d) f.uDrops.value[i].set(d[0], d[1], d[2], d[3]); else f.uDrops.value[i].w = 0; }
    this.pass(this.mFinal, null);
  }
}
