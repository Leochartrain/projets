// État global de l'interface (zustand).
import type { ReactNode } from "react";
import { create } from "zustand";
import { api, setCoversDir, type Band, type PlayerState, type Playlist, type Track } from "./api";
import { derive, type Derived } from "./library";
import type { Mix } from "./smart";

export interface Route {
  name:
    | "home"
    | "albums"
    | "album"
    | "artists"
    | "artist"
    | "tracks"
    | "genres"
    | "genre"
    | "playlists"
    | "playlist"
    | "mix"
    | "stats"
    | "settings"
    | "search"
    | "duplicates";
  param?: string;
}

export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const flatBands = (): Band[] => EQ_FREQS.map((freq) => ({ freq, gain: 0, q: 1.41 }));

export interface EqSettings {
  enabled: boolean;
  preamp: number;
  bands: Band[];
  limiter: boolean;
  preset: string;
}

export interface Settings {
  theme: "auto" | "light" | "dark";
  dynamicColors: boolean;
  reduceMotion: boolean;
  visualizer: "off" | "bars" | "wave";
  volume: number;
  muted: boolean;
  crossfade: number;
  replayGain: "off" | "track" | "album";
  device: string | null;
  matchRate: boolean;
  eq: EqSettings;
  eqPresets: Record<string, { preamp: number; gains: number[] }>;
  analysis: boolean;
  online: boolean;
  session: { queue: number[]; index: number; positionMs: number; shuffle: boolean; repeat: Repeat } | null;
  mixes: { week: string; mixes: Mix[] } | null;
}

export type Repeat = "off" | "all" | "one";

export const DEFAULT_SETTINGS: Settings = {
  theme: "auto",
  dynamicColors: true,
  reduceMotion: false,
  visualizer: "bars",
  volume: 1,
  muted: false,
  crossfade: 0,
  replayGain: "off",
  device: null,
  matchRate: true,
  eq: { enabled: false, preamp: 0, bands: flatBands(), limiter: true, preset: "Plat" },
  eqPresets: {},
  analysis: true,
  online: false,
  session: null,
  mixes: null,
};

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  action?: () => void;
  children?: MenuItem[];
  separator?: boolean;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
}

interface AppState extends Derived {
  // Bibliothèque
  tracks: Track[];
  covers: Record<string, [string, string, string]>;
  loaded: boolean;
  playlists: Playlist[];
  scan: { phase: string; done: number; total: number } | null;
  analysis: { done: number; remaining: number } | null;
  // Lecteur
  player: PlayerState;
  positionAt: number;
  queue: number[];
  index: number;
  history: number[];
  shuffle: boolean;
  repeat: Repeat;
  radioSeed: number[] | null;
  // Réglages
  settings: Settings;
  // Interface
  routes: Route[];
  routeIndex: number;
  nowPlaying: boolean;
  queueOpen: boolean;
  paletteOpen: boolean;
  eqOpen: boolean;
  tagEditor: number[] | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  toasts: Toast[];
  selection: Set<number>;

  refresh: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  patchTrack: (id: number, patch: Partial<Track>) => void;
  set: (patch: Partial<AppState>) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  navigate: (route: Route) => void;
  back: () => void;
  forward: () => void;
  toast: (text: string, kind?: "info" | "error") => void;
  openMenu: (e: { clientX: number; clientY: number; preventDefault: () => void }, items: MenuItem[]) => void;
}

const emptyDerived = derive([]);
let toastId = 1;

export const useApp = create<AppState>((set, get) => ({
  ...emptyDerived,
  tracks: [],
  covers: {},
  loaded: false,
  playlists: [],
  scan: null,
  analysis: null,
  player: {
    status: "stopped",
    track_id: null,
    position_ms: 0,
    duration_ms: 0,
    out_rate: 0,
    file_rate: 0,
    bits: 0,
    resampled: false,
    dsp_active: false,
    device: "",
    sleep_remaining: null,
    sleep_end_of_track: false,
  },
  positionAt: 0,
  queue: [],
  index: -1,
  history: [],
  shuffle: false,
  repeat: "off",
  radioSeed: null,
  settings: DEFAULT_SETTINGS,
  routes: [{ name: "home" }],
  routeIndex: 0,
  nowPlaying: false,
  queueOpen: false,
  paletteOpen: false,
  eqOpen: false,
  tagEditor: null,
  menu: null,
  toasts: [],
  selection: new Set(),

  refresh: async () => {
    const lib = await api.getLibrary();
    setCoversDir(lib.covers_dir);
    set({ tracks: lib.tracks, covers: lib.covers, loaded: true, ...derive(lib.tracks) });
  },
  refreshPlaylists: async () => set({ playlists: await api.getPlaylists() }),
  patchTrack: (id, patch) => {
    // Mise à jour locale légère (note, cœur, compteur) sans tout recalculer.
    const { byId, tracks } = get();
    const t = byId.get(id);
    if (!t) return;
    const next = { ...t, ...patch };
    byId.set(id, next);
    set({ tracks: tracks.map((x) => (x.id === id ? next : x)), byId: new Map(byId) });
  },
  set: (patch) => set(patch),
  setSetting: (key, value) => {
    set({ settings: { ...get().settings, [key]: value } });
    api.setSetting(key, value).catch(() => {});
  },
  navigate: (route) => {
    const { routes, routeIndex } = get();
    const cur = routes[routeIndex];
    if (cur.name === route.name && cur.param === route.param) {
      set({ nowPlaying: false });
      return;
    }
    const next = [...routes.slice(0, routeIndex + 1), route].slice(-60);
    set({ routes: next, routeIndex: next.length - 1, nowPlaying: false, selection: new Set() });
  },
  back: () => get().routeIndex > 0 && set({ routeIndex: get().routeIndex - 1, selection: new Set() }),
  forward: () => get().routeIndex < get().routes.length - 1 && set({ routeIndex: get().routeIndex + 1, selection: new Set() }),
  toast: (text, kind = "info") => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === "error" ? 6000 : 2800);
  },
  openMenu: (e, items) => {
    e.preventDefault();
    set({ menu: { x: e.clientX, y: e.clientY, items } });
  },
}));

export const useRoute = () => useApp((s) => s.routes[s.routeIndex]);
export const useCurrentTrack = () => useApp((s) => (s.player.track_id !== null ? s.byId.get(s.player.track_id) : undefined));
export const getApp = () => useApp.getState();
