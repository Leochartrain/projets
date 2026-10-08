/** « samedi 18 octobre 2026 » (date AAAA-MM-JJ, midi pour éviter les décalages de fuseau). */
export function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** « 18 oct. 2026 » */
export function shortDate(date: string): string {
  return new Date(date.length === 10 ? `${date}T12:00:00` : date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « 14:32 » depuis un horodatage ISO. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « 14h », « 14h30 » */
export function hour(time: string): string {
  return time.endsWith(':00') ? `${Number(time.slice(0, 2))}h` : `${Number(time.slice(0, 2))}h${time.slice(3)}`;
}

export function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: cents % 100 ? 2 : 0 });
}

export function kilos(kg: number): string {
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`;
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count.toLocaleString('fr-FR')} ${count > 1 ? pluralWord : word}`;
}

export function todayIso(): string {
  return new Date().toLocaleDateString('sv-SE');
}

/** Minutes écoulées depuis un horodatage (pour « en attente depuis 12 min »). */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** Saisie « 2,5 » ou « 2.5 » → 2.5 ; vide → null. */
export function parseDecimal(text: string): number | null {
  const value = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(value) ? null : value;
}
