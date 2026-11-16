// Couleurs dynamiques tirées de la pochette en cours.

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

/** Ramène une couleur dans une plage de luminance (pour garder le texte lisible). */
export function fitLuminance(c: RGB, min: number, max: number): RGB {
  let out = c;
  for (let i = 0; i < 24; i++) {
    const l = luminance(out);
    if (l > max) out = mix(out, [0, 0, 0], 0.12);
    else if (l < min) out = mix(out, [255, 255, 255], 0.12);
    else break;
  }
  return out;
}

export interface Tints {
  accent: string | null;
  /** Couleur du texte posé sur l'accent (noir ou blanc selon sa clarté). */
  accentFg: string | null;
  tint1: string;
  tint2: string;
  /** Fond sombre de l'écran « En cours de lecture ». */
  deep: [string, string, string];
}

export function tintsFrom(colors: [string, string, string] | undefined, dark: boolean): Tints | null {
  if (!colors) return null;
  const [c1, c2, c3] = colors.map(hexToRgb) as [RGB, RGB, RGB];
  // Accent : seulement si la pochette a une vraie teinte, et toujours assez contrasté.
  const vivid = saturation(c1) > 0.28;
  const fitted = dark ? fitLuminance(c1, 0.28, 0.6) : fitLuminance(c1, 0.06, 0.2);
  const accent = vivid ? rgbToHex(fitted) : null;
  const accentFg = vivid ? (luminance(fitted) > 0.3 ? "#111113" : "#ffffff") : null;
  const soft = (c: RGB) => rgbToHex(dark ? fitLuminance(c, 0.02, 0.09) : fitLuminance(mix(c, [255, 255, 255], 0.45), 0.5, 0.82));
  return {
    accent,
    accentFg,
    tint1: soft(c1),
    tint2: soft(c2),
    deep: [rgbToHex(fitLuminance(c3, 0.012, 0.045)), rgbToHex(fitLuminance(c1, 0.05, 0.16)), rgbToHex(fitLuminance(c2, 0.04, 0.13))],
  };
}
