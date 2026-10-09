import { bus, type Selection } from '../app/bus.ts';
import { clearObstacle, collect, demolish, finishNow, upgrade } from '../game/sim.ts';
import type { Store } from '../game/store.ts';
import { mountActionBar } from './actionBar.ts';
import { bestiaryContent } from './bestiary.ts';
import { mountHud } from './hud.ts';
import { infoContent } from './infoPanel.ts';
import { Modal } from './modal.ts';
import { penContent } from './penPanel.ts';
import { shopContent } from './shop.ts';
import { mountToasts } from './toast.ts';
import { View, el } from './view.ts';

/** Monte toute l'interface HTML par-dessus le jeu. */
export function mountUi(store: Store): void {
  const modal = new Modal();
  let selection: Selection = null;
  let placing = false;

  const selectedBuilding = () =>
    selection?.kind === 'building' ? store.state.buildings.find((b) => b.id === selection!.id) : undefined;

  const report = (result: { ok: boolean; reason?: string }) => {
    if (!result.ok) bus.emit('toast', { text: result.reason!, kind: 'error' });
  };

  const views: View[] = mountHud(store, {
    shop: () => modal.open(shopContent(store, () => modal.close(), () => selectedBuilding()?.type === 'enclos' ? selection!.id : undefined)),
    bestiary: () => modal.open(bestiaryContent(store)),
    menu: () => modal.open(menuContent()),
    focusTownHall: () => {
      const mairie = store.state.buildings.find((b) => b.type === 'mairie');
      if (mairie) {
        bus.emit('focus', mairie.id);
        bus.emit('select', { kind: 'building', id: mairie.id });
      }
    },
  });

  const actionBar = mountActionBar(store, () => selection, {
    info: () => selection && modal.open(infoContent(store, selection.id)),
    upgrade: () => {
      const b = selectedBuilding();
      if (!b) return;
      const result = store.act((s) => upgrade(s, b.id));
      report(result);
      if (result.ok) bus.emit('float', { buildingId: b.id, text: 'Au travail !' });
    },
    finish: () => {
      const b = selectedBuilding();
      if (b) report(store.act((s) => finishNow(s, b.id)));
    },
    collect: () => {
      const b = selectedBuilding();
      if (!b) return;
      const result = store.act((s) => collect(s, b.id));
      if (result.ok) bus.emit('float', { buildingId: b.id, text: `+${result.amount}`, resource: result.resource });
      else report(result);
    },
    pen: () => selection && modal.open(penContent(store, selection.id)),
    move: () => {
      const b = selectedBuilding();
      if (b) bus.emit('placeStart', { mode: 'move', id: b.id, type: b.type });
    },
    demolish: () => {
      const b = selectedBuilding();
      if (b) report(store.act((s) => demolish(s, b.id)));
    },
    clear: () => {
      if (selection?.kind !== 'obstacle') return;
      const id = selection.id;
      const result = store.act((s) => clearObstacle(s, id));
      report(result);
      if (result.ok && result.gems) bus.emit('toast', { text: `Tu as trouvé ${result.gems} gemme${result.gems > 1 ? 's' : ''} !`, kind: 'success' });
    },
  });
  views.push(actionBar);

  const placementBar = new View(el('placement'), () => {
    if (!placing) return '';
    return `<span>Touche la carte pour choisir l’emplacement, puis touche encore pour poser.</span>
      <button class="round red small" data-action="cancel"><span class="round-face">✕</span></button>`;
  }, { cancel: () => bus.emit('placeCancel') });
  views.push(placementBar);

  function menuContent() {
    let confirm = false;
    return {
      title: () => 'Options',
      render: () => `
        <p>La partie est sauvegardée automatiquement dans ce navigateur, et le refuge continue de tourner quand le jeu est fermé.</p>
        <button class="btn red" data-action="reset">${confirm ? 'Vraiment tout effacer ?' : 'Nouvelle partie'}</button>`,
      actions: {
        reset: () => {
          if (!confirm) {
            confirm = true;
            return;
          }
          store.reset();
          modal.close();
          bus.emit('select', null);
          bus.emit('toast', { text: 'Nouvelle partie !', kind: 'success' });
        },
      },
    };
  }

  bus.on('select', (sel) => {
    selection = sel;
    actionBar.refresh();
  });
  bus.on('placeStart', () => {
    placing = true;
    modal.close();
    document.body.classList.add('placing');
    placementBar.refresh();
  });
  bus.on('placeEnd', () => {
    placing = false;
    document.body.classList.remove('placing');
    placementBar.refresh();
  });

  mountToasts();

  const update = () => {
    for (const v of views) v.update();
    modal.update();
  };
  store.subscribe(update);
  update();

  // Les clics dans une fenêtre changent son contenu sans passer par le jeu : on redessine.
  el('modal').addEventListener('click', () => queueMicrotask(() => modal.refresh()));
}
