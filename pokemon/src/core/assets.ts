import { SPECIES, type SpeciesId } from '../data/species.ts';

/** Sprites Mystic Woods (copiés par scripts/copy-assets.mjs). */
const MYSTIC = {
  player: 'characters/player.png',
  objects: 'objects/objects.png',
  grass: 'tilesets/grass.png',
  plains: 'tilesets/plains.png',
  decor: 'tilesets/decor_16x16.png',
  fences: 'tilesets/fences.png',
  water: 'tilesets/water1.png',
} as const;

export type SheetId = keyof typeof MYSTIC;

/**
 * Sprites de Diamant et Perle, hébergés par le projet PokeAPI : ils ne sont pas
 * dans le dépôt (ils appartiennent à Nintendo / Game Freak).
 */
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/diamond-pearl';

export interface PokemonSprites {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
}

export class Assets {
  readonly sheets = {} as Record<SheetId, HTMLImageElement>;
  readonly pokemon = {} as Record<SpeciesId, PokemonSprites>;

  async load(onProgress: (done: number, total: number) => void): Promise<void> {
    const base = `${import.meta.env.BASE_URL}assets/mystic/`;
    const sheets = Object.entries(MYSTIC) as [SheetId, string][];
    const species = Object.keys(SPECIES) as SpeciesId[];
    const total = sheets.length + species.length * 2;
    let done = 0;
    const tick = () => onProgress(++done, total);

    await Promise.all([
      ...sheets.map(async ([id, path]) => {
        this.sheets[id] = await loadImage(base + path);
        tick();
      }),
      ...species.map(async (id) => {
        const number = SPECIES[id].id;
        const [front, back] = await Promise.all([
          loadImage(`${POKEAPI}/${number}.png`).then(trim, () => placeholder(SPECIES[id].name)),
          loadImage(`${POKEAPI}/back/${number}.png`).then(trim, () => placeholder(SPECIES[id].name)),
        ]);
        tick();
        tick();
        this.pokemon[id] = { front, back };
      }),
    ]);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    image.src = src;
  });
}

/** Copie l'image dans un canvas 80 × 80 (taille des sprites de Diamant et Perle). */
function trim(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas;
}

/** Sans connexion à PokeAPI : une silhouette avec le nom, pour que le jeu reste jouable. */
function placeholder(name: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#505868';
  ctx.beginPath();
  ctx.ellipse(40, 50, 22, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 40, 54);
  return canvas;
}

/** Bas du dessin non transparent d'un sprite (pour le poser sur sa plateforme). */
export function spriteBottom(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = canvas.height - 1; y >= 0; y--) {
      for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 0) return y + 1;
    }
  } catch {
    // Image d'une autre origine sans autorisation : on garde la taille entière.
  }
  return canvas.height;
}
