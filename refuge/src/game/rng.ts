/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * L'état tient dans un entier sauvegardé avec la partie : recharger une sauvegarde
 * redonne exactement les mêmes naissances, et les tests sont reproductibles.
 */
export class Rng {
  state: number;

  constructor(state: number) {
    this.state = state;
  }

  /** Nombre dans [0, 1[. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
