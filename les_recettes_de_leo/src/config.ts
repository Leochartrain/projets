// Ce qui définit le site : nom, présentation, catégories.

export const SITE = {
  name: 'Les recettes de Léo',
  tagline: 'pâtisserie maison',
  author: 'Léo Chartrain',
  description:
    'Les recettes de pâtisserie de Léo, pâtissier amateur : tartes, entremets, choux et gâteaux maison, expliqués pas à pas.',
};

/**
 * Les catégories, dans l'ordre de la carte. Seules celles qui contiennent au moins une recette
 * apparaissent sur le site. Pour en ajouter une, l'écrire ici puis l'utiliser dans une recette.
 */
export const CATEGORIES = [
  { slug: 'entremets', name: 'Entremets', intro: 'Mousses, inserts et glaçages : les gâteaux en plusieurs couches.' },
  { slug: 'tartes', name: 'Tartes', intro: 'Pâtes sablées, crèmes et fruits de saison.' },
  { slug: 'choux', name: 'Choux', intro: 'Éclairs, Paris-Brest, religieuses et autres pâtes à choux.' },
  { slug: 'viennoiseries', name: 'Viennoiseries', intro: 'Croissants, brioches et pâtes levées feuilletées.' },
  { slug: 'gateaux-de-voyage', name: 'Gâteaux de voyage', intro: 'Cakes, financiers et madeleines qui se gardent quelques jours.' },
  { slug: 'biscuits', name: 'Biscuits', intro: 'Sablés, cookies et petits gâteaux secs.' },
  { slug: 'desserts', name: 'Desserts', intro: 'Desserts à l’assiette, crèmes et verrines.' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
