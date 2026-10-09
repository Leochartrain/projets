import { newGame, type GameState } from './state.ts';

const KEY = 'refuge.save';

/** Charge la partie du navigateur, ou en commence une nouvelle. */
export function load(now: number): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state = JSON.parse(raw) as GameState;
      if (state.version === 1) return state;
    }
  } catch {
    // Stockage bloqué (navigation privée) ou sauvegarde illisible : nouvelle partie.
  }
  return newGame(now);
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Pas de stockage disponible : la partie reste jouable, sans sauvegarde.
  }
}

export function erase(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Rien à effacer.
  }
}
