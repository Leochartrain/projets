// Import de morceaux dans la version téléphone : lecture des tags, pochettes en trois tailles, teintes.
import { parseBlob } from "music-metadata";
import type { Track } from "../lib/api";
import * as idb from "./idb";

export const COVER_SIZES = [96, 320, 1000] as const;
const AUDIO_EXT = /\.(flac|mp3|m4a|mp4|aac|ogg|oga|opus|wav|aif|aiff|webm)$/i;
const IMAGE_NAMES = /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i;

export function isAudio(f: File) {
  return AUDIO_EXT.test(f.name) || f.type.startsWith("audio/");
}

const dirOf = (f: File) => {
  const p = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
};
const stem = (name: string) => name.replace(/\.[^.]+$/, "");

function formatName(container: string | undefined, codec: string | undefined, name: string, lossless: boolean): string {
  const c = `${container ?? ""} ${codec ?? ""}`.toLowerCase();
  if (c.includes("flac")) return "FLAC";
  if (c.includes("alac")) return "ALAC";
  if (c.includes("opus")) return "Opus";
  if (c.includes("vorbis") || c.includes("ogg")) return "OGG";
  if (c.includes("mpeg") && (c.includes("layer 3") || c.includes("mp3"))) return "MP3";
  if (c.includes("aac") || c.includes("m4a") || c.includes("mp4")) return lossless ? "ALAC" : "AAC";
  if (c.includes("wav") || c.includes("pcm")) return "WAV";
  if (c.includes("aif")) return "AIFF";
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  return ext === "M4A" ? "AAC" : ext || "Audio";
}

/** Clé stable d'une image (FNV-1a 64 bits, comme la version de bureau). */
function fnv(data: Uint8Array): string {
  let h = 0xcbf29ce484222325n;
  const p = 0x100000001b3n;
  const step = Math.max(1, Math.floor(data.length / 65536)); // échantillonnage : rapide sur les grosses images
  for (let i = 0; i < data.length; i += step) {
    h ^= BigInt(data[i]);
    h = (h * p) & 0xffffffffffffffffn;
  }
  h ^= BigInt(data.length);
  h = (h * p) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0");
}

const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Trois teintes : dominante vive, secondaire bien distincte, moyenne (même méthode que le cœur Rust). */
function palette(px: Uint8ClampedArray): [string, string, string] {
  const buckets = new Map<number, [number, number, number, number, number]>();
  const avg = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    avg[0] += r; avg[1] += g; avg[2] += b; n++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const w = (0.15 + sat * sat) * (lum < 0.12 || lum > 0.92 ? 0.1 : 1);
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? [0, 0, 0, 0, 0];
    e[0] += w; e[1] += r; e[2] += g; e[3] += b; e[4] += 1;
    buckets.set(key, e);
  }
  const mean = avg.map((v) => v / Math.max(1, n));
  const list = [...buckets.values()].map((e) => ({ w: e[0], c: [e[1] / e[4], e[2] / e[4], e[3] / e[4]] })).sort((a, b) => b.w - a.w);
  const c1 = list[0]?.c ?? mean;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const c2 = list.find((x) => dist(x.c, c1) > 70)?.c ?? mean;
  return [hex(c1), hex(c2), hex(mean)];
}

const knownCovers = new Set<string>();

/** Enregistre une pochette en trois tailles et renvoie sa clé. */
export async function storeCover(data: Uint8Array, mime: string): Promise<string | null> {
  if (data.length < 64) return null;
  const key = fnv(data);
  if (knownCovers.has(key)) return key;
  if (await idb.get("covers", key)) {
    knownCovers.add(key);
    return key;
  }
  try {
    const bmp = await createImageBitmap(new Blob([data as BlobPart], { type: mime || "image/jpeg" }));
    for (const size of COVER_SIZES) {
      const s = Math.min(size, Math.max(bmp.width, bmp.height));
      const canvas = new OffscreenCanvas(s, s);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      // Recadrage carré centré.
      const side = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, s, s);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: size === 96 ? 0.8 : 0.86 });
      await idb.put("covers", blob, `${key}_${size}`);
    }
    const small = new OffscreenCanvas(48, 48);
    const sctx = small.getContext("2d")!;
    sctx.drawImage(bmp, 0, 0, 48, 48);
    await idb.put("covers", palette(sctx.getImageData(0, 0, 48, 48).data), key);
    bmp.close();
    knownCovers.add(key);
    return key;
  } catch {
    return null;
  }
}

export interface ImportResult {
  added: number;
  skipped: number;
  failed: string[];
}

/** Importe des fichiers choisis par l'utilisateur ; `progress` reçoit (faits, total). */
export async function importFiles(files: File[], nextId: () => number, progress: (done: number, total: number) => void): Promise<ImportResult> {
  const audio = files.filter(isAudio);
  const lrc = new Map(files.filter((f) => /\.lrc$/i.test(f.name)).map((f) => [`${dirOf(f)}/${stem(f.name)}`.toLowerCase(), f]));
  const folderCovers = new Map(files.filter((f) => IMAGE_NAMES.test(f.name)).map((f) => [dirOf(f), f]));
  const existing = new Set((await idb.getAll<Track>("tracks")).map((t) => `${t.path}|${t.file_size}`));
  const result: ImportResult = { added: 0, skipped: 0, failed: [] };
  let done = 0;
  for (const file of audio) {
    progress(done, audio.length);
    const sig = `${file.name}|${file.size}`;
    if (existing.has(sig)) {
      result.skipped++;
      done++;
      continue;
    }
    try {
      const meta = await parseBlob(file, { duration: true, skipCovers: false });
      const c = meta.common;
      const f = meta.format;
      const lossless = !!f.lossless;
      let cover: string | null = null;
      const pic = c.picture?.find((p) => /front/i.test(p.type ?? "")) ?? c.picture?.[0];
      if (pic) cover = await storeCover(pic.data, pic.format);
      if (!cover) {
        const img = folderCovers.get(dirOf(file));
        if (img) cover = await storeCover(new Uint8Array(await img.arrayBuffer()), img.type);
      }
      let lyrics: string | null = null;
      const side = lrc.get(`${dirOf(file)}/${stem(file.name)}`.toLowerCase());
      if (side) lyrics = await side.text();
      else if (c.lyrics?.length) {
        const l = c.lyrics[0] as unknown;
        lyrics = typeof l === "string" ? l : ((l as { text?: string })?.text ?? null);
      }
      const id = nextId();
      const track: Track & { lyrics: string | null } = {
        id,
        path: file.name,
        title: c.title || stem(file.name),
        artist: c.artist || c.artists?.join(", ") || "",
        album_artist: c.albumartist || "",
        album: c.album || "",
        year: c.year ?? null,
        genre: c.genre?.join("; ") || "",
        track_no: c.track?.no ?? null,
        disc_no: c.disk?.no ?? null,
        composer: c.composer?.join(", ") || "",
        duration_ms: Math.round((f.duration ?? 0) * 1000),
        format: formatName(f.container, f.codec, file.name, lossless),
        sample_rate: f.sampleRate ?? 44100,
        bit_depth: lossless ? (f.bitsPerSample ?? 16) : 0,
        bitrate: f.bitrate ? Math.round(f.bitrate / 1000) : 0,
        channels: f.numberOfChannels ?? 2,
        file_size: file.size,
        added_at: Math.floor(Date.now() / 1000),
        cover,
        has_lyrics: !!lyrics,
        rg_track: c.replaygain_track_gain?.dB ?? null,
        rg_album: c.replaygain_album_gain?.dB ?? null,
        peak: c.replaygain_track_peak?.ratio ?? null,
        bpm: c.bpm ?? null,
        key: c.key ?? null,
        energy: null,
        intensity: null,
        danceability: null,
        valence: null,
        mood: null,
        rating: 0,
        loved: false,
        play_count: 0,
        skip_count: 0,
        last_played: null,
        lyrics,
      };
      // Le fichier d'abord : un morceau sans fichier ne doit jamais apparaître.
      await idb.put("files", file, id);
      await idb.put("tracks", track);
      existing.add(sig);
      result.added++;
    } catch (e) {
      console.warn("import", file.name, e);
      result.failed.push(file.name);
    }
    done++;
  }
  progress(done, audio.length);
  return result;
}
