// Fonctions « intelligentes », 100 % locales : règles, radio, mix, doublons, lecture aléatoire.
import type { Rule, RuleSet, Track } from "./api";
import { albumArtistOf, normalize, qualityOf, qualityScore, splitGenres } from "./library";

// ------------------------------------------------------------------ hasard reproductible

export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], rnd: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lecture aléatoire sans le même artiste deux fois de suite (quand c'est possible). */
export function smartShuffle(ids: number[], byId: Map<number, Track>, after?: number): number[] {
  const a = shuffle(ids);
  const artist = (id: number | undefined) => (id === undefined ? "" : (byId.get(id)?.artist ?? ""));
  let prev = artist(after);
  for (let i = 0; i < a.length; i++) {
    if (artist(a[i]) === prev && prev) {
      for (let j = i + 1; j < a.length; j++) {
        if (artist(a[j]) !== prev) {
          [a[i], a[j]] = [a[j], a[i]];
          break;
        }
      }
    }
    prev = artist(a[i]);
  }
  return a;
}

// ------------------------------------------------------------------ playlists à règles

export type FieldType = "text" | "number" | "days" | "choice" | "bool";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  unit?: string;
  choices?: string[];
}

export const FIELDS: FieldDef[] = [
  { id: "title", label: "Titre", type: "text" },
  { id: "artist", label: "Artiste", type: "text" },
  { id: "album", label: "Album", type: "text" },
  { id: "genre", label: "Genre", type: "text" },
  { id: "composer", label: "Compositeur", type: "text" },
  { id: "year", label: "Année", type: "number" },
  { id: "rating", label: "Note", type: "number", unit: "étoiles" },
  { id: "loved", label: "Aimé", type: "bool" },
  { id: "play_count", label: "Nombre d'écoutes", type: "number" },
  { id: "skip_count", label: "Nombre de passages", type: "number" },
  { id: "added", label: "Date d'ajout", type: "days" },
  { id: "last_played", label: "Dernière écoute", type: "days" },
  { id: "duration", label: "Durée", type: "number", unit: "min" },
  { id: "bpm", label: "Tempo", type: "number", unit: "BPM" },
  { id: "energy", label: "Énergie", type: "number", unit: "%" },
  { id: "danceability", label: "Dansabilité", type: "number", unit: "%" },
  { id: "mood", label: "Humeur", type: "choice", choices: ["Joyeux", "Intense", "Paisible", "Mélancolique", "Détendu", "Rêveur"] },
  { id: "format", label: "Format", type: "choice", choices: ["FLAC", "ALAC", "WAV", "AIFF", "MP3", "AAC", "OGG", "Opus"] },
  { id: "quality", label: "Qualité", type: "choice", choices: ["Hi-Res", "Lossless", "Compressé"] },
  { id: "bit_depth", label: "Profondeur", type: "number", unit: "bits" },
  { id: "sample_rate", label: "Fréquence", type: "number", unit: "kHz" },
  { id: "lyrics", label: "Paroles", type: "bool" },
];

export const OPS: Record<FieldType, { id: string; label: string }[]> = {
  text: [
    { id: "contains", label: "contient" },
    { id: "not_contains", label: "ne contient pas" },
    { id: "is", label: "est" },
    { id: "is_not", label: "n'est pas" },
    { id: "starts", label: "commence par" },
  ],
  number: [
    { id: "gte", label: "au moins" },
    { id: "lte", label: "au plus" },
    { id: "eq", label: "égal à" },
    { id: "neq", label: "différent de" },
  ],
  days: [
    { id: "within", label: "dans les derniers (jours)" },
    { id: "older", label: "il y a plus de (jours)" },
    { id: "never", label: "jamais" },
  ],
  choice: [
    { id: "is", label: "est" },
    { id: "is_not", label: "n'est pas" },
  ],
  bool: [
    { id: "yes", label: "oui" },
    { id: "no", label: "non" },
  ],
};

export const SORTS = [
  { id: "default", label: "Artiste, album" },
  { id: "added", label: "Ajout le plus récent" },
  { id: "plays", label: "Les plus écoutés" },
  { id: "last_played", label: "Écoutés récemment" },
  { id: "rating", label: "Les mieux notés" },
  { id: "year", label: "Année" },
  { id: "bpm", label: "Tempo" },
  { id: "random", label: "Aléatoire" },
];

export const emptyRules = (): RuleSet => ({ match: "all", rules: [{ field: "genre", op: "contains", value: "" }], limit: 0, sort: "default" });

const QUALITY_LABEL = { hires: "Hi-Res", lossless: "Lossless", lossy: "Compressé" } as const;

function value(t: Track, field: string): string | number | boolean | null {
  switch (field) {
    case "title":
      return t.title;
    case "artist":
      return `${t.artist} ${t.album_artist}`;
    case "album":
      return t.album;
    case "genre":
      return t.genre;
    case "composer":
      return t.composer;
    case "year":
      return t.year;
    case "rating":
      return t.rating;
    case "loved":
      return t.loved;
    case "play_count":
      return t.play_count;
    case "skip_count":
      return t.skip_count;
    case "added":
      return t.added_at;
    case "last_played":
      return t.last_played;
    case "duration":
      return t.duration_ms / 60000;
    case "bpm":
      return t.bpm;
    case "energy":
      return t.energy === null ? null : t.energy * 100;
    case "danceability":
      return t.danceability === null ? null : t.danceability * 100;
    case "mood":
      return t.mood;
    case "format":
      return t.format;
    case "quality":
      return QUALITY_LABEL[qualityOf(t)];
    case "bit_depth":
      return t.bit_depth;
    case "sample_rate":
      return t.sample_rate / 1000;
    case "lyrics":
      return t.has_lyrics;
    default:
      return null;
  }
}

function test(t: Track, rule: Rule, now: number): boolean {
  const def = FIELDS.find((f) => f.id === rule.field);
  if (!def) return true;
  const v = value(t, rule.field);
  switch (def.type) {
    case "text": {
      const a = normalize(String(v ?? ""));
      const b = normalize(rule.value);
      if (!b) return true;
      if (rule.op === "contains") return a.includes(b);
      if (rule.op === "not_contains") return !a.includes(b);
      if (rule.op === "is") return a === b || (rule.field === "genre" && splitGenres(t.genre).some((g) => normalize(g) === b));
      if (rule.op === "is_not") return a !== b;
      return a.startsWith(b);
    }
    case "number": {
      const n = Number(rule.value.replace(",", "."));
      if (rule.value.trim() === "" || Number.isNaN(n)) return true;
      if (v === null) return false;
      const x = Number(v);
      if (rule.op === "gte") return x >= n;
      if (rule.op === "lte") return x <= n;
      if (rule.op === "eq") return Math.round(x) === Math.round(n);
      return Math.round(x) !== Math.round(n);
    }
    case "days": {
      if (rule.op === "never") return v === null;
      const days = Number(rule.value);
      if (!days) return true;
      const limit = now - days * 86400;
      if (rule.op === "within") return v !== null && Number(v) >= limit;
      return v === null || Number(v) < limit;
    }
    case "choice":
      if (!rule.value) return true;
      return rule.op === "is" ? v === rule.value : v !== rule.value;
    case "bool":
      return rule.op === "yes" ? !!v : !v;
  }
}

export function sortTracks(list: Track[], sort: string): Track[] {
  const a = [...list];
  const by = (f: (t: Track) => number) => a.sort((x, y) => f(y) - f(x));
  switch (sort) {
    case "added":
      return by((t) => t.added_at);
    case "plays":
      return by((t) => t.play_count);
    case "last_played":
      return by((t) => t.last_played ?? 0);
    case "rating":
      return by((t) => t.rating * 10 + (t.loved ? 1 : 0));
    case "year":
      return by((t) => t.year ?? 0);
    case "bpm":
      return a.sort((x, y) => (x.bpm ?? 999) - (y.bpm ?? 999));
    case "random":
      return shuffle(a);
    default:
      return a.sort(
        (x, y) =>
          albumArtistOf(x).localeCompare(albumArtistOf(y)) ||
          (x.year ?? 0) - (y.year ?? 0) ||
          x.album.localeCompare(y.album) ||
          (x.disc_no ?? 1) - (y.disc_no ?? 1) ||
          (x.track_no ?? 0) - (y.track_no ?? 0),
      );
  }
}

export function evaluate(set: RuleSet, tracks: Track[]): Track[] {
  const now = Date.now() / 1000;
  const rules = set.rules;
  const out = tracks.filter((t) =>
    set.match === "all" ? rules.every((r) => test(t, r, now)) : rules.length === 0 || rules.some((r) => test(t, r, now)),
  );
  const sorted = sortTracks(out, set.sort);
  return set.limit > 0 ? sorted.slice(0, set.limit) : sorted;
}

// ------------------------------------------------------------------ radio

function audioDistance(a: Track, b: Track): number | null {
  if (a.energy === null || b.energy === null) return null;
  const tempo =
    a.bpm && b.bpm
      ? // Un tempo double ou moitié « sonne » proche : on compare modulo l'octave.
        Math.min(...[0.5, 1, 2].map((k) => Math.abs(Math.log2((a.bpm! * k) / b.bpm!))))
      : 0.5;
  const d =
    1.2 * Math.min(1, tempo * 2) +
    1.6 * Math.abs(a.energy - b.energy) +
    1.0 * Math.abs((a.danceability ?? 0.5) - (b.danceability ?? 0.5)) +
    1.0 * Math.abs((a.valence ?? 0.5) - (b.valence ?? 0.5)) +
    0.8 * Math.abs((a.intensity ?? 0.5) - (b.intensity ?? 0.5));
  return d / 5.6;
}

/** Morceaux de la bibliothèque proches des graines : son, genre, artiste, habitudes d'écoute. */
export function radio(seeds: Track[], all: Track[], count: number, exclude: Set<number>): number[] {
  if (!seeds.length) return [];
  const seedGenres = new Set(seeds.flatMap((s) => splitGenres(s.genre).map(normalize)));
  const seedArtists = new Set(seeds.map((s) => s.artist));
  const sample = seeds.length > 12 ? shuffle(seeds).slice(0, 12) : seeds;
  const scored: { t: Track; s: number }[] = [];
  for (const t of all) {
    if (exclude.has(t.id)) continue;
    let sim = 0;
    let n = 0;
    for (const s of sample) {
      const d = audioDistance(s, t);
      if (d !== null) {
        sim += 1 - d;
        n++;
      }
    }
    const audio = n ? sim / n : 0.45;
    const genres = splitGenres(t.genre).map(normalize);
    const genre = genres.some((g) => seedGenres.has(g)) ? 1 : 0;
    const artist = seedArtists.has(t.artist) ? 1 : 0;
    const habit = (t.loved ? 0.5 : 0) + Math.min(0.5, Math.log1p(t.play_count) / 8) - Math.min(0.6, t.skip_count * 0.08);
    const s = 0.5 * audio + 0.25 * genre + 0.1 * artist + 0.1 * habit + 0.1 * Math.random();
    scored.push({ t, s });
  }
  scored.sort((a, b) => b.s - a.s);
  // Variété : pas le même artiste deux fois de suite, trois titres par artiste au plus.
  const out: number[] = [];
  const perArtist = new Map<string, number>();
  let last = seeds[seeds.length - 1].artist;
  const pool = scored.slice(0, Math.max(count * 6, 80));
  while (out.length < count && pool.length) {
    let i = pool.findIndex((p) => p.t.artist !== last && (perArtist.get(p.t.artist) ?? 0) < 3);
    if (i < 0) i = pool.findIndex((p) => (perArtist.get(p.t.artist) ?? 0) < 3);
    if (i < 0) i = 0;
    const [p] = pool.splice(i, 1);
    out.push(p.t.id);
    last = p.t.artist;
    perArtist.set(last, (perArtist.get(last) ?? 0) + 1);
  }
  return out;
}

// ------------------------------------------------------------------ mix hebdomadaires

export interface Mix {
  id: string;
  title: string;
  subtitle: string;
  ids: number[];
}

export function weekKey(d = new Date()): string {
  // Numéro de semaine ISO (lundi comme premier jour).
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

const FOCUS_GENRES = ["ambient", "classique", "classical", "jazz", "soundtrack", "bande originale", "lo-fi", "lofi", "piano", "instrumental", "post-rock", "electronica", "downtempo", "new age", "minimal"];

function pick(list: Track[], n: number, rnd: () => number, weight: (t: Track) => number): number[] {
  // Tirage pondéré, puis ordre sans répétition d'artiste.
  const scored = list.map((t) => ({ t, s: weight(t) * (0.6 + rnd() * 0.8) })).sort((a, b) => b.s - a.s);
  const out: Track[] = [];
  const perArtist = new Map<string, number>();
  for (const { t } of scored) {
    if ((perArtist.get(t.artist) ?? 0) >= 4) continue;
    perArtist.set(t.artist, (perArtist.get(t.artist) ?? 0) + 1);
    out.push(t);
    if (out.length >= n) break;
  }
  const byId = new Map(out.map((t) => [t.id, t]));
  return smartShuffle(shuffle(out.map((t) => t.id), rnd), byId);
}

/** Génère les cinq mix de la semaine. `monthTop` : ids les plus écoutés des 30 derniers jours. */
export function buildMixes(tracks: Track[], monthTop: number[], week: string): Mix[] {
  const now = Date.now() / 1000;
  const rnd = seeded(week);
  const analysed = tracks.filter((t) => t.energy !== null);
  const liked = (t: Track) => t.loved || t.rating >= 4 || t.play_count >= 5;
  const rediscover = tracks.filter((t) => liked(t) && (t.last_played ?? 0) < now - 60 * 86400);
  const calm = analysed.filter((t) => t.energy! < 0.4);
  const energy = analysed.filter((t) => t.energy! > 0.62);
  const focus = analysed.filter((t) => t.energy! >= 0.15 && t.energy! <= 0.55 && (t.danceability ?? 0.5) < 0.7);
  const isFocusGenre = (t: Track) => FOCUS_GENRES.some((g) => normalize(t.genre).includes(g));
  const habit = (t: Track) => 1 + (t.loved ? 0.6 : 0) + Math.min(0.6, t.play_count * 0.05) - Math.min(0.7, t.skip_count * 0.1);
  return [
    {
      id: "rediscover",
      title: "Redécouvertes",
      subtitle: "Aimés, mais pas écoutés depuis longtemps",
      ids: pick(rediscover, 40, rnd, (t) => 1 + t.play_count * 0.1 + (t.loved ? 1 : 0) + t.rating * 0.2),
    },
    {
      id: "heavy",
      title: "En boucle ce mois-ci",
      subtitle: "Vos titres les plus joués des 30 derniers jours",
      ids: monthTop,
    },
    {
      id: "calm",
      title: "Calme",
      subtitle: "Pour souffler",
      ids: pick(calm, 40, rnd, (t) => (1.2 - t.energy!) * habit(t)),
    },
    {
      id: "energy",
      title: "Énergie",
      subtitle: "Pour se lancer",
      ids: pick(energy, 40, rnd, (t) => (0.4 + t.energy! + (t.danceability ?? 0.5) * 0.5) * habit(t)),
    },
    {
      id: "focus",
      title: "Concentration",
      subtitle: "Discret et régulier",
      ids: pick(focus, 40, rnd, (t) => (isFocusGenre(t) ? 2.2 : 1) * (1.1 - Math.abs(t.energy! - 0.35)) * habit(t)),
    },
  ];
}

// ------------------------------------------------------------------ doublons

export interface DuplicateGroup {
  key: string;
  tracks: Track[];
  best: number;
}

/** Même artiste, même titre, durée voisine : plusieurs versions du même morceau. */
export function findDuplicates(tracks: Track[]): DuplicateGroup[] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = `${normalize(t.artist)}|${normalize(t.title)}`;
    if (key === "|") continue;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(t);
  }
  const out: DuplicateGroup[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.duration_ms - b.duration_ms);
    // Regroupement par durée : deux prises de durées très différentes ne sont pas des doublons.
    let cluster: Track[] = [list[0]];
    const flush = () => {
      if (cluster.length > 1) {
        const sorted = [...cluster].sort((a, b) => qualityScore(b) - qualityScore(a));
        out.push({ key: `${key}|${sorted[0].id}`, tracks: sorted, best: sorted[0].id });
      }
    };
    for (let i = 1; i < list.length; i++) {
      if (list[i].duration_ms - cluster[cluster.length - 1].duration_ms <= 4000) cluster.push(list[i]);
      else {
        flush();
        cluster = [list[i]];
      }
    }
    flush();
  }
  return out.sort((a, b) => a.tracks[0].artist.localeCompare(b.tracks[0].artist));
}
