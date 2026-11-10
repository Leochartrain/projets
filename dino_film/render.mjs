// Rendu du film image par image dans un navigateur sans interface, puis assemblage ffmpeg.
//   node render.mjs --stills          → 6 images de validation dans out/stills/
//   node render.mjs                   → out/dinosaures.mp4 (450 images + bande-son)
//   options : --samples=8 (sous-images par image : flou de mouvement et anticrénelage), --t=9.3 (une image), --from=0 --to=450
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { serve } from './serve.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(ROOT, 'out');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const has = (n) => process.argv.includes(`--${n}`);
const SAMPLES = Number(arg('samples', 8)), PORT = Number(arg('port', 5251));
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const server = await serve(PORT);
const browser = await chromium.launch({
  channel: 'msedge', headless: !has('headed'),
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text().slice(0, 1500)); });
page.on('pageerror', (e) => console.log('[page erreur]', e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${PORT}/?render=1`);
await page.waitForFunction(() => window.DINO_READY === true, null, { timeout: 600000 });
const info = await page.evaluate(() => ({ gpu: DINO.gpu, flora: DINO.flora, log: DINO.log, events: DINO.events, stills: DINO.STILLS, frames: DINO.FRAMES }));
console.log(`Scène prête en ${((Date.now() - t0) / 1000).toFixed(1)} s — ${info.gpu}`);
console.log('Végétation :', JSON.stringify(info.flora), '— appuis précalculés :', info.events);
if (info.log && info.log.length) console.log('Journal :', info.log.join('\n').slice(0, 6000));
if (!info.frames) { await browser.close(); server.close(); process.exit(1); }
const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const flushLog = async () => { const l = await page.evaluate(() => DINO.log.splice(0)); if (l.length) console.log('Journal :', l.join('\n').slice(0, 6000)); };

if (has('audio')) {
  // Bande-son seule : out/bande_son.wav + contrôle du niveau.
  const b64 = await page.evaluate(() => DINO.audioWav()), buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(OUT, 'bande_son.wav'), buf);
  let peak = 0, sum = 0; const n = (buf.length - 44) / 2;
  for (let i = 0; i < n; i++) { const v = buf.readInt16LE(44 + i * 2) / 32768; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  const rms = [];
  for (let s = 0; s < 6; s++) { let q = 0, c = 0; for (let i = Math.floor(s * 2.5 * 96000); i < Math.floor((s + 1) * 2.5 * 96000) && i < n; i++) { const v = buf.readInt16LE(44 + i * 2) / 32768; q += v * v; c++; } rms.push((10 * Math.log10(q / c + 1e-12)).toFixed(1)); }
  console.log('Son : ' + (n / 96000).toFixed(3) + ' s, crête ' + (20 * Math.log10(peak)).toFixed(2) + ' dBFS, RMS ' + (10 * Math.log10(sum / n)).toFixed(1) + ' dB ; RMS par plan : ' + rms.join(' / '));
  await flushLog();
} else if (arg('debug')) {
  // Vues de travail : node render.mjs --debug=vues.json  → [{name,t,pos,look,fov,p}]
  for (const v of JSON.parse(fs.readFileSync(arg('debug'), 'utf8'))) {
    const d = await page.evaluate(([v, n]) => DINO.debug(v.t, v, n), [v, Number(arg('samples', 2))]);
    fs.writeFileSync(path.join(OUT, 'stills', 'dbg_' + v.name + '.jpg'), png(d)); await flushLog();
  }
} else if (has('stills') || arg('t')) {
  const times = arg('t') ? arg('t').split(',').map(Number) : info.stills;
  for (let i = 0; i < times.length; i++) {
    const s = Date.now(), d = await page.evaluate(([t, n]) => DINO.still(t, n), [times[i], SAMPLES]);
    const name = arg('t') ? `t${times[i].toFixed(2)}.png` : `plan${i + 1}.png`;
    fs.writeFileSync(path.join(OUT, 'stills', name), png(d));
    console.log(`${name} (t = ${times[i]} s) en ${((Date.now() - s) / 1000).toFixed(1)} s`);
    await flushLog();
  }
} else {
  const from = Number(arg('from', 0)), to = Number(arg('to', info.frames)), silent = path.join(OUT, 'video_muette.mp4'), wav = path.join(OUT, 'bande_son.wav'), final = path.join(OUT, 'dinosaures.mp4');
  const ff = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', '30', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let i = from; i < to; i++) {
    const d = await page.evaluate(([f, n]) => DINO.renderFrame(f, n), [i, SAMPLES]);
    if (!ff.stdin.write(png(d))) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 15 === 0) { const el = (Date.now() - start) / 1000; console.log(`image ${i}/${to} — ${el.toFixed(0)} s écoulées, reste ~${((el / (i - from + 1)) * (to - i - 1)).toFixed(0)} s`); await flushLog(); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('Synthèse de la bande-son…');
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => DINO.audioWav()), 'base64'));
  const r = spawnSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', '15', '-movflags', '+faststart', final], { stdio: 'inherit' });
  console.log(r.status === 0 ? `Terminé : ${final}` : 'Échec du mixage ffmpeg');
}
await browser.close(); server.close();
