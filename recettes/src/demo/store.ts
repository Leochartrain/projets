// Mode visite (`npm run demo`) : une fausse base en mémoire, remplie d'exemples,
// pour se promener dans l'appli sans compte ni Supabase. Tout est perdu au rechargement.
import type { Ingredient } from '@/lib/ingredients';
import type { MemberRole, RecipeCategory } from '@/lib/types';

export const ME = 'demo-moi';
export const MY_EMAIL = 'visite@exemple.fr';

export interface DemoRecipe {
  id: string;
  authorId: string;
  title: string;
  passedDownBy: string | null;
  story: string | null;
  category: RecipeCategory | null;
  servings: number | null;
  servingsLabel: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  /** En mode visite, une photo ajoutée est gardée sous forme de lien local (blob:). */
  photoPaths: string[];
  originalPaths: string[];
  updatedAt: string;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const i = (quantity: number | null, unit: string | null, name: string): Ingredient => ({ quantity, unit, name });

export const db = {
  profiles: new Map<string, string>([
    [ME, 'Visiteur'],
    ['jeanne', 'Mamie Jeanne'],
    ['paul', 'Paul'],
    ['sophie', 'Sophie'],
    ['karim', 'Karim'],
  ]),
  groups: [
    { id: 'famille', name: 'Famille Richard' },
    { id: 'lycee', name: 'Les potes du lycée' },
  ],
  members: [
    { groupId: 'famille', userId: ME, role: 'admin' as MemberRole, joinedAt: daysAgo(60) },
    { groupId: 'famille', userId: 'jeanne', role: 'member' as MemberRole, joinedAt: daysAgo(59) },
    { groupId: 'famille', userId: 'paul', role: 'member' as MemberRole, joinedAt: daysAgo(50) },
    { groupId: 'famille', userId: 'sophie', role: 'member' as MemberRole, joinedAt: daysAgo(40) },
    { groupId: 'lycee', userId: 'karim', role: 'admin' as MemberRole, joinedAt: daysAgo(30) },
    { groupId: 'lycee', userId: ME, role: 'member' as MemberRole, joinedAt: daysAgo(29) },
    { groupId: 'lycee', userId: 'sophie', role: 'member' as MemberRole, joinedAt: daysAgo(20) },
  ],
  recipes: [
    {
      id: 'tarte-tatin',
      authorId: 'jeanne',
      title: 'Tarte Tatin',
      passedDownBy: 'Arrière-grand-mère Lucienne',
      story: 'Faite chaque dimanche d\'automne avec les pommes du verger. Le secret : ne pas avoir peur de la couleur du caramel.',
      category: 'dessert',
      servings: 8,
      servingsLabel: null,
      prepMinutes: 30,
      cookMinutes: 45,
      ingredients: [i(1.5, 'kg', 'pommes (Reinette ou Golden)'), i(150, 'g', 'sucre'), i(80, 'g', 'beurre demi-sel'), i(1, null, 'pâte brisée')],
      steps: [
        'Éplucher les pommes et les couper en quartiers.',
        'Dans le moule, faire fondre le beurre et le sucre jusqu\'à obtenir un caramel blond.',
        'Serrer les quartiers de pommes debout dans le caramel, cuire 10 minutes à feu doux.',
        'Couvrir avec la pâte en rentrant les bords, piquer à la fourchette.',
        'Cuire 35 minutes à 200 °C, laisser tiédir 5 minutes puis retourner sur un plat.',
      ],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(2),
    },
    {
      id: 'boeuf-bourguignon',
      authorId: 'paul',
      title: 'Bœuf bourguignon',
      passedDownBy: 'Papi Henri',
      story: 'Toujours meilleur réchauffé le lendemain.',
      category: 'plat',
      servings: 6,
      servingsLabel: null,
      prepMinutes: 40,
      cookMinutes: 180,
      ingredients: [
        i(1.5, 'kg', 'bœuf à braiser (paleron, joue)'),
        i(75, 'cl', 'vin rouge de Bourgogne'),
        i(200, 'g', 'lardons'),
        i(250, 'g', 'champignons de Paris'),
        i(3, null, 'carottes'),
        i(2, null, 'oignons'),
        i(2, 'gousse', 'ail'),
        i(1, null, 'bouquet garni'),
        i(2, 'c. à soupe', 'farine'),
      ],
      steps: [
        'La veille, faire mariner la viande dans le vin avec les carottes, les oignons et le bouquet garni.',
        'Égoutter la viande et la faire dorer en plusieurs fois dans une cocotte.',
        'Saupoudrer de farine, mélanger, puis verser la marinade.',
        'Laisser mijoter 3 heures à couvert, à tout petit feu.',
        'Faire revenir lardons et champignons, les ajouter 15 minutes avant la fin.',
      ],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(5),
    },
    {
      id: 'crepes',
      authorId: ME,
      title: 'Crêpes de la Chandeleur',
      passedDownBy: null,
      story: null,
      category: 'dessert',
      servings: null,
      servingsLabel: 'une vingtaine de crêpes',
      prepMinutes: 10,
      cookMinutes: 30,
      ingredients: [i(250, 'g', 'farine'), i(4, null, 'œufs'), i(50, 'cl', 'lait'), i(50, 'g', 'beurre fondu'), i(1, 'pincée', 'sel'), i(1, 'c. à soupe', 'rhum')],
      steps: [
        'Mélanger la farine et le sel, creuser un puits et y casser les œufs.',
        'Verser le lait petit à petit en fouettant pour éviter les grumeaux.',
        'Ajouter le beurre fondu et le rhum, laisser reposer 1 heure.',
        'Cuire dans une poêle chaude légèrement beurrée, 1 minute de chaque côté.',
      ],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(8),
    },
    {
      id: 'tajine',
      authorId: 'karim',
      title: 'Tajine poulet citron confit',
      passedDownBy: 'Ma mère',
      story: 'Le plat des soirées révisions du bac.',
      category: 'plat',
      servings: 4,
      servingsLabel: null,
      prepMinutes: 20,
      cookMinutes: 75,
      ingredients: [
        i(1, null, 'poulet coupé en morceaux'),
        i(2, null, 'citrons confits'),
        i(150, 'g', 'olives vertes'),
        i(2, null, 'oignons'),
        i(1, 'c. à café', 'gingembre'),
        i(1, 'c. à café', 'curcuma'),
        i(1, 'botte', 'coriandre'),
      ],
      steps: [
        'Faire revenir les oignons émincés avec les épices dans l\'huile d\'olive.',
        'Ajouter le poulet, le faire dorer de tous côtés.',
        'Mouiller avec un verre d\'eau, couvrir et laisser mijoter 1 heure.',
        'Ajouter les citrons confits en quartiers et les olives, cuire encore 15 minutes.',
        'Parsemer de coriandre au moment de servir.',
      ],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(12),
    },
    {
      id: 'guacamole',
      authorId: 'sophie',
      title: 'Guacamole express',
      passedDownBy: null,
      story: null,
      category: 'apero',
      servings: 4,
      servingsLabel: null,
      prepMinutes: 10,
      cookMinutes: null,
      ingredients: [i(3, null, 'avocats mûrs'), i(1, null, 'citron vert'), i(1, null, 'tomate'), i(0.5, null, 'oignon rouge'), i(null, null, 'sel, piment')],
      steps: ['Écraser les avocats à la fourchette avec le jus du citron vert.', 'Ajouter la tomate et l\'oignon en petits dés, saler, pimenter.'],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(15),
    },
    {
      id: 'soupe',
      authorId: ME,
      title: 'Soupe de potiron',
      passedDownBy: null,
      story: 'À peaufiner avant de la partager.',
      category: 'entree',
      servings: 4,
      servingsLabel: null,
      prepMinutes: 15,
      cookMinutes: 30,
      ingredients: [i(1, 'kg', 'potiron'), i(1, null, 'pomme de terre'), i(1, null, 'oignon'), i(20, 'cl', 'crème fraîche')],
      steps: ['Couper les légumes en cubes, les couvrir d\'eau et cuire 30 minutes.', 'Mixer avec la crème, saler et poivrer.'],
      photoPaths: [],
      originalPaths: [],
      updatedAt: daysAgo(1),
    },
  ] as DemoRecipe[],
  shares: [
    { recipeId: 'tarte-tatin', groupId: 'famille' },
    { recipeId: 'boeuf-bourguignon', groupId: 'famille' },
    { recipeId: 'crepes', groupId: 'famille' },
    { recipeId: 'crepes', groupId: 'lycee' },
    { recipeId: 'tajine', groupId: 'lycee' },
    { recipeId: 'guacamole', groupId: 'lycee' },
    { recipeId: 'guacamole', groupId: 'famille' },
  ],
  favorites: [{ recipeId: 'tarte-tatin', createdAt: daysAgo(3) }],
  reviews: [
    { id: 'r1', recipeId: 'tarte-tatin', groupId: 'famille', authorId: 'paul', rating: 5, comment: 'Exactement comme chez Mamie !', createdAt: daysAgo(2) },
    { id: 'r2', recipeId: 'tarte-tatin', groupId: 'famille', authorId: 'sophie', rating: 4, comment: 'Mon caramel a un peu brûlé, mais délicieuse.', createdAt: daysAgo(1) },
    { id: 'r3', recipeId: 'tajine', groupId: 'lycee', authorId: 'sophie', rating: 5, comment: null, createdAt: daysAgo(10) },
    { id: 'r4', recipeId: 'crepes', groupId: 'lycee', authorId: 'karim', rating: 4, comment: 'Avec du sucre et du citron, rien de mieux.', createdAt: daysAgo(6) },
  ] as { id: string; recipeId: string; groupId: string; authorId: string; rating: number | null; comment: string | null; createdAt: string }[],
  invitations: [{ code: 'K7P2QX', groupId: 'famille', expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() }],
};

export function profileName(userId: string): string {
  return db.profiles.get(userId) ?? 'Inconnu';
}

export function myGroupIds(): Set<string> {
  return new Set(db.members.filter((m) => m.userId === ME).map((m) => m.groupId));
}

/** Les mêmes règles que la base : mes recettes, et celles partagées dans mes groupes. */
export function visibleRecipes(): DemoRecipe[] {
  const groups = myGroupIds();
  return db.recipes.filter((r) => r.authorId === ME || db.shares.some((s) => s.recipeId === r.id && groups.has(s.groupId)));
}

export function sharesOf(recipeId: string) {
  return db.shares.filter((s) => s.recipeId === recipeId);
}

/** Comme une erreur Supabase : un objet avec un `message`, affiché par errorMessage(). */
export function fail(message: string): never {
  throw { message };
}

/** Un court délai, pour voir les états de chargement comme avec un vrai serveur. */
export const wait = () => new Promise((resolve) => setTimeout(resolve, 150));
