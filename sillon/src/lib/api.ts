// Types partagés et appels vers le cœur Rust.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string;
  album: string;
  year: number | null;
  genre: string;
  track_no: number | null;
  disc_no: number | null;
  composer: string;
  duration_ms: number;
  format: string;
  sample_rate: number;
  bit_depth: number;
  bitrate: number;
  channels: number;
  file_size: number;
  added_at: number;
  cover: string | null;
  has_lyrics: boolean;
  rg_track: number | null;
  rg_album: number | null;
  peak: number | null;
  bpm: number | null;
  key: string | null;
  energy: number | null;
  intensity: number | null;
  danceability: number | null;
  valence: number | null;
  mood: string | null;
  rating: number;
  loved: boolean;
  play_count: number;
  skip_count: number;
  last_played: number | null;
}

export interface LibraryData {
  tracks: Track[];
  covers: Record<string, [string, string, string]>;
  covers_dir: string;
}

export interface Folder {
  id: number;
  path: string;
  tracks: number;
}

export interface Rule {
  field: string;
  op: string;
  value: string;
}

export interface RuleSet {
  match: "all" | "any";
  rules: Rule[];
  limit: number;
  sort: string;
}

export interface Playlist {
  id: number;
  name: string;
  kind: "manual" | "smart";
  rules: RuleSet | null;
  created_at: number;
  updated_at: number;
  track_ids: number[];
}

export interface TopItem {
  name: string;
  sub: string;
  cover: string | null;
  track_id: number | null;
  plays: number;
  ms: number;
}

export interface Stats {
  total_ms: number;
  total_plays: number;
  distinct_tracks: number;
  distinct_artists: number;
  top_tracks: TopItem[];
  top_artists: TopItem[];
  top_albums: TopItem[];
  genres: TopItem[];
  hours: number[];
  weekdays: number[];
  days: [string, number][];
}

export interface PlayerState {
  status: "playing" | "paused" | "stopped";
  track_id: number | null;
  position_ms: number;
  duration_ms: number;
  out_rate: number;
  file_rate: number;
  bits: number;
  resampled: boolean;
  dsp_active: boolean;
  device: string;
  sleep_remaining: number | null;
  sleep_end_of_track: boolean;
}

export interface PlayItem {
  id: number;
  path: string;
  gain_db: number;
  no_xfade: boolean;
  duration_ms: number;
}

export interface Band {
  freq: number;
  gain: number;
  q: number;
}

export interface DspConfig {
  enabled: boolean;
  preamp: number;
  bands: Band[];
  limiter: boolean;
}

export interface TagPatch {
  title?: string;
  artist?: string;
  album_artist?: string;
  album?: string;
  genre?: string;
  composer?: string;
  year?: string;
  track_no?: string;
  disc_no?: string;
  lyrics?: string;
  cover_path?: string;
  remove_cover?: boolean;
}

export const api = {
  getLibrary: () => invoke<LibraryData>("get_library"),
  getFolders: () => invoke<Folder[]>("get_folders"),
  addFolder: (path: string) => invoke<void>("add_folder", { path }),
  removeFolder: (id: number) => invoke<void>("remove_folder", { id }),
  rescan: () => invoke<void>("rescan"),
  getLyrics: (id: number) => invoke<string | null>("get_lyrics", { id }),
  searchLyrics: (query: string) => invoke<number[]>("search_lyrics", { query }),
  setRating: (id: number, rating: number) => invoke<void>("set_rating", { id, rating }),
  setLoved: (id: number, loved: boolean) => invoke<void>("set_loved", { id, loved }),
  recordPlay: (id: number, startedAt: number, msPlayed: number, counted: boolean, skipped: boolean) =>
    invoke<void>("record_play", { id, startedAt, msPlayed: Math.round(msPlayed), counted, skipped }),
  getStats: (from: number, to: number) => invoke<Stats>("get_stats", { from, to }),
  writeTags: (ids: number[], patch: TagPatch) => invoke<string[]>("write_tags", { ids, patch }),
  onlineComplete: () => invoke<void>("online_complete"),
  getPlaylists: () => invoke<Playlist[]>("get_playlists"),
  savePlaylist: (id: number | null, name: string, kind: string, rules: RuleSet | null) =>
    invoke<number>("save_playlist", { id, name, kind, rules }),
  deletePlaylist: (id: number) => invoke<void>("delete_playlist", { id }),
  setPlaylistTracks: (id: number, ids: number[]) => invoke<void>("set_playlist_tracks", { id, ids }),
  getSettings: () => invoke<Record<string, unknown>>("get_settings"),
  setSetting: (key: string, value: unknown) => invoke<void>("set_setting", { key, value }),
  load: (item: PlayItem, positionMs: number, autoplay: boolean) =>
    invoke<void>("player_load", { item, positionMs: Math.max(0, Math.round(positionMs)), autoplay }),
  setNext: (item: PlayItem | null) => invoke<void>("player_set_next", { item }),
  command: (action: string, value?: number) => invoke<void>("player_command", { action, value }),
  setDsp: (config: DspConfig) => invoke<void>("player_set_dsp", { config }),
  setOptions: (options: { crossfade_ms: number; device: string | null; match_rate: boolean }) =>
    invoke<void>("player_set_options", { options }),
  sleep: (seconds: number | null, endOfTrack: boolean) => invoke<void>("player_sleep", { seconds, endOfTrack }),
  devices: () => invoke<string[]>("player_devices"),
  mediaUpdate: (info: {
    title: string;
    artist: string;
    album: string;
    cover: string | null;
    duration_ms: number;
    position_ms: number;
    status: string;
    metadata: boolean;
  }) => invoke<void>("media_update", { info }),
  openMini: () => invoke<void>("open_mini"),
  closeMini: () => invoke<void>("close_mini"),
};

let coversDir = "";
export function setCoversDir(dir: string) {
  coversDir = dir;
}

/** Chemin local d'une pochette en cache (pour les contrôles média du système). */
export function coverPath(key: string | null | undefined, size: 96 | 320 | 1000 = 320): string | null {
  if (!key || !coversDir) return null;
  const sep = coversDir.includes("\\") ? "\\" : "/";
  return `${coversDir}${sep}${key}_${size}.jpg`;
}

const urlCache = new Map<string, string>();
/** URL affichable d'une pochette en cache. */
export function coverUrl(key: string | null | undefined, size: 96 | 320 | 1000 = 320): string | undefined {
  const p = coverPath(key, size);
  if (!p) return undefined;
  let u = urlCache.get(p);
  if (!u) {
    u = convertFileSrc(p);
    urlCache.set(p, u);
  }
  return u;
}
