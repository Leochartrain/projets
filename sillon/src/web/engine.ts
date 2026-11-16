// Moteur audio de la version téléphone : deux lecteurs HTML5 (pour le fondu enchaîné et l'enchaînement
// sans attente), chaîne Web Audio (gain ReplayGain, égaliseur 10 bandes, préampli, limiteur, volume).
// Il émet les mêmes événements que le moteur Rust : player:state, player:track, player:ended, player:error.
import type { DspConfig, PlayerState, PlayItem } from "../lib/api";
import { emit } from "./bus";
import * as idb from "./idb";

interface Deck {
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
  item: PlayItem | null;
  url: string | null;
}

/** Fréquence et résolution de chaque morceau (renseignées par le backend). */
export const trackInfo = new Map<number, { rate: number; bits: number }>();

const DEVICE = "Sortie audio de l'appareil";

let ctx: AudioContext | null = null;
let eq: BiquadFilterNode[] = [];
let preamp: GainNode;
let limiter: DynamicsCompressorNode;
let master: GainNode;
let analyser: AnalyserNode;
const decks: Deck[] = [0, 1].map(() => {
  const el = new Audio();
  el.preload = "auto";
  return { el, node: null, gain: null, item: null, url: null };
});
let cur = 0;
let nextItem: PlayItem | null = null;
let status: PlayerState["status"] = "stopped";
let volume = 1;
let dsp: DspConfig = { enabled: false, preamp: 0, bands: [], limiter: true };
let crossfadeMs = 0;
let fading = false;
let sleepAt: number | null = null;
let sleepEndOfTrack = false;
let visualizer = false;

const deck = () => decks[cur];
const other = () => decks[1 - cur];
const dbToGain = (db: number) => Math.pow(10, db / 20);

/** La chaîne Web Audio est créée au premier geste (les navigateurs l'exigent). */
function ensureContext() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  ctx = new AudioContext({ latencyHint: "playback" });
  preamp = ctx.createGain();
  limiter = ctx.createDynamicsCompressor();
  master = ctx.createGain();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  for (const d of decks) {
    d.node = ctx.createMediaElementSource(d.el);
    d.gain = ctx.createGain();
    d.node.connect(d.gain);
  }
  rebuildChain();
  master.gain.value = volume;
}

function rebuildChain() {
  if (!ctx) return;
  for (const d of decks) d.gain!.disconnect();
  for (const f of eq) f.disconnect();
  preamp.disconnect();
  limiter.disconnect();
  master.disconnect();
  eq = [];
  let head: AudioNode = preamp;
  if (dsp.enabled) {
    preamp.gain.value = dbToGain(dsp.preamp);
    for (const b of dsp.bands) {
      const f = ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = b.freq;
      f.gain.value = b.gain;
      f.Q.value = b.q;
      head.connect(f);
      head = f;
      eq.push(f);
    }
  } else preamp.gain.value = 1;
  if (dsp.limiter) {
    // Limiteur doux : n'agit que près de 0 dBFS.
    limiter.threshold.value = -1.5;
    limiter.knee.value = 1;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    head.connect(limiter);
    head = limiter;
  }
  head.connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);
  for (const d of decks) d.gain!.connect(preamp);
}

function state(): PlayerState {
  const d = deck();
  const item = d.item;
  const info = item ? trackInfo.get(item.id) : undefined;
  const fileRate = info?.rate ?? 0;
  const outRate = ctx?.sampleRate ?? 0;
  return {
    status,
    track_id: item?.id ?? null,
    position_ms: Math.round(d.el.currentTime * 1000),
    duration_ms: Number.isFinite(d.el.duration) ? Math.round(d.el.duration * 1000) : (item?.duration_ms ?? 0),
    out_rate: outRate,
    file_rate: fileRate,
    bits: info?.bits ?? 0,
    resampled: !!fileRate && !!outRate && fileRate !== outRate,
    dsp_active: dsp.enabled,
    device: DEVICE,
    sleep_remaining: sleepAt !== null ? Math.max(0, Math.round((sleepAt - Date.now()) / 1000)) : null,
    sleep_end_of_track: sleepEndOfTrack,
  };
}

const sendState = () => emit("player:state", state());

async function setSource(d: Deck, item: PlayItem) {
  const blob = await idb.get<Blob>("files", item.id);
  if (!blob) throw new Error("Fichier introuvable sur cet appareil : réimportez ce morceau.");
  if (d.url) URL.revokeObjectURL(d.url);
  d.url = URL.createObjectURL(blob);
  d.item = item;
  d.el.src = d.url;
  if (d.gain) d.gain.gain.value = dbToGain(item.gain_db);
}

function fail(item: PlayItem | null, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  emit("player:error", { id: item?.id ?? null, message: `Lecture impossible : ${msg}` });
}

async function load(item: PlayItem, positionMs: number, autoplay: boolean) {
  fading = false;
  other().el.pause();
  if (other().item) other().el.removeAttribute("src");
  other().item = null;
  if (autoplay) ensureContext();
  const d = deck();
  d.el.pause();
  try {
    await setSource(d, item);
    if (positionMs > 0) {
      await new Promise<void>((resolve) => {
        const go = () => {
          d.el.currentTime = positionMs / 1000;
          resolve();
        };
        if (d.el.readyState >= 1) go();
        else d.el.addEventListener("loadedmetadata", go, { once: true });
      });
    }
    if (autoplay) {
      await d.el.play();
      status = "playing";
    } else status = "paused";
  } catch (e) {
    status = "paused";
    fail(item, e);
  }
  sendState();
}

/** Passe au morceau suivant préparé (fin du morceau ou début du fondu). */
async function advance(withFade: boolean) {
  const item = nextItem;
  const from = deck();
  if (!item) return false;
  nextItem = null;
  const to = other();
  try {
    if (to.item?.id !== item.id || !to.url) await setSource(to, item);
    else if (to.gain) to.gain.gain.value = dbToGain(item.gain_db);
    to.el.currentTime = 0;
    if (withFade && ctx && from.gain && to.gain) {
      const now = ctx.currentTime;
      const dur = crossfadeMs / 1000;
      const target = dbToGain(item.gain_db);
      to.gain.gain.setValueAtTime(0.0001, now);
      to.gain.gain.exponentialRampToValueAtTime(target, now + dur);
      from.gain.gain.setValueAtTime(from.gain.gain.value, now);
      from.gain.gain.linearRampToValueAtTime(0, now + dur);
      fading = true;
      window.setTimeout(() => {
        from.el.pause();
        fading = false;
      }, crossfadeMs + 50);
    } else {
      from.el.pause();
    }
    await to.el.play();
    cur = 1 - cur;
    status = "playing";
    emit("player:track", { id: item.id });
    sendState();
    return true;
  } catch (e) {
    fail(item, e);
    return false;
  }
}

for (const [i, d] of decks.entries()) {
  d.el.addEventListener("ended", async () => {
    if (i !== cur || fading) return;
    if (sleepEndOfTrack) {
      sleepEndOfTrack = false;
      status = "paused";
      sendState();
      return;
    }
    if (!(await advance(false))) {
      status = "stopped";
      emit("player:ended");
      sendState();
    }
  });
  d.el.addEventListener("error", () => {
    if (i !== cur || !d.item) return;
    const code = d.el.error?.code;
    fail(d.item, new Error(code === 4 ? "format non pris en charge par ce navigateur" : "erreur de décodage"));
  });
}

// Horloge : état 4 fois par seconde, début du fondu, minuteur de veille.
window.setInterval(() => {
  if (status !== "playing") return;
  const d = deck();
  if (sleepAt !== null && Date.now() >= sleepAt) {
    sleepAt = null;
    d.el.pause();
    status = "paused";
  }
  const remaining = (d.el.duration - d.el.currentTime) * 1000;
  if (!fading && crossfadeMs > 0 && nextItem && !nextItem.no_xfade && Number.isFinite(remaining) && remaining <= crossfadeMs) {
    void advance(true);
  }
  sendState();
}, 250);

// Visualiseur : 56 bandes logarithmiques, ~30 i/s.
let visData: Uint8Array<ArrayBuffer> | null = null;
window.setInterval(() => {
  if (!visualizer || status !== "playing" || !ctx) return;
  visData ??= new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(visData);
  const bands: number[] = [];
  const n = 56;
  const nyq = ctx.sampleRate / 2;
  for (let b = 0; b < n; b++) {
    const lo = 30 * Math.pow(16000 / 30, b / n);
    const hi = 30 * Math.pow(16000 / 30, (b + 1) / n);
    const i0 = Math.max(1, Math.floor((lo / nyq) * visData.length));
    const i1 = Math.max(i0 + 1, Math.ceil((hi / nyq) * visData.length));
    let m = 0;
    for (let i = i0; i < i1 && i < visData.length; i++) m = Math.max(m, visData[i]);
    bands.push(Math.min(255, m * (0.85 + (b / n) * 0.35)));
  }
  emit("player:spectrum", bands);
}, 33);

export const engine = {
  load,
  setNext(item: PlayItem | null) {
    nextItem = item;
    // Préchargement du suivant sur le lecteur libre (pour un enchaînement immédiat).
    const o = other();
    if (item && !fading && o.item?.id !== item.id) setSource(o, item).catch(() => {});
  },
  async command(action: string, value = 0) {
    const d = deck();
    switch (action) {
      case "play":
      case "toggle":
        if (action === "toggle" && status === "playing") {
          d.el.pause();
          status = "paused";
          break;
        }
        if (!d.item) return;
        ensureContext();
        try {
          await d.el.play();
          status = "playing";
        } catch (e) {
          fail(d.item, e);
        }
        break;
      case "pause":
        d.el.pause();
        status = "paused";
        break;
      case "stop":
        d.el.pause();
        d.el.currentTime = 0;
        status = "stopped";
        break;
      case "seek":
        if (d.item) d.el.currentTime = Math.max(0, value) / 1000;
        break;
      case "volume":
        volume = Math.max(0, Math.min(1, value));
        if (master) master.gain.value = volume;
        else for (const x of decks) x.el.volume = volume;
        break;
      case "visualizer":
        visualizer = value > 0.5;
        return;
    }
    sendState();
  },
  setDsp(config: DspConfig) {
    dsp = config;
    rebuildChain();
    sendState();
  },
  setOptions(o: { crossfade_ms: number }) {
    crossfadeMs = Math.max(0, o.crossfade_ms);
  },
  sleep(seconds: number | null, endOfTrack: boolean) {
    sleepAt = seconds ? Date.now() + seconds * 1000 : null;
    sleepEndOfTrack = endOfTrack;
    sendState();
  },
  devices: () => [DEVICE],
};
