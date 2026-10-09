import { bus } from '../app/bus.ts';
import { formatDuration, formatNumber } from '../app/format.ts';
import { SPECIES, SPECIES_ORDER, type Species } from '../game/config.ts';
import { genotypeLabel, phenotype } from '../game/genetics.ts';
import {
  animalAttraction,
  animalsIn,
  breed,
  canBreed,
  checkBreed,
  isAdult,
  penCapacity,
  penHappiness,
  penOccupancy,
  penSpecies,
  sellAnimal,
  sellPrice,
  townHallLevel,
} from '../game/sim.ts';
import type { Animal } from '../game/state.ts';
import type { Store } from '../game/store.ts';
import { icon } from './icons.ts';
import type { ModalContent } from './modal.ts';
import { buyInBestPen } from './shop.ts';
import { animalThumb } from './thumbs.ts';

/** Fenêtre d'un enclos : ses animaux, la reproduction, l'achat et la vente. */
export function penContent(store: Store, penId: number): ModalContent {
  let motherId: number | undefined;
  let fatherId: number | undefined;
  /** Vente en deux temps : premier clic pour demander, second pour confirmer. */
  let confirmSell: number | undefined;

  const pen = () => store.state.buildings.find((b) => b.id === penId);

  const card = (a: Animal) => {
    const s = store.state;
    const now = s.time;
    const p = phenotype(a.genes);
    const def = SPECIES[a.species];
    const adult = isAdult(a, now);
    const picked = a.id === motherId || a.id === fatherId;
    let state: string;
    if (!adult) state = `Petit · adulte dans ${formatDuration((a.adultAt - now) / 1000)}`;
    else if (!canBreed(a, now)) state = `Se repose · ${formatDuration((a.restUntil - now) / 1000)}`;
    else state = 'Prêt à avoir des petits';
    return `
      <div class="animal ${picked ? 'picked' : ''} ${a.sex === 'F' ? 'female' : 'male'}" data-action="pick" data-id="${a.id}">
        <img class="animal-thumb ${adult ? '' : 'baby'}" src="${animalThumb(a.species, p.coat, p.spotted)}" alt="">
        <div class="animal-info">
          <span class="animal-name"><span class="sex">${a.sex === 'F' ? '♀' : '♂'}</span> ${def.coats[p.coat].label}${p.spotted ? ', tacheté' : ''}</span>
          <span class="animal-state">${state}</span>
          <span class="animal-genes" title="Gènes : couleur · motif">${genotypeLabel(a.genes)} · ${icon('or', 'mini')}+${Math.round(animalAttraction(s, a, now))}/h</span>
        </div>
        <button class="sell ${confirmSell === a.id ? 'confirm' : ''}" data-action="sell" data-id="${a.id}">
          ${confirmSell === a.id ? 'Sûr ?' : `Vendre ${formatNumber(sellPrice(a, now))}`}
        </button>
      </div>`;
  };

  return {
    title: () => {
      const species = penSpecies(store.state, penId);
      return species ? `Enclos des ${SPECIES[species].plural.toLowerCase()}` : 'Enclos vide';
    },
    wide: true,
    render: () => {
      const s = store.state;
      const b = pen();
      if (!b) return '';
      const animals = animalsIn(s, penId);
      const species = penSpecies(s, penId);
      const happiness = Math.round(penHappiness(s, b) * 100);
      // Un parent choisi qui n'est plus là (vendu) : on l'oublie.
      if (motherId && !animals.some((a) => a.id === motherId)) motherId = undefined;
      if (fatherId && !animals.some((a) => a.id === fatherId)) fatherId = undefined;

      const header = `
        <div class="pen-stats">
          <span>Places : <b>${penOccupancy(s, b)}/${penCapacity(b)}</b></span>
          <span>Bonheur : <b>${happiness} %</b></span>
          <span>Nourriture : ${icon('nourriture', 'mini')}<b>${formatNumber(s.resources.nourriture)}</b></span>
        </div>`;

      let breeding: string;
      if (b.breeding) {
        const left = (b.breeding.endsAt - s.time) / 1000;
        const progress = 100 * (1 - left / (b.breeding.duration / 1000));
        breeding = `
          <div class="breeding active">
            ${icon('coeur', 'mid')}<span>Un petit arrive dans <b>${formatDuration(left)}</b></span>
            <div class="progress"><div style="width:${progress}%"></div></div>
          </div>`;
      } else if (species) {
        const mother = animals.find((a) => a.id === motherId);
        const father = animals.find((a) => a.id === fatherId);
        const cost = SPECIES[species].breedCost;
        const check = mother && father ? checkBreed(s, b, mother, father) : undefined;
        const help = !mother || !father ? 'Touche une femelle ♀ et un mâle ♂ adultes et reposés.' : check && !check.ok ? check.reason : 'Prêts !';
        breeding = `
          <div class="breeding">
            <span>${help}</span>
            <button class="btn green" data-action="breed" ${check?.ok ? '' : 'disabled'}>
              ${icon('coeur', 'mini')} Faire un petit · ${icon('nourriture', 'mini')}${formatNumber(cost)}
            </button>
          </div>`;
      } else {
        breeding = '';
      }

      const buy = species
        ? `<button class="btn gold" data-action="buy" data-species="${species}" ${penOccupancy(s, b) >= penCapacity(b) ? 'disabled' : ''}>
             Acheter un ${SPECIES[species].name.toLowerCase()} · ${icon('or', 'mini')}${formatNumber(SPECIES[species].price)}
           </button>`
        : `<p class="hint">Choisis l’espèce de cet enclos :</p>
           <div class="species-choice">${SPECIES_ORDER.map((sp) => speciesButton(store, sp)).join('')}</div>`;

      const list = animals.length ? `<div class="animals">${animals.map(card).join('')}</div>` : '';
      return `${header}${breeding}${list}<div class="pen-buy">${buy}</div>`;
    },
    actions: {
      pick: ({ id }) => {
        const a = store.state.animals.find((it) => it.id === Number(id));
        if (!a) return;
        confirmSell = undefined;
        if (a.sex === 'F') motherId = motherId === a.id ? undefined : a.id;
        else fatherId = fatherId === a.id ? undefined : a.id;
      },
      breed: () => {
        if (!motherId || !fatherId) return;
        const result = store.act((s) => breed(s, penId, motherId!, fatherId!));
        if (!result.ok) bus.emit('toast', { text: result.reason, kind: 'error' });
        else {
          bus.emit('toast', { text: 'Un petit est en route !', kind: 'success' });
          motherId = undefined;
          fatherId = undefined;
        }
      },
      sell: ({ id }) => {
        const animalId = Number(id);
        if (confirmSell !== animalId) {
          confirmSell = animalId;
          return;
        }
        confirmSell = undefined;
        const result = store.act((s) => sellAnimal(s, animalId));
        if (result.ok) bus.emit('float', { buildingId: penId, text: `+${result.amount}`, resource: 'or' });
      },
      buy: ({ species }) => buyInBestPen(store, species as Species, penId),
    },
  };
}

function speciesButton(store: Store, species: Species): string {
  const def = SPECIES[species];
  const locked = def.townHall > townHallLevel(store.state);
  return `
    <button class="species ${locked ? 'locked' : ''}" data-action="buy" data-species="${species}" ${locked ? 'disabled' : ''}>
      <img src="${animalThumb(species, 'normal', false)}" alt="">
      <span>${def.name}</span>
      <span class="small">${locked ? `Mairie ${def.townHall}` : `${icon('or', 'mini')}${formatNumber(def.price)}`}</span>
    </button>`;
}
