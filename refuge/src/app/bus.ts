import type { BuildingType, Resource } from '../game/config.ts';

/**
 * Messages échangés entre l'interface (HTML) et la scène du jeu (Phaser).
 * Ni l'une ni l'autre ne connaît l'autre : elles passent par ce bus.
 */

export type Selection = { kind: 'building'; id: number } | { kind: 'obstacle'; id: number } | null;

export type Placement = { mode: 'build'; type: BuildingType } | { mode: 'move'; id: number; type: BuildingType };

interface Events {
  /** Le joueur a touché un bâtiment ou un obstacle (null : rien). */
  select: Selection;
  /** Début du placement d'un bâtiment (achat ou déplacement). */
  placeStart: Placement;
  /** Fin du placement, posé ou annulé. */
  placeEnd: void;
  /** Annuler le placement en cours (bouton ✗ ou Échap). */
  placeCancel: void;
  /** Petit message en haut de l'écran. */
  toast: { text: string; kind?: 'info' | 'error' | 'success' };
  /** Chiffre qui s'envole au-dessus d'un bâtiment (+120 or). */
  float: { buildingId: number; text: string; resource?: Resource | 'gemmes' };
  /** Centrer la caméra sur un bâtiment. */
  focus: number;
}

type Handler<T> = (payload: T) => void;

class Bus {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<never>);
    return () => this.handlers.get(event)!.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, ...payload: Events[K] extends void ? [] : [Events[K]]): void {
    for (const handler of this.handlers.get(event) ?? []) (handler as Handler<Events[K]>)(payload[0] as Events[K]);
  }
}

export const bus = new Bus();
