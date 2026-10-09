/**
 * Morceau d'interface rendu en HTML. `update()` ne touche au DOM que si le rendu a changé,
 * on peut donc l'appeler à chaque mise à jour du jeu sans faire clignoter l'écran.
 * Les clics sont délégués : un élément avec data-action="nom" appelle actions.nom(dataset).
 */
export type Actions = Record<string, (data: DOMStringMap) => void>;

export class View {
  readonly el: HTMLElement;
  private readonly render: () => string;
  /** Dernier rendu affiché (null : jamais affiché ou à refaire). */
  private last: string | null = null;

  constructor(el: HTMLElement, render: () => string, actions: Actions) {
    this.el = el;
    this.render = render;
    el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target || !el.contains(target) || target.hasAttribute('disabled')) return;
      actions[target.dataset.action!]?.(target.dataset);
    });
  }

  update(): void {
    const html = this.render();
    if (html === this.last) return;
    this.el.innerHTML = html;
    this.last = html;
  }

  /** Force le prochain rendu (après un changement qui ne vient pas du jeu, comme un onglet). */
  refresh(): void {
    this.last = null;
    this.update();
  }
}

export function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
