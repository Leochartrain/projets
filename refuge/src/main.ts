import '@fontsource/lilita-one';
import Phaser from 'phaser';
import './style.css';
import { bus } from './app/bus.ts';
import * as sim from './game/sim.ts';
import { Store } from './game/store.ts';
import { WorldScene } from './scene/WorldScene.ts';
import { mountUi } from './ui/index.ts';

async function start(): Promise<void> {
  // La police sert aussi dans les dessins (panneaux) et les textes du jeu : on l'attend.
  await document.fonts.load('20px "Lilita One"');

  const store = new Store();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#3f7a2a',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false },
    scene: [new WorldScene(store)],
  });
  mountUi(store);
  // Accès depuis la console pendant le développement (et pour les tests automatiques).
  if (import.meta.env.DEV) Object.assign(window, { refuge: { store, sim, bus } });
  document.getElementById('loading')?.remove();
}

start();
