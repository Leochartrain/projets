/** Tirage aléatoire dans [0, 1[ ; remplaçable dans les tests pour des résultats reproductibles. */
export type Rng = () => number;

/** Entier au hasard entre `min` et `max` inclus. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Vrai avec une probabilité de `percent` %. */
export function chance(rng: Rng, percent: number): boolean {
  return rng() * 100 < percent;
}

/** Choix pondéré : `weights` donne le poids de chaque élément. */
export function weighted<T>(rng: Rng, items: readonly { weight: number; value: T }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item.value;
  }
  return items[items.length - 1].value;
}

/** Générateur déterministe (mulberry32), pour les tests et les cartes. */
export function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
