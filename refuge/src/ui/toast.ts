import { bus } from '../app/bus.ts';
import { el } from './view.ts';

/** Messages courts en haut de l'écran (« Pas assez d'or »). */
export function mountToasts(): void {
  const root = el('toasts');
  bus.on('toast', ({ text, kind = 'info' }) => {
    // Le même message déjà affiché : on le relance au lieu d'en empiler un autre.
    for (const existing of root.children) {
      if (existing.textContent === text) existing.remove();
    }
    const div = document.createElement('div');
    div.className = `toast ${kind}`;
    div.textContent = text;
    root.append(div);
    setTimeout(() => div.classList.add('leaving'), 2200);
    setTimeout(() => div.remove(), 2600);
  });
}
