/** Boutons de la console : croix directionnelle, A, B, X (menu) et course (B maintenu dans Diamant et Perle). */
export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu' | 'run';

/** Codes physiques : ZQSD sur un clavier AZERTY (WASD en QWERTY) et flèches. */
const KEYS: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'a',
  Enter: 'a',
  KeyE: 'a',
  Escape: 'b',
  Backspace: 'b',
  KeyX: 'menu',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

/** Ordre de priorité des directions quand plusieurs sont tenues : la dernière pressée gagne. */
export class Input {
  private readonly held = new Set<Button>();
  private readonly pressed = new Set<Button>();
  private directionOrder: Button[] = [];

  constructor() {
    window.addEventListener('keydown', (event) => {
      const button = KEYS[event.code];
      if (!button) return;
      event.preventDefault();
      if (!this.held.has(button)) this.pressed.add(button);
      this.held.add(button);
      if (isDirection(button)) this.directionOrder = [...this.directionOrder.filter((b) => b !== button), button];
    });
    window.addEventListener('keyup', (event) => {
      const button = KEYS[event.code];
      if (!button) return;
      this.held.delete(button);
      this.directionOrder = this.directionOrder.filter((b) => b !== button);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.directionOrder = [];
    });
  }

  isHeld(button: Button): boolean {
    return this.held.has(button);
  }

  /** Vrai une seule fois par appui. */
  consume(button: Button): boolean {
    return this.pressed.delete(button);
  }

  /** Direction tenue la plus récente. */
  get direction(): Direction | null {
    return (this.directionOrder[this.directionOrder.length - 1] as Direction | undefined) ?? null;
  }

  /** Direction pressée à cette image (pour les menus). */
  consumeDirection(): Direction | null {
    for (const direction of ['up', 'down', 'left', 'right'] as const) if (this.consume(direction)) return direction;
    return null;
  }

  /** À appeler en fin d'image : les appuis non lus sont oubliés. */
  endFrame(): void {
    this.pressed.clear();
  }
}

export type Direction = 'up' | 'down' | 'left' | 'right';

function isDirection(button: Button): button is Direction {
  return button === 'up' || button === 'down' || button === 'left' || button === 'right';
}

export const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
