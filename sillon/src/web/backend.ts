// « Cœur » de la version téléphone : répond aux mêmes commandes que le cœur Rust,
// avec IndexedDB pour la bibliothèque et le moteur audio web.
import type { DspConfig, Folder, LibraryData, Playlist, PlayItem, RuleSet, Stats, TagPatch, TopItem, Track } from "../lib/api";
import { emit } from "./bus";
import { engine, trackInfo } from "./engine";
import * as idb from "./idb";
import { COVER_SIZES, importFiles, storeCover } from "./importer";

type StoredTrack = Track & { lyrics?: string | null };
interface Play {
  track_id: number;
  started_at: number;
  ms_played: number;
}

export const COVERS_DIR = "web-covers";

// ------------------------------------------------------------------ fichiers choisis

/** Fichiers choisis dans le sélecteur, en attente d'import (jeton → fichiers). */
const picked = new Map<string, File[]>();
let pickCount = 0;
export function stashFiles(files: File[]): string {
  const token = `import:${++pickCount}`;
  picked.set(token, files);
  return token;
}

// ------------------------------------------------------------------ pochettes

const coverUrls = new Map<string, string>();
/** URL d'une pochette à partir de son « chemin » (web-covers/<clé>_<taille>.jpg). */
export function coverUrlFor(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.jpg$/, "");
  return coverUrls.get(name) ?? "";
}

async function loadCovers(): Promise<Record<string, [string, string, string]>> {
  const colors: Record<string, [string, string, string]> = {};
  for (const [k, v] of await idb.entries<Blob | [string, string, string]>("covers")) {
    const key = String(k);
    if (v instanceof Blob) {
      if (!coverUrls.has(key)) coverUrls.set(key, URL.createObjectURL(v));
    } else colors[key] = v;
  }
  return colors;
}

// ------------------------------------------------------------------ outils

const now = () => Math.floor(Date.now() / 1000);

async function setting<T>(key: string): Promise<T | undefined> {
  return idb.get<T>("settings", key);
}

async function nextIdFactory(): Promise<() => number> {
  const all = await idb.getAll<Track>("tracks");
  let next = Math.max((await setting<number>("__next_id")) ?? 1, ...all.map((t) => t.id + 1));
  return () => {
    const id = next++;
    void idb.put("settings", next, "__next_id");
    return id;
  };
}

async function updateTrack(id: number, patch: Partial<StoredTrack>) {
  const t = await idb.get<StoredTrack>("tracks", id);
  if (t) await idb.put("tracks", { ...t, ...patch });
}

function localParts(sec: number) {
  const d = new Date(sec * 1000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { hour: d.getHours(), weekday: (d.getDay() + 6) % 7, day };
}

async function stats(from: number, to: number): Promise<Stats> {
  const plays = (await idb.getAll<Play>("plays")).filter((p) => p.started_at >= from && p.started_at < to);
  const byId = new Map((await idb.getAll<StoredTrack>("tracks")).map((t) => [t.id, t]));
  const rows = plays.map((p) => ({ p, t: byId.get(p.track_id) })).filter((r): r is { p: Play; t: StoredTrack } => !!r.t);
  const group = (keyOf: (t: StoredTrack) => string | null, item: (t: StoredTrack) => Omit<TopItem, "plays" | "ms">, limit: number, byMs: boolean) => {
    const m = new Map<string, TopItem>();
    for (const { p, t } of rows) {
      const k = keyOf(t);
      if (k === null) continue;
      const cur = m.get(k) ?? { ...item(t), plays: 0, ms: 0 };
      cur.plays++;
      cur.ms += p.ms_played;
      if (!cur.cover && t.cover) cur.cover = t.cover;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => (byMs ? b.ms - a.ms : b.plays - a.plays || b.ms - a.ms)).slice(0, limit);
  };
  const hours = Array<number>(24).fill(0);
  const weekdays = Array<number>(7).fill(0);
  const days = new Map<string, number>();
  for (const { p } of rows) {
    const l = localParts(p.started_at);
    hours[l.hour] += p.ms_played;
    weekdays[l.weekday] += p.ms_played;
    days.set(l.day, (days.get(l.day) ?? 0) + p.ms_played);
  }
  const albumArtist = (t: StoredTrack) => t.album_artist || t.artist;
  return {
    total_ms: rows.reduce((s, r) => s + r.p.ms_played, 0),
    total_plays: rows.length,
    distinct_tracks: new Set(rows.map((r) => r.t.id)).size,
    distinct_artists: new Set(rows.map((r) => r.t.artist)).size,
    top_tracks: group((t) => String(t.id), (t) => ({ name: t.title, sub: t.artist, cover: t.cover, track_id: t.id }), 25, false),
    top_artists: group((t) => (t.artist ? t.artist : null), (t) => ({ name: t.artist, sub: "", cover: t.cover, track_id: null }), 25, true),
    top_albums: group(
      (t) => (t.album ? `${t.album}\u0000${albumArtist(t)}` : null),
      (t) => ({ name: t.album, sub: albumArtist(t), cover: t.cover, track_id: t.id }),
      25,
      true,
    ),
    genres: group((t) => (t.genre ? t.genre : null), (t) => ({ name: t.genre, sub: "", cover: null, track_id: null }), 12, true),
    hours,
    weekdays,
    days: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

// ------------------------------------------------------------------ contrôles du système (écran verrouillé)

let mediaCover: string | null = null;
function mediaUpdate(info: { title: string; artist: string; album: string; cover: string | null; duration_ms: number; position_ms: number; status: string; metadata: boolean }) {
  const ms = navigator.mediaSession;
  if (!ms) return;
  if (info.metadata || mediaCover !== info.cover) {
    mediaCover = info.cover;
    const artwork: MediaImage[] = [];
    if (info.cover) {
      for (const size of [320, 1000]) {
        const url = coverUrlFor(info.cover.replace(/_\d+\.jpg$/, `_${size}.jpg`));
        if (url) artwork.push({ src: url, sizes: `${size}x${size}`, type: "image/jpeg" });
      }
    }
    ms.metadata = new MediaMetadata({ title: info.title, artist: info.artist, album: info.album, artwork });
  }
  ms.playbackState = info.status === "playing" ? "playing" : info.status === "paused" ? "paused" : "none";
  try {
    if (info.duration_ms > 0)
      ms.setPositionState({ duration: info.duration_ms / 1000, position: Math.min(info.position_ms, info.duration_ms) / 1000, playbackRate: 1 });
  } catch {
    /* position hors bornes pendant un changement de morceau */
  }
}

function initMediaSession() {
  const ms = navigator.mediaSession;
  if (!ms) return;
  const remote = (action: string, value?: number) => emit("remote", { action, value });
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      /* action non prise en charge */
    }
  };
  set("play", () => remote("play"));
  set("pause", () => remote("pause"));
  set("previoustrack", () => remote("previous"));
  set("nexttrack", () => remote("next"));
  set("seekto", (d) => remote("seek", (d.seekTime ?? 0) * 1000));
  set("seekbackward", (d) => remote("seek_by", -(d.seekOffset ?? 10) * 1000));
  set("seekforward", (d) => remote("seek_by", (d.seekOffset ?? 10) * 1000));
}
initMediaSession();

// ------------------------------------------------------------------ commandes

type Args = Record<string, unknown>;
const handlers: Record<string, (a: Args) => unknown> = {
  async get_library(): Promise<LibraryData> {
    const covers = await loadCovers();
    const tracks = (await idb.getAll<StoredTrack>("tracks")).map(({ lyrics: _l, ...t }) => t);
    for (const t of tracks) trackInfo.set(t.id, { rate: t.sample_rate, bits: t.bit_depth });
    return { tracks, covers, covers_dir: COVERS_DIR };
  },
  async get_folders(): Promise<Folder[]> {
    const n = (await idb.getAll<Track>("tracks")).length;
    return n ? [{ id: 1, path: "Morceaux importés sur cet appareil", tracks: n }] : [];
  },
  async add_folder({ path }) {
    const files = picked.get(String(path));
    picked.delete(String(path));
    if (!files?.length) return;
    navigator.storage?.persist?.().catch(() => {});
    const nextId = await nextIdFactory();
    const res = await importFiles(files, nextId, (done, total) => emit("scan:progress", { phase: "scan", done, total }));
    emit("scan:progress", { phase: "done", done: 0, total: 0 });
    emit("library:changed");
    if (res.failed.length) emit("app:error", `Non importés (format illisible) : ${res.failed.slice(0, 4).join(", ")}${res.failed.length > 4 ? "…" : ""}`);
  },
  async remove_folder() {
    // Retire tout ce qui a été importé sur l'appareil (les listes de lecture restent).
    await Promise.all([idb.clear("tracks"), idb.clear("files"), idb.clear("covers")]);
    for (const u of coverUrls.values()) URL.revokeObjectURL(u);
    coverUrls.clear();
    emit("library:changed");
  },
  rescan() {
    emit("library:changed");
  },
  async get_lyrics({ id }) {
    return (await idb.get<StoredTrack>("tracks", Number(id)))?.lyrics ?? null;
  },
  async search_lyrics({ query }) {
    const q = String(query).trim().toLowerCase();
    if ([...q].length < 3) return [];
    return (await idb.getAll<StoredTrack>("tracks")).filter((t) => t.lyrics?.toLowerCase().includes(q)).slice(0, 60).map((t) => t.id);
  },
  set_rating: ({ id, rating }) => updateTrack(Number(id), { rating: Math.max(0, Math.min(5, Number(rating))) }),
  set_loved: ({ id, loved }) => updateTrack(Number(id), { loved: !!loved }),
  async record_play({ id, startedAt, msPlayed, counted, skipped }) {
    const t = await idb.get<StoredTrack>("tracks", Number(id));
    if (!t) return;
    if (Number(msPlayed) >= 5000) await idb.put("plays", { track_id: t.id, started_at: Number(startedAt), ms_played: Number(msPlayed) } satisfies Play);
    if (counted) await idb.put("tracks", { ...t, play_count: t.play_count + 1, last_played: now() });
    else if (skipped) await idb.put("tracks", { ...t, skip_count: t.skip_count + 1 });
  },
  get_stats: ({ from, to }) => stats(Number(from), Number(to)),
  async write_tags({ ids, patch }) {
    const p = patch as TagPatch;
    const num = (v: string | undefined) => (v === undefined ? undefined : v.trim() ? Number.parseInt(v, 10) || null : null);
    let cover: string | null | undefined;
    if (p.remove_cover) cover = null;
    else if (p.cover_path) {
      const file = picked.get(p.cover_path)?.[0];
      if (file) cover = await storeCover(new Uint8Array(await file.arrayBuffer()), file.type);
    }
    for (const id of ids as number[]) {
      const t = await idb.get<StoredTrack>("tracks", id);
      if (!t) continue;
      const next: StoredTrack = { ...t };
      for (const k of ["title", "artist", "album_artist", "album", "genre", "composer"] as const) if (p[k] !== undefined) next[k] = p[k]!;
      if (p.year !== undefined) next.year = num(p.year) ?? null;
      if (p.track_no !== undefined) next.track_no = num(p.track_no) ?? null;
      if (p.disc_no !== undefined) next.disc_no = num(p.disc_no) ?? null;
      if (p.lyrics !== undefined) {
        next.lyrics = p.lyrics || null;
        next.has_lyrics = !!p.lyrics;
      }
      if (cover !== undefined) next.cover = cover;
      await idb.put("tracks", next);
    }
    emit("library:changed");
    return [];
  },
  online_complete() {},
  async get_playlists(): Promise<Playlist[]> {
    return (await idb.getAll<Playlist>("playlists")).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  },
  async save_playlist({ id, name, kind, rules }) {
    if (id !== null && id !== undefined) {
      const p = await idb.get<Playlist>("playlists", Number(id));
      if (p) await idb.put("playlists", { ...p, name: String(name), rules: (rules as RuleSet | null) ?? null, updated_at: now() });
      return Number(id);
    }
    const all = await idb.getAll<Playlist>("playlists");
    const newId = Math.max(0, ...all.map((p) => p.id)) + 1;
    await idb.put("playlists", { id: newId, name: String(name), kind: kind as Playlist["kind"], rules: (rules as RuleSet | null) ?? null, created_at: now(), updated_at: now(), track_ids: [] } satisfies Playlist);
    return newId;
  },
  delete_playlist: ({ id }) => idb.del("playlists", Number(id)),
  async set_playlist_tracks({ id, ids }) {
    const p = await idb.get<Playlist>("playlists", Number(id));
    if (p) await idb.put("playlists", { ...p, track_ids: ids as number[], updated_at: now() });
  },
  async get_settings() {
    const out: Record<string, unknown> = {};
    for (const [k, v] of await idb.entries("settings")) if (!String(k).startsWith("__")) out[String(k)] = v;
    return out;
  },
  set_setting: ({ key, value }) => idb.put("settings", value, String(key)),
  player_load: ({ item, positionMs, autoplay }) => engine.load(item as PlayItem, Number(positionMs), !!autoplay),
  player_set_next: ({ item }) => engine.setNext((item as PlayItem | null) ?? null),
  player_command: ({ action, value }) => engine.command(String(action), value === undefined || value === null ? 0 : Number(value)),
  player_set_dsp: ({ config }) => engine.setDsp(config as DspConfig),
  player_set_options: ({ options }) => engine.setOptions(options as { crossfade_ms: number }),
  player_sleep: ({ seconds, endOfTrack }) => engine.sleep((seconds as number | null) ?? null, !!endOfTrack),
  player_devices: () => engine.devices(),
  media_update: ({ info }) => mediaUpdate(info as Parameters<typeof mediaUpdate>[0]),
  open_mini() {},
  close_mini() {},
};

export async function invoke<T>(cmd: string, args: Args = {}): Promise<T> {
  const h = handlers[cmd];
  if (!h) throw new Error(`Commande inconnue : ${cmd}`);
  return (await h(args)) as T;
}

export { COVER_SIZES };
