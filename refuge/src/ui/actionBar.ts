import type { Selection } from '../app/bus.ts';
import { formatNumber } from '../app/format.ts';
import { BUILDINGS } from '../game/config.ts';
import { buildCost, checkUpgrade, finishCost, isActive } from '../game/sim.ts';
import { OBSTACLE_INFO } from '../game/state.ts';
import type { Store } from '../game/store.ts';
import { icon } from './icons.ts';
import { View, el, type Actions } from './view.ts';

/** Boutons ronds en bas de l'écran pour le bâtiment ou l'obstacle sélectionné. */
export function mountActionBar(store: Store, selection: () => Selection, actions: Actions): View {
  return new View(el('actions'), () => {
    const sel = selection();
    if (!sel) return '';
    const s = store.state;
    const button = (action: string, label: string, extra = '', cls = '', disabled = false) =>
      `<button class="round ${cls}" data-action="${action}" ${disabled ? 'disabled' : ''}>
         <span class="round-face">${extra}</span><span class="round-label">${label}</span>
       </button>`;

    if (sel.kind === 'obstacle') {
      const o = s.obstacles.find((it) => it.id === sel.id);
      if (!o) return '';
      const cost = OBSTACLE_INFO[o.kind].cost;
      return button('clear', 'Retirer', `${icon('or', 'mini')}${formatNumber(cost)}`, 'gold', s.resources.or < cost);
    }

    const b = s.buildings.find((it) => it.id === sel.id);
    if (!b) return '';
    const def = BUILDINGS[b.type];
    const parts: string[] = [button('info', 'Infos', 'i', 'blue')];
    if (b.work) {
      const gems = finishCost(s, b);
      parts.push(button('finish', 'Terminer', `${icon('gemmes', 'mini')}${gems}`, 'green', s.resources.gemmes < gems));
    } else if (b.level < def.levels.length) {
      const next = def.levels[b.level];
      const check = checkUpgrade(s, b);
      parts.push(button('upgrade', 'Améliorer', `${icon('or', 'mini')}${formatNumber(next.cost)}`, check.ok ? 'gold' : 'gold dim'));
    }
    if ((b.type === 'ferme' || b.type === 'billetterie') && isActive(b)) {
      const r = b.type === 'ferme' ? 'nourriture' : 'or';
      parts.push(button('collect', 'Récolter', `${icon(r, 'mini')}${formatNumber(b.stored)}`, 'green', b.stored < 1));
    }
    if (b.type === 'enclos' && b.level >= 1) parts.push(button('pen', 'Animaux', icon('coeur', 'mid'), 'pink'));
    parts.push(button('move', 'Déplacer', '✥', 'blue'));
    if (def.category === 'decor') {
      parts.push(button('demolish', 'Vendre', `${icon('or', 'mini')}${formatNumber(Math.floor(buildCost(s, b.type) / 2))}`, 'red'));
    }
    return parts.join('');
  }, actions);
}
