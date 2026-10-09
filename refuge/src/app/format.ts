/** « 2 h 05 », « 3 min 20 s », « 12 s ». */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h} h ${String(m).padStart(2, '0')}`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m} min ${r} s` : `${m} min`;
  }
  return `${s} s`;
}

/** 12 345 → « 12 345 » (espace fine insécable). */
export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('fr-FR');
}
