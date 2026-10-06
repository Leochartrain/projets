import './style.css';
import { Assets } from './core/assets.ts';
import { Audio } from './core/audio.ts';
import { FONT, HEIGHT, WIDTH } from './core/constants.ts';
import { Input } from './core/input.ts';
import { Game } from './game.ts';
import { TitleScene } from './scenes/title.ts';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

/**
 * Le jeu dessine en 256 × 192 (un écran de DS), agrandi d'un facteur entier :
 * pixels nets pour les sprites, texte dessiné à la vraie résolution.
 */
function resize(): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT) * window.devicePixelRatio));
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  canvas.style.width = `${(WIDTH * scale) / window.devicePixelRatio}px`;
  canvas.style.height = `${(HEIGHT * scale) / window.devicePixelRatio}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

function loading(text: string): void {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#f8f8f8';
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, WIDTH / 2, HEIGHT / 2);
}

const input = new Input();
const audio = new Audio();
const assets = new Assets();
window.addEventListener('keydown', () => audio.unlock(), { once: true });

async function boot(): Promise<void> {
  loading('Chargement…');
  try {
    await document.fonts.load(`10px ${FONT}`).catch(() => undefined);
    await assets.load((done, total) => loading(`Chargement… ${done} / ${total}`));
    const game = new Game(ctx, input, audio, assets);
    game.reset(new TitleScene(game));
    game.start();
    // En développement : accès au jeu depuis la console.
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  } catch (error) {
    loading('Sprites Mystic Woods introuvables : lance « npm run assets » (voir le README).');
    console.error(error);
  }
}

void boot();
