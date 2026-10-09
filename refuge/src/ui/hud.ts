import { formatNumber } from '../app/format.ts';
import type { Resource } from '../game/config.ts';
import { builders, storageCap, townHallLevel } from '../game/sim.ts';
import type { Store } from '../game/store.ts';
import { icon } from './icons.ts';
import { View, el, type Actions } from './view.ts';

/** Barres de ressources en haut à droite, mairie et bâtisseurs en haut à gauche, gros boutons en bas. */
export function mountHud(store: Store, actions: Actions): View[] {
  const resources = new View(el('resources'), () => {
    const s = store.state;
    const bar = (r: Resource) => {
      const cap = storageCap(s, r);
      const value = s.resources[r];
      const full = value >= cap;
      return `
        <div class="res ${r} ${full ? 'full' : ''}">
          <div class="res-bar"><div class="res-fill" style="width:${Math.min(100, (value / cap) * 100)}%"></div></div>
          <span class="res-value">${formatNumber(value)}</span>
          <span class="res-max">Max : ${formatNumber(cap)}</span>
          ${icon(r, 'res-icon')}
        </div>`;
    };
    return `${bar('or')}${bar('nourriture')}
      <div class="res gemmes">
        <div class="res-bar"><div class="res-fill" style="width:100%"></div></div>
        <span class="res-value">${formatNumber(s.resources.gemmes)}</span>
        ${icon('gemmes', 'res-icon')}
      </div>`;
  }, {});

  const status = new View(el('status'), () => {
    const s = store.state;
    const b = builders(s);
    return `
      <div class="badge town" data-action="focusTownHall" title="Mairie">
        ${icon('etoile', 'badge-icon')}<span>Mairie ${townHallLevel(s)}</span>
      </div>
      <div class="badge builders ${b.busy >= b.total ? 'busy' : ''}" title="Bâtisseurs libres">
        ${icon('marteau', 'badge-icon')}<span>${b.total - b.busy}/${b.total}</span>
      </div>
      <button class="badge menu" data-action="menu" title="Options">⚙</button>`;
  }, actions);

  const corner = new View(el('corner'), () => `
      <button class="big-button bestiary" data-action="bestiary">${icon('coeur', 'big-icon')}<span>Bestiaire</span></button>
      <button class="big-button shop" data-action="shop">${icon('or', 'big-icon')}<span>Boutique</span></button>`, actions);

  return [resources, status, corner];
}
