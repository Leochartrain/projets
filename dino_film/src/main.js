// Programme principal : construit le monde, joue le film en temps réel,
// et expose l'interface utilisée par le script de rendu image par image.
import * as THREE from 'three';
import { U } from './util.js';
import { installFog, buildHeights, buildSky, buildTerrain, buildPatch, buildHeroRock, buildRocks, buildWater, buildSun } from './world.js';
import { buildFlora } from './flora.js';
import { Particles } from './fx.js';
import { Post } from './post.js';
import { Film, keepOut, DUR, FPS, FRAMES, STILLS, SHOTS } from './shots.js';
import { renderAudio, toWav } from './audio.js';

const CW = 1920, CH = 1080, W = 1920, H = 804; // image 2.39:1 dans un cadre 16:9
const q = new URLSearchParams(location.search), RENDER = q.has('render');
if (RENDER) document.body.classList.add('render');
const msg = (s) => { const m = document.getElementById('msg'); if (m) m.textContent = s; };
const log = [];
window.addEventListener('error', (e) => log.push('ERREUR ' + e.message));

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(CW, CH, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.debug.onShaderError = (gl, prog, vs, fs) => {
    log.push('SHADER ' + (gl.getShaderInfoLog(vs) || '') + ' | ' + (gl.getShaderInfoLog(fs) || '') + ' | ' + (gl.getProgramInfoLog(prog) || ''));
  };
  const dbg = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'inconnu';

  installFog(); buildHeights();
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(0.15, 0.21, 0.245), 0.012);
  const sky = buildSky(); scene.add(sky);
  // Éclairage d'ambiance HDR : le ciel procédural, filtré en carte d'environnement.
  {
    const es = new THREE.Scene(); es.fog = scene.fog;
    const s2 = buildSky(); s2.material.uniforms.uDisc.value = 0; es.add(s2);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0, 1, 9000).texture; scene.environmentIntensity = 1.15;
    pm.dispose();
  }
  const sunCtl = buildSun(scene);
  scene.add(buildTerrain(), buildPatch(), buildHeroRock());
  const rocks = buildRocks(scene);
  const water = buildWater(renderer); scene.add(water.mesh);
  const flora = buildFlora(scene, keepOut);
  const P = new Particles(); scene.add(P.mesh);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.3, 14000);
  const film = new Film({ scene, camera, sunCtl, water, rocks, P });
  film.precompute();
  const post = new Post(renderer, W, H, CW, CH);

  function renderAt(t, frame, samples) {
    post.begin();
    let p;
    for (let j = 0; j < samples; j++) {
      // Obturateur à 180° : les sous-images couvrent la moitié de la durée d'une image.
      p = film.apply(t + (samples > 1 ? (j / samples) * 0.5 / FPS : 0));
      sky.position.copy(camera.position);
      post.renderSample(scene, camera, samples, p, () => {
        renderer.shadowMap.needsUpdate = true;
        water.renderReflection(scene, camera, [P.mesh]);
      });
    }
    post.finish(p, frame);
  }

  let audioBuf = null;
  const api = {
    gpu, flora, log, FRAMES, FPS, STILLS, SHOTS, events: film.events.length,
    renderFrame(i, samples = 8) { renderAt(i / FPS, i, samples); return canvas.toDataURL('image/png'); },
    still(t, samples = 8) { renderAt(t, Math.round(t * FPS), samples); return canvas.toDataURL('image/png'); },
    async audioWav() { audioBuf = audioBuf || await renderAudio(film); return toWav(audioBuf); },
    film,
    debug(t, cam, samples = 2) { film.debugCam = cam; renderAt(t, 0, samples); film.debugCam = null; return canvas.toDataURL('image/jpeg', 0.9); },
  };
  window.DINO = api;

  if (!RENDER) {
    renderAt(STILLS[0], 0, 1);
    msg('Synthèse de la bande-son…');
    audioBuf = await renderAudio(film);
    msg(`Prêt — ${gpu}`);
    const btn = document.getElementById('play'); btn.hidden = false;
    btn.onclick = () => {
      document.body.classList.add('playing');
      const ac = new AudioContext({ sampleRate: 48000 }), src = ac.createBufferSource();
      src.buffer = audioBuf; src.connect(ac.destination);
      const t0 = ac.currentTime + 0.08; src.start(t0);
      const samples = Number(q.get('samples') || 1);
      const tick = () => {
        const t = ac.currentTime - t0;
        if (t >= DUR) { ac.close(); document.body.classList.remove('playing'); return; }
        if (t >= 0) renderAt(t, Math.floor(t * FPS), samples);
        requestAnimationFrame(tick);
      };
      tick();
    };
  }
  window.DINO_READY = true;
}
boot().catch((e) => { log.push('ERREUR ' + (e.stack || e)); window.DINO = { log }; window.DINO_READY = true; msg('Erreur : ' + e.message); console.error(e); });
