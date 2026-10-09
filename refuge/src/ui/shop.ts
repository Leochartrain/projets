import { bus } from '../app/bus.ts';
import { formatDuration, formatNumber } from '../app/format.ts';
import { BUILDINGS, SPECIES, SPECIES_ORDER, type BuildingType, type Species } from '../game/config.ts';
import { buildCost, buyAnimal, checkBuild, checkBuyAnimal, countOf, maxCountOf, penSpecies, townHallLevel } from '../game/sim.ts';
import type { Store } from '../game/store.ts';
import { icon } from './icons.ts';
import type { ModalContent } from './modal.ts';
import { animalThumb, buildingThumb } from './thumbs.ts';

type Tab = 'batiments' | 'decor' | 'animaux';

const TABS: { id: Tab; label: string }[] = [
  { id: 'batiments', label: 'Bâtiments' },
  { id: 'decor', label: 'Décorations' },
  { id: 'animaux', label: 'Animaux' },
];

const BUILDING_ORDER: BuildingType[] = ['ferme', 'billetterie', 'enclos', 'cabane'];
const DECOR_ORDER: BuildingType[] = ['fleurs', 'arbre', 'fontaine'];

export function shopContent(store: Store, close: () => void, preferredPen: () => number | undefined): ModalContent {
  let tab: Tab = 'batiments';

  const buildingCard = (type: BuildingType) => {
    const s = store.state;
    const def = BUILDINGS[type];
    const first = def.levels[0];
    const count = countOf(s, type);
    const max = maxCountOf(s, type);
    const locked = first.townHall > townHallLevel(s) || max === 0;
    const check = checkBuild(s, type);
    const cost = buildCost(s, type);
    return `
      <button class="card ${locked ? 'locked' : ''} ${check.ok ? '' : 'dim'}" data-action="build" data-type="${type}">
        <span class="card-count">${count}/${max}</span>
        <img class="card-thumb" src="${buildingThumb(type, 1)}" alt="">
        <span class="card-name">${def.name}</span>
        ${def.instant || !first.time ? '' : `<span class="card-time">⏱ ${formatDuration(first.time)}</span>`}
        <span class="card-cost ${s.resources.or < cost ? 'short' : ''}">${icon('or', 'mini')}${cost ? formatNumber(cost) : 'Gratuit'}</span>
        ${locked ? `<span class="card-lock">Mairie niveau ${Math.max(first.townHall, def.maxCount.findIndex((n) => n > 0) + 1)}</span>` : ''}
      </button>`;
  };

  const animalCard = (species: Species) => {
    const s = store.state;
    const def = SPECIES[species];
    const locked = def.townHall > townHallLevel(s);
    return `
      <button class="card ${locked ? 'locked' : ''}" data-action="buy" data-species="${species}">
        <img class="card-thumb animal" src="${animalThumb(species, 'normal', false)}" alt="">
        <span class="card-name">${def.name}</span>
        <span class="card-stats">${icon('or', 'mini')}+${def.attraction}/h · ${icon('nourriture', 'mini')}−${def.food}/h</span>
        <span class="card-cost ${s.resources.or < def.price ? 'short' : ''}">${icon('or', 'mini')}${formatNumber(def.price)}</span>
        ${locked ? `<span class="card-lock">Mairie niveau ${def.townHall}</span>` : ''}
      </button>`;
  };

  return {
    title: () => 'Boutique',
    wide: true,
    render: () => {
      const tabs = TABS.map((t) => `<button class="tab ${t.id === tab ? 'active' : ''}" data-action="tab" data-tab="${t.id}">${t.label}</button>`).join('');
      let cards = '';
      if (tab === 'batiments') cards = BUILDING_ORDER.map(buildingCard).join('');
      if (tab === 'decor') cards = DECOR_ORDER.map(buildingCard).join('');
      if (tab === 'animaux') cards = SPECIES_ORDER.map(animalCard).join('');
      const hint =
        tab === 'animaux'
          ? '<p class="hint">Les animaux vont dans un enclos d’une seule espèce. Sélectionne un enclos avant d’acheter pour choisir lequel.</p>'
          : tab === 'decor'
            ? '<p class="hint">Les décorations près d’un enclos rendent ses animaux plus heureux : ils attirent plus de visiteurs.</p>'
            : '';
      return `<nav class="tabs">${tabs}</nav>${hint}<div class="cards">${cards}</div>`;
    },
    actions: {
      tab: ({ tab: t }) => {
        tab = t as Tab;
      },
      build: ({ type }) => {
        const check = checkBuild(store.state, type as BuildingType);
        if (!check.ok) {
          bus.emit('toast', { text: check.reason, kind: 'error' });
          return;
        }
        close();
        bus.emit('placeStart', { mode: 'build', type: type as BuildingType });
      },
      buy: ({ species }) => buyInBestPen(store, species as Species, preferredPen()),
    },
  };
}

/**
 * Achète un animal dans l'enclos sélectionné s'il convient, sinon dans un enclos
 * qui a déjà cette espèce, sinon dans un enclos vide.
 */
export function buyInBestPen(store: Store, species: Species, preferred?: number): void {
  const s = store.state;
  const pens = s.buildings.filter((b) => b.type === 'enclos');
  if (!pens.length) {
    bus.emit('toast', { text: 'Construis d’abord un enclos', kind: 'error' });
    return;
  }
  const ranked = [...pens].sort((a, b) => score(b) - score(a));
  function score(pen: (typeof pens)[number]): number {
    return (pen.id === preferred ? 4 : 0) + (penSpecies(s, pen.id) === species ? 2 : 0) + (penSpecies(s, pen.id) ? 0 : 1);
  }
  const target = ranked.find((pen) => checkBuyAnimal(s, species, pen).ok);
  if (!target) {
    const check = checkBuyAnimal(s, species, ranked[0]);
    bus.emit('toast', { text: check.ok ? 'Impossible' : check.reason, kind: 'error' });
    return;
  }
  const result = store.act((st) => buyAnimal(st, species, target.id));
  if (!result.ok) {
    bus.emit('toast', { text: result.reason, kind: 'error' });
    return;
  }
  const sex = result.animal!.sex === 'F' ? 'femelle' : 'mâle';
  bus.emit('toast', { text: `${SPECIES[species].name} ${sex} arrivé !`, kind: 'success' });
  bus.emit('float', { buildingId: target.id, text: '♥' });
}
