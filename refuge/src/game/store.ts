import { erase, load, save } from './save.ts';
import { tick, type Result } from './sim.ts';
import { newGame, type GameState } from './state.ts';

type Listener = () => void;

const TICK_MS = 250;
const SAVE_MS = 5000;

/**
 * Détient la partie et la fait vivre : avance le temps, applique les actions,
 * prévient l'affichage et sauvegarde régulièrement.
 */
export class Store {
  state: GameState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = load(Date.now());
    // Progression hors ligne : on rattrape tout le temps passé depuis la dernière visite.
    tick(this.state, Date.now());
    setInterval(() => this.update(), TICK_MS);
    setInterval(() => save(this.state), SAVE_MS);
    const flush = () => save(this.state);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Applique une action du joueur à l'instant présent. */
  act<R extends Result>(action: (state: GameState) => R): R {
    tick(this.state, Date.now());
    const result = action(this.state);
    if (result.ok) save(this.state);
    this.emit();
    return result;
  }

  reset(): void {
    erase();
    this.state = newGame(Date.now());
    save(this.state);
    this.emit();
  }

  private update(): void {
    tick(this.state, Date.now());
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
