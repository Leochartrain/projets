import { View, el, type Actions } from './view.ts';

export interface ModalContent {
  title: () => string;
  render: () => string;
  actions: Actions;
  /** Fenêtre large (boutique, bestiaire). */
  wide?: boolean;
  onClose?: () => void;
}

/** Une seule fenêtre ouverte à la fois, par-dessus le jeu. */
export class Modal {
  private root = el('modal');
  private body?: View;
  private content?: ModalContent;

  constructor() {
    this.root.addEventListener('click', (event) => {
      const t = event.target as HTMLElement;
      if (t === this.root || t.closest('[data-close]')) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !!this.content;
  }

  open(content: ModalContent): void {
    this.content?.onClose?.();
    this.content = content;
    this.root.innerHTML = `
      <div class="panel ${content.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <header class="panel-title"><h2></h2><button class="close" data-close aria-label="Fermer">✕</button></header>
        <div class="panel-body"></div>
      </div>`;
    this.body = new View(this.root.querySelector('.panel-body')!, content.render, content.actions);
    this.root.classList.add('open');
    this.update();
  }

  close(): void {
    if (!this.content) return;
    const { onClose } = this.content;
    this.content = undefined;
    this.body = undefined;
    this.root.classList.remove('open');
    this.root.innerHTML = '';
    onClose?.();
  }

  update(): void {
    if (!this.content || !this.body) return;
    this.root.querySelector('h2')!.textContent = this.content.title();
    this.body.update();
  }

  refresh(): void {
    this.body?.refresh();
  }
}
