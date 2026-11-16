// Vues dérivées de la bibliothèque (albums, artistes, genres) et recherche tolérante.
import type { Track } from "./api";

export interface Album {
  key: string;
  title: string;
  artist: string;
  year: number | null;
  cover: string | null;
  trackIds: number[];
  duration: number;
  genre: string;
  addedAt: number;
  lastPlayed: number;
  plays: number;
  quality: Quality;
}

export interface Artist {
  name: string;
  cover: string | null;
  albumKeys: string[];
  trackIds: number[];
  plays: number;
}

export interface Genre {
  name: string;
  trackIds: number[];
  covers: string[];
}

export type Quality = "hires" | "lossless" | "lossy";

const LOSSLESS = new Set(["FLAC", "ALAC", "WAV", "AIFF"]);

export function qualityOf(t: Track): Quality {
  if (!LOSSLESS.has(t.format)) return "lossy";
  return t.bit_depth > 16 || t.sample_rate > 48000 ? "hires" : "lossless";
}

/** Score de qualité d'un fichier, pour choisir la meilleure version d'un doublon. */
export function qualityScore(t: Track): number {
  const q = qualityOf(t);
  const base = q === "hires" ? 3e9 : q === "lossless" ? 2e9 : 1e9;
  return base + (q === "lossy" ? t.bitrate * 1000 : t.bit_depth * 1e6 + t.sample_rate);
}

export const albumArtistOf = (t: Track) => t.album_artist || t.artist || "Artiste inconnu";
export const albumKeyOf = (t: Track) => (t.album ? `${albumArtistOf(t)}\u001f${t.album}` : "");

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitGenres(g: string): string[] {
  return g
    .split(/[;/,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Derived {
  byId: Map<number, Track>;
  albums: Album[];
  albumByKey: Map<string, Album>;
  artists: Artist[];
  artistByName: Map<string, Artist>;
  genres: Genre[];
  searchIndex: SearchIndex;
}

const trackOrder = (a: Track, b: Track) =>
  (a.disc_no ?? 1) - (b.disc_no ?? 1) || (a.track_no ?? 9999) - (b.track_no ?? 9999) || a.title.localeCompare(b.title);

export function derive(tracks: Track[]): Derived {
  const byId = new Map<number, Track>();
  const albumTracks = new Map<string, Track[]>();
  const artistMap = new Map<string, Artist>();
  const genreMap = new Map<string, Genre>();

  for (const t of tracks) {
    byId.set(t.id, t);
    const key = albumKeyOf(t);
    if (key) {
      let list = albumTracks.get(key);
      if (!list) albumTracks.set(key, (list = []));
      list.push(t);
    }
    const an = albumArtistOf(t);
    let artist = artistMap.get(an);
    if (!artist) artistMap.set(an, (artist = { name: an, cover: null, albumKeys: [], trackIds: [], plays: 0 }));
    artist.trackIds.push(t.id);
    artist.plays += t.play_count;
    if (!artist.cover && t.cover) artist.cover = t.cover;
    for (const g of splitGenres(t.genre)) {
      let genre = genreMap.get(g);
      if (!genre) genreMap.set(g, (genre = { name: g, trackIds: [], covers: [] }));
      genre.trackIds.push(t.id);
      if (t.cover && genre.covers.length < 4 && !genre.covers.includes(t.cover)) genre.covers.push(t.cover);
    }
  }

  const albums: Album[] = [];
  const albumByKey = new Map<string, Album>();
  for (const [key, list] of albumTracks) {
    list.sort(trackOrder);
    const first = list[0];
    let quality: Quality = "lossy";
    let added = 0;
    let last = 0;
    let plays = 0;
    let duration = 0;
    for (const t of list) {
      const q = qualityOf(t);
      if (q === "hires" || (q === "lossless" && quality === "lossy")) quality = q;
      added = Math.max(added, t.added_at);
      last = Math.max(last, t.last_played ?? 0);
      plays += t.play_count;
      duration += t.duration_ms;
    }
    const album: Album = {
      key,
      title: first.album,
      artist: albumArtistOf(first),
      year: list.find((t) => t.year)?.year ?? null,
      cover: list.find((t) => t.cover)?.cover ?? null,
      trackIds: list.map((t) => t.id),
      duration,
      genre: splitGenres(first.genre)[0] ?? "",
      addedAt: added,
      lastPlayed: last,
      plays,
      quality,
    };
    albums.push(album);
    albumByKey.set(key, album);
    artistMap.get(album.artist)?.albumKeys.push(key);
  }
  albums.sort((a, b) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title));
  const artists = [...artistMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const genres = [...genreMap.values()].sort((a, b) => b.trackIds.length - a.trackIds.length);

  return { byId, albums, albumByKey, artists, artistByName: artistMap, genres, searchIndex: buildIndex(tracks) };
}

// ---------------------------------------------------------------- recherche

export interface SearchIndex {
  rows: { id: number; title: string; artist: string; album: string; all: string }[];
  vocab: string[];
}

function buildIndex(tracks: Track[]): SearchIndex {
  const vocab = new Set<string>();
  const rows = tracks.map((t) => {
    const title = normalize(t.title);
    const artist = normalize(`${t.artist} ${t.album_artist}`);
    const album = normalize(t.album);
    const all = `${title} ${artist} ${album} ${normalize(t.genre)} ${normalize(t.composer)}`;
    for (const w of all.split(" ")) if (w.length >= 3) vocab.add(w);
    return { id: t.id, title, artist, album, all };
  });
  return { rows, vocab: [...vocab] };
}

/** Distance d'édition bornée (Damerau-Levenshtein simplifiée). Renvoie max+1 si dépassée. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Variantes acceptées pour un mot : lui-même, puis les mots proches du vocabulaire (fautes de frappe). */
function variants(index: SearchIndex, token: string): string[] {
  if (token.length < 4) return [token];
  const max = token.length >= 7 ? 2 : 1;
  const close: [number, string][] = [];
  for (const w of index.vocab) {
    // On compare au début du mot pour tolérer la saisie en cours.
    const head = w.length > token.length + 1 ? w.slice(0, token.length) : w;
    const d = editDistance(token, head, max);
    if (d > 0 && d <= max) close.push([d, w]);
  }
  close.sort((a, b) => a[0] - b[0]);
  return [token, ...close.slice(0, 12).map((c) => c[1])];
}

export interface SearchHit {
  id: number;
  score: number;
}

/** Recherche tolérante : tous les mots doivent apparaître (à une faute près). */
export function searchTracks(index: SearchIndex, query: string, limit = 200): SearchHit[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const sets = tokens.map((t) => variants(index, t));
  const hits: SearchHit[] = [];
  for (const row of index.rows) {
    let score = 0;
    let ok = true;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      let s = 0;
      if (row.all.includes(tok)) {
        s = 4;
        if (row.title.startsWith(tok)) s += 6;
        else if (row.title.includes(tok)) s += 3;
        if (row.artist.startsWith(tok)) s += 4;
        else if (row.artist.includes(tok)) s += 2;
        if (row.album.startsWith(tok)) s += 2;
      } else {
        for (let v = 1; v < sets[i].length; v++) {
          if (row.all.includes(sets[i][v])) {
            s = 1.5;
            break;
          }
        }
      }
      if (!s) {
        ok = false;
        break;
      }
      score += s;
    }
    if (ok) hits.push({ id: row.id, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------- formats

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")}`;
}

export function formatRate(hz: number): string {
  const k = hz / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)} kHz`;
}

export function techLabel(t: Track): string {
  const parts = [t.format];
  if (qualityOf(t) === "lossy") {
    if (t.bitrate) parts.push(`${t.bitrate} kb/s`);
  } else if (t.bit_depth && t.sample_rate) {
    parts.push(`${t.bit_depth} bits / ${formatRate(t.sample_rate)}`);
  }
  return parts.join(" · ");
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}
