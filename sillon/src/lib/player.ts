// Contrôleur de lecture : file d'attente, enchaînements, écoutes, reprise de session.
// Le moteur audio (Rust) ne connaît que « le morceau en cours » et « le suivant ».
import { listen } from "@tauri-apps/api/event";
import { api, coverPath, type PlayItem, type PlayerState, type Track } from "./api";
import { albumKeyOf } from "./library";
import { radio, smartShuffle } from "./smart";
import { DEFAULT_SETTINGS, getApp, useApp, type Repeat, type Settings } from "./store";

let session: { id: number; startedAt: number; listened: number; lastTick: number } | null = null;
let originalQueue: number[] | null = null;
let errorStreak = 0;
let saveTimer: number | undefined;
let lastMedia = { id: -1, status: "", at: 0 };

function makeItem(id: number, prevId?: number): PlayItem | null {
  const { byId, settings } = getApp();
  const t = byId.get(id);
  if (!t) return null;
  let gain = 0;
  if (settings.replayGain === "track") gain = t.rg_track ?? 0;
  if (settings.replayGain === "album") gain = t.rg_album ?? t.rg_track ?? 0;
  // On ne monte jamais au point de saturer : le gain positif est borné par la crête connue.
  if (gain > 0 && t.peak && t.peak > 0) gain = Math.min(gain, -20 * Math.log10(t.peak));
  const prev = prevId !== undefined ? byId.get(prevId) : undefined;
  const gapless =
    !!prev &&
    !!t.album &&
    albumKeyOf(prev) === albumKeyOf(t) &&
    (prev.disc_no ?? 1) === (t.disc_no ?? 1) &&
    t.track_no !== null &&
    prev.track_no !== null &&
    t.track_no === prev.track_no + 1;
  return { id, path: t.path, gain_db: gain, no_xfade: gapless, duration_ms: t.duration_ms };
}

function nextIndex(): number {
  const { queue, index, repeat } = getApp();
  if (repeat === "one" && index >= 0) return index;
  if (index + 1 < queue.length) return index + 1;
  if (repeat === "all" && queue.length) return 0;
  return -1;
}

/** Indique au moteur quel morceau enchaîner (sans blanc) après le morceau en cours. */
export function sendNext() {
  const { queue, index } = getApp();
  const n = nextIndex();
  api.setNext(n >= 0 ? makeItem(queue[n], queue[index]) : null).catch(() => {});
}

function finalize(manual: boolean) {
  if (!session) return;
  const s = session;
  session = null;
  const t = getApp().byId.get(s.id);
  if (!t) return;
  // Règle classique : compté si écouté à moitié, ou au moins 4 minutes.
  const counted = s.listened >= Math.min(t.duration_ms * 0.5, 240_000) && s.listened >= 15_000;
  const skipped = manual && !counted && s.listened < 30_000 && s.listened > 1000;
  api.recordPlay(s.id, s.startedAt, s.listened, counted, skipped).catch(() => {});
  if (counted) getApp().patchTrack(s.id, { play_count: t.play_count + 1, last_played: Math.floor(Date.now() / 1000) });
  else if (skipped) getApp().patchTrack(s.id, { skip_count: t.skip_count + 1 });
}

function begin(id: number) {
  session = { id, startedAt: Math.floor(Date.now() / 1000), listened: 0, lastTick: performance.now() };
  const { history } = getApp();
  if (history[0] !== id) useApp.setState({ history: [id, ...history].slice(0, 200) });
}

function saveSession(now = false) {
  window.clearTimeout(saveTimer);
  const write = () => {
    const s = getApp();
    const position = currentPosition();
    s.setSetting("session", { queue: s.queue.slice(0, 5000), index: s.index, positionMs: position, shuffle: s.shuffle, repeat: s.repeat });
  };
  if (now) write();
  else saveTimer = window.setTimeout(write, 800);
}

/** Position estimée à l'instant (le moteur envoie son état 4 fois par seconde). */
export function currentPosition(): number {
  const { player, positionAt } = getApp();
  if (player.status !== "playing") return player.position_ms;
  const p = player.position_ms + (performance.now() - positionAt);
  return player.duration_ms ? Math.min(p, player.duration_ms) : p;
}

function startAt(index: number, positionMs = 0, autoplay = true) {
  const s = getApp();
  const id = s.queue[index];
  const item = id !== undefined ? makeItem(id) : null;
  if (!item) return;
  finalize(true);
  const t = s.byId.get(id)!;
  useApp.setState({
    index,
    positionAt: performance.now(),
    player: { ...s.player, track_id: id, position_ms: positionMs, duration_ms: t.duration_ms, status: autoplay ? "playing" : "paused" },
  });
  api.load(item, positionMs, autoplay).catch((e) => s.toast(String(e), "error"));
  if (autoplay) begin(id);
  sendNext();
  extendRadio();
  saveSession();
}

function extendRadio() {
  const s = getApp();
  if (!s.radioSeed || s.queue.length - s.index > 5) return;
  const seeds = [...s.radioSeed, ...s.queue.slice(-3)].map((id) => s.byId.get(id)).filter((t): t is Track => !!t);
  const more = radio(seeds, s.tracks, 15, new Set(s.queue.slice(-150)));
  if (more.length) useApp.setState({ queue: [...s.queue, ...more] });
}

// ------------------------------------------------------------------ actions publiques

export const player = {
  /** Remplace la file par `ids` et lance la lecture à `start`. */
  playQueue(ids: number[], start = 0, opts: { shuffle?: boolean } = {}) {
    if (!ids.length) return;
    const s = getApp();
    const doShuffle = opts.shuffle ?? s.shuffle;
    let queue = ids;
    let index = Math.max(0, Math.min(start, ids.length - 1));
    originalQueue = null;
    if (doShuffle) {
      originalQueue = ids;
      const first = opts.shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[index];
      const rest = ids.filter((id, i) => (opts.shuffle ? id !== first : i !== index));
      queue = [first, ...smartShuffle(rest, s.byId, first)];
      index = 0;
    }
    useApp.setState({ queue, shuffle: doShuffle, radioSeed: null });
    startAt(index);
  },
  playIndex(index: number) {
    startAt(index);
  },
  toggle() {
    const s = getApp();
    if (s.player.track_id === null) {
      if (s.queue.length) startAt(Math.max(0, s.index));
      else if (s.tracks.length) player.playQueue(s.tracks.map((t) => t.id), 0, { shuffle: true });
      return;
    }
    if (s.player.status !== "playing" && !session && s.player.track_id !== null) begin(s.player.track_id);
    api.command("toggle");
  },
  next() {
    const s = getApp();
    // « Suivant » manuel ignore la répétition d'un seul titre.
    const n = s.index + 1 < s.queue.length ? s.index + 1 : s.repeat !== "off" && s.queue.length ? 0 : -1;
    if (n >= 0) startAt(n);
  },
  previous() {
    const s = getApp();
    if (currentPosition() > 3000 || s.index <= 0) player.seek(0);
    else startAt(s.index - 1);
  },
  seek(ms: number) {
    const s = getApp();
    const pos = Math.max(0, Math.min(ms, s.player.duration_ms || ms));
    useApp.setState({ player: { ...s.player, position_ms: pos }, positionAt: performance.now() });
    api.command("seek", pos);
    saveSession();
  },
  seekBy(deltaMs: number) {
    player.seek(currentPosition() + deltaMs);
  },
  playNext(ids: number[]) {
    const s = getApp();
    if (!s.queue.length) return player.playQueue(ids);
    const queue = [...s.queue.slice(0, s.index + 1), ...ids, ...s.queue.slice(s.index + 1)];
    useApp.setState({ queue });
    sendNext();
    saveSession();
    s.toast(ids.length > 1 ? `${ids.length} titres à lire ensuite` : "Sera lu ensuite");
  },
  addToQueue(ids: number[]) {
    const s = getApp();
    if (!s.queue.length) return player.playQueue(ids);
    useApp.setState({ queue: [...s.queue, ...ids] });
    sendNext();
    saveSession();
    s.toast(ids.length > 1 ? `${ids.length} titres ajoutés à la file` : "Ajouté à la file d'attente");
  },
  removeFromQueue(index: number) {
    const s = getApp();
    if (index === s.index) return;
    const queue = s.queue.filter((_, i) => i !== index);
    useApp.setState({ queue, index: index < s.index ? s.index - 1 : s.index });
    sendNext();
    saveSession();
  },
  /** Nouvel ordre des morceaux à venir (après un glisser-déposer). */
  setUpcoming(ids: number[]) {
    const s = getApp();
    useApp.setState({ queue: [...s.queue.slice(0, s.index + 1), ...ids] });
    sendNext();
    saveSession();
  },
  clearUpcoming() {
    const s = getApp();
    useApp.setState({ queue: s.queue.slice(0, s.index + 1), radioSeed: null });
    sendNext();
    saveSession();
  },
  toggleShuffle() {
    const s = getApp();
    const current = s.queue[s.index];
    if (!s.shuffle) {
      originalQueue = s.queue;
      const rest = smartShuffle(s.queue.slice(s.index + 1), s.byId, current);
      useApp.setState({ shuffle: true, queue: [...s.queue.slice(0, s.index + 1), ...rest] });
    } else {
      // Retour à l'ordre d'origine, en gardant le morceau en cours.
      const alive = new Set(s.queue);
      const queue = originalQueue ? originalQueue.filter((id) => alive.has(id)) : s.queue;
      const index = Math.max(0, queue.indexOf(current));
      originalQueue = null;
      useApp.setState({ shuffle: false, queue, index });
    }
    sendNext();
    saveSession();
  },
  cycleRepeat() {
    const order: Repeat[] = ["off", "all", "one"];
    const s = getApp();
    useApp.setState({ repeat: order[(order.indexOf(s.repeat) + 1) % 3] });
    sendNext();
    saveSession();
  },
  /** Radio : part des graines et enchaîne des morceaux proches, sans fin. */
  startRadio(seedIds: number[], playSeedFirst: boolean) {
    const s = getApp();
    const seeds = seedIds.map((id) => s.byId.get(id)).filter((t): t is Track => !!t);
    if (!seeds.length) return;
    const first = playSeedFirst ? seeds[0].id : seeds[Math.floor(Math.random() * seeds.length)].id;
    const similar = radio(seeds, s.tracks, 30, new Set([first]));
    originalQueue = null;
    useApp.setState({ queue: [first, ...similar], shuffle: false, radioSeed: seedIds.slice(0, 40) });
    startAt(0);
    s.toast("Radio lancée");
  },
  setVolume(v: number) {
    const s = getApp();
    const volume = Math.max(0, Math.min(1, v));
    s.setSetting("volume", volume);
    if (s.settings.muted && volume > 0) s.setSetting("muted", false);
    applyVolume();
  },
  toggleMute() {
    const s = getApp();
    s.setSetting("muted", !s.settings.muted);
    applyVolume();
  },
  async toggleLoved(id: number) {
    const t = getApp().byId.get(id);
    if (!t) return;
    getApp().patchTrack(id, { loved: !t.loved });
    await api.setLoved(id, !t.loved);
  },
  async setRating(id: number, rating: number) {
    getApp().patchTrack(id, { rating });
    await api.setRating(id, rating);
  },
};

export function applyVolume() {
  const { volume, muted } = getApp().settings;
  // Courbe quadratique : plus naturelle à l'oreille ; 100 % = signal intact.
  api.command("volume", muted ? 0 : volume * volume);
}

export function applyEngineSettings() {
  const st = getApp().settings;
  api.setDsp({ enabled: st.eq.enabled, preamp: st.eq.preamp, bands: st.eq.bands, limiter: st.eq.limiter });
  api.setOptions({ crossfade_ms: Math.round(st.crossfade * 1000), device: st.device, match_rate: st.matchRate });
  applyVolume();
  sendNext();
}

function updateMedia(state: PlayerState, force: boolean) {
  const t = state.track_id !== null ? getApp().byId.get(state.track_id) : undefined;
  if (!t) return;
  const now = performance.now();
  const metadata = lastMedia.id !== t.id;
  if (!force && !metadata && lastMedia.status === state.status && now - lastMedia.at < 5000) return;
  lastMedia = { id: t.id, status: state.status, at: now };
  api
    .mediaUpdate({
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: coverPath(t.cover, 320),
      duration_ms: t.duration_ms,
      position_ms: Math.round(state.position_ms),
      status: state.status,
      metadata,
    })
    .catch(() => {});
}

/** Branche les événements du moteur et restaure la session précédente. */
export async function initPlayer() {
  const app = getApp();
  const stored = (await api.getSettings()) as Partial<Settings>;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...stored, eq: { ...DEFAULT_SETTINGS.eq, ...(stored.eq ?? {}) } };
  useApp.setState({ settings });
  await Promise.all([app.refresh(), app.refreshPlaylists()]);
  applyEngineSettings();
  api.command("visualizer", 0);

  let refreshTimer: number | undefined;
  await listen("library:changed", () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => getApp().refresh().then(sendNext), 400);
  });
  await listen<{ phase: string; done: number; total: number }>("scan:progress", (e) => {
    useApp.setState({ scan: e.payload.phase === "done" ? null : e.payload });
    if (e.payload.phase === "done" && getApp().settings.online) api.onlineComplete();
  });
  await listen<{ done: number; remaining: number }>("analysis:progress", (e) => {
    useApp.setState({ analysis: e.payload.remaining > 0 ? e.payload : null });
  });
  await listen<string>("app:error", (e) => getApp().toast(e.payload, "error"));

  await listen<PlayerState>("player:state", (e) => {
    const state = e.payload;
    const now = performance.now();
    if (session && state.status === "playing" && state.track_id === session.id) {
      session.listened += Math.min(1500, now - session.lastTick);
    }
    if (session) session.lastTick = now;
    const prev = getApp().player;
    useApp.setState({ player: state, positionAt: now });
    if (state.status === "playing") errorStreak = 0;
    updateMedia(state, prev.status !== state.status);
    if (prev.status !== state.status || Math.floor(state.position_ms / 2000) !== Math.floor(prev.position_ms / 2000)) {
      saveSession(prev.status !== state.status);
    }
  });

  await listen<{ id: number }>("player:track", (e) => {
    // Enchaînement automatique (sans blanc ou en fondu) décidé par le moteur.
    const s = getApp();
    const id = e.payload.id;
    finalize(false);
    let index = s.index;
    if (!(s.repeat === "one" && s.queue[index] === id)) {
      if (s.queue[index + 1] === id) index += 1;
      else if (s.queue[0] === id && index === s.queue.length - 1) index = 0;
      else {
        const found = s.queue.indexOf(id, index + 1);
        index = found >= 0 ? found : Math.max(0, s.queue.indexOf(id));
      }
    }
    const t = s.byId.get(id);
    useApp.setState({
      index,
      positionAt: performance.now(),
      player: { ...s.player, track_id: id, position_ms: 0, duration_ms: t?.duration_ms ?? 0 },
    });
    begin(id);
    sendNext();
    extendRadio();
    saveSession();
  });

  await listen("player:ended", () => {
    finalize(false);
    saveSession(true);
  });

  await listen<{ id: number | null; message: string }>("player:error", (e) => {
    const s = getApp();
    s.toast(e.payload.message, "error");
    // Fichier illisible : on passe au suivant (trois essais au plus, pour ne pas boucler).
    if (e.payload.id !== null && e.payload.id === s.queue[s.index] && errorStreak < 3) {
      errorStreak++;
      session = null;
      player.next();
    }
  });

  await listen<{ action: string; value?: number }>("media:key", (e) => remote(e.payload.action, e.payload.value));
  await listen<{ action: string; value?: number }>("remote", (e) => remote(e.payload.action, e.payload.value));

  // Reprise : même file, même morceau, même position, en pause.
  const sess = settings.session;
  if (sess && sess.queue.length) {
    const byId = getApp().byId;
    const current = sess.queue[sess.index];
    const queue = sess.queue.filter((id) => byId.has(id));
    const index = queue.indexOf(current);
    useApp.setState({ queue, shuffle: sess.shuffle, repeat: sess.repeat });
    if (index >= 0) startAt(index, sess.positionMs, false);
    else useApp.setState({ index: -1 });
  }
  if (settings.online) api.onlineComplete();
}

export function remote(action: string, value?: number) {
  switch (action) {
    case "play":
      if (getApp().player.status !== "playing") player.toggle();
      break;
    case "pause":
      if (getApp().player.status === "playing") player.toggle();
      break;
    case "toggle":
      player.toggle();
      break;
    case "next":
      player.next();
      break;
    case "previous":
      player.previous();
      break;
    case "seek":
      player.seek(value ?? 0);
      break;
    case "seek_by":
      player.seekBy(value ?? 0);
      break;
    case "love": {
      const id = getApp().player.track_id;
      if (id !== null) player.toggleLoved(id);
      break;
    }
  }
}
