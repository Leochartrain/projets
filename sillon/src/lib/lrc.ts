// Lecture des paroles : format LRC (synchronisé) ou texte simple.

export interface LyricLine {
  /** Instant de la ligne en millisecondes (null si les paroles ne sont pas synchronisées). */
  time: number | null;
  text: string;
}

export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
}

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLyrics(raw: string): Lyrics {
  const rows = raw.replace(/\r/g, "").split("\n");
  const timed: LyricLine[] = [];
  let offset = 0;
  for (const row of rows) {
    const off = row.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (off) {
      offset = Number(off[1]);
      continue;
    }
    const stamps = [...row.matchAll(STAMP)];
    if (!stamps.length) continue;
    // Texte sans les repères de temps (ni ceux, mot à mot, du format étendu).
    const text = row.replace(STAMP, "").replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "").trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3].padEnd(3, "0").slice(0, 3)) : 0;
      timed.push({ time: Math.max(0, Number(m[1]) * 60000 + Number(m[2]) * 1000 + frac - offset), text });
    }
  }
  if (timed.length >= 2) {
    timed.sort((a, b) => a.time! - b.time!);
    return { synced: true, lines: timed };
  }
  const lines = rows
    .filter((r) => !/^\[[a-z]+:.*\]$/i.test(r.trim()))
    .map((text) => ({ time: null, text: text.trim() }));
  while (lines.length && !lines[0].text) lines.shift();
  while (lines.length && !lines[lines.length - 1].text) lines.pop();
  return { synced: false, lines };
}

/** Indice de la ligne en cours à la position donnée (-1 avant la première). */
export function activeLine(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid].time ?? 0) <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
