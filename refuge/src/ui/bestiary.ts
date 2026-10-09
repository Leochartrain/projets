import { SPECIES, SPECIES_ORDER } from '../game/config.ts';
import { COATS, phenotypeKey } from '../game/genetics.ts';
import type { Store } from '../game/store.ts';
import type { ModalContent } from './modal.ts';
import { animalThumb } from './thumbs.ts';

/** Toutes les variantes de chaque espèce : celles déjà nées ou achetées sont révélées. */
export function bestiaryContent(store: Store): ModalContent {
  const total = SPECIES_ORDER.length * COATS.length * 2;
  return {
    title: () => `Bestiaire · ${store.state.discovered.length}/${total}`,
    wide: true,
    render: () => {
      const found = new Set(store.state.discovered);
      const rows = SPECIES_ORDER.map((species) => {
        const def = SPECIES[species];
        const cells = COATS.flatMap((coat) =>
          [false, true].map((spotted) => {
            const known = found.has(phenotypeKey(species, { coat, spotted }));
            const label = `${def.coats[coat].label}${spotted ? ', tacheté' : ''}`;
            return `
              <div class="beast ${known ? '' : 'unknown'}" title="${known ? label : '???'}">
                <img src="${animalThumb(species, coat, spotted)}" alt="">
                <span>${known ? label : '?'}</span>
              </div>`;
          }),
        ).join('');
        return `<section class="beast-row"><h3>${def.plural}</h3><div class="beast-cells">${cells}</div></section>`;
      }).join('');
      return `
        <p class="hint">Les couleurs rares se cachent dans les gènes : deux parents « normaux » peuvent avoir un petit noir ou albinos.
        Et très rarement, une mutation donne un animal <b>doré</b>, qui attire cinq fois plus de visiteurs.</p>
        ${rows}`;
    },
    actions: {},
  };
}
