import { formatDuration, formatNumber } from '../app/format.ts';
import { BUILDINGS, type LevelDef } from '../game/config.ts';
import { animalsIn, penHappiness, visitorsPerHour } from '../game/sim.ts';
import type { Store } from '../game/store.ts';
import { icon } from './icons.ts';
import type { ModalContent } from './modal.ts';
import { buildingThumb } from './thumbs.ts';

/** Fiche d'un bâtiment : description, caractéristiques actuelles et au niveau suivant. */
export function infoContent(store: Store, id: number): ModalContent {
  const building = () => store.state.buildings.find((b) => b.id === id);

  const stats = (l: LevelDef): [string, string][] => {
    const rows: [string, string][] = [];
    if (l.rate) rows.push(['Production', `${formatNumber(l.rate)} / h`]);
    if (l.capacity && l.rate) rows.push(['Stock', formatNumber(l.capacity)]);
    if (l.capacity && !l.rate) rows.push(['Places', String(l.capacity)]);
    if (l.storage) {
      rows.push([`Réserve ${icon('or', 'mini')}`, formatNumber(l.storage.or)]);
      rows.push([`Réserve ${icon('nourriture', 'mini')}`, formatNumber(l.storage.nourriture)]);
    }
    return rows;
  };

  return {
    title: () => {
      const b = building();
      return b ? `${BUILDINGS[b.type].name}${BUILDINGS[b.type].levels.length > 1 ? ` · niveau ${Math.max(1, b.level)}` : ''}` : '';
    },
    render: () => {
      const b = building();
      if (!b) return '';
      const s = store.state;
      const def = BUILDINGS[b.type];
      const current = def.levels[Math.max(0, b.level - 1)];
      const next = b.level >= 1 ? def.levels[b.level] : undefined;
      const now = stats(current);
      const later = next ? stats(next) : [];
      const rows = now
        .map(([label, value], i) => `<tr><td>${label}</td><td>${value}</td><td class="next">${later[i] ? `→ ${later[i][1]}` : ''}</td></tr>`)
        .join('');
      const extra: string[] = [];
      if (b.type === 'billetterie') extra.push(`Visiteurs attirés par tes animaux : <b>${icon('or', 'mini')}+${formatNumber(visitorsPerHour(s, s.time))} / h</b> (partagés entre les billetteries).`);
      if (b.type === 'enclos') extra.push(`Bonheur : <b>${Math.round(penHappiness(s, b) * 100)} %</b> · ${animalsIn(s, b.id).length} animaux.`);
      if (def.happiness) extra.push(`Rend les enclos à 2 cases ou moins <b>+${Math.round(def.happiness * 100)} %</b> plus heureux.`);
      const upgrade = next
        ? `<p class="next-level">Niveau ${b.level + 1} : ${icon('or', 'mini')}${formatNumber(next.cost)} · ⏱ ${formatDuration(next.time)}${next.townHall > 1 ? ` · Mairie ${next.townHall}` : ''}</p>`
        : b.level >= def.levels.length && def.levels.length > 1
          ? '<p class="next-level">Niveau maximal atteint.</p>'
          : '';
      return `
        <div class="info">
          <img class="info-thumb" src="${buildingThumb(b.type, Math.max(1, b.level))}" alt="">
          <div>
            <p>${def.description}</p>
            ${extra.map((e) => `<p>${e}</p>`).join('')}
            ${rows ? `<table class="stats">${rows}</table>` : ''}
            ${upgrade}
          </div>
        </div>`;
    },
    actions: {},
  };
}
