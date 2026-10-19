// Site de démonstration pour la prospection des salons de coiffure.
// Le salon est fictif. Le nom et la ville se changent sans recompiler, dans l'adresse :
//   https://coiffure-demo.pages.dev/?nom=Nom%20du%20salon&ville=Sa%20ville

// Nom par défaut volontairement neutre : il ne doit ressembler à aucun vrai salon,
// pour que la même démo puisse être montrée à tous les prospects.
export const SALON = {
  name: 'Votre Salon',
  city: 'votre ville',
  address: '1 rue du Centre',
  phone: '02 00 00 00 00',
  /** Coordonnées du point sur la carte (ici : le centre de La Ferté-Bernard). */
  map: { lat: 48.1867, lon: 0.6533 },
};

/**
 * Horaires : une ligne par jour, du lundi (index 0) au dimanche.
 * Chaque créneau est [ouverture, fermeture] en heures décimales (8.5 = 8 h 30). Vide = fermé.
 * Ils servent aussi à proposer les créneaux de rendez-vous.
 */
export const HOURS: { day: string; slots: [number, number][] }[] = [
  { day: 'Lundi', slots: [] },
  { day: 'Mardi', slots: [[9, 12], [14, 19]] },
  { day: 'Mercredi', slots: [[9, 12], [14, 19]] },
  { day: 'Jeudi', slots: [[9, 12], [14, 19]] },
  { day: 'Vendredi', slots: [[9, 19]] },
  { day: 'Samedi', slots: [[8.5, 17]] },
  { day: 'Dimanche', slots: [] },
];

/** Prestations et tarifs. `from` = « à partir de » (le prix dépend de la longueur). Durée en minutes. */
export const PRESTATIONS: { category: string; items: { name: string; minutes: number; price: number; from?: boolean }[] }[] = [
  {
    category: 'Femmes',
    items: [
      { name: 'Shampooing, coupe, brushing', minutes: 60, price: 42, from: true },
      { name: 'Shampooing, brushing', minutes: 45, price: 28, from: true },
      { name: 'Coupe, séchage naturel', minutes: 45, price: 32 },
    ],
  },
  {
    category: 'Hommes',
    items: [
      { name: 'Coupe homme', minutes: 30, price: 21 },
      { name: 'Coupe et barbe', minutes: 45, price: 30 },
      { name: 'Taille de barbe', minutes: 15, price: 12 },
    ],
  },
  {
    category: 'Enfants',
    items: [
      { name: 'Coupe enfant (moins de 10 ans)', minutes: 20, price: 13 },
      { name: 'Coupe junior (10 à 16 ans)', minutes: 30, price: 18 },
    ],
  },
  {
    category: 'Couleur et soins',
    items: [
      { name: 'Couleur racines', minutes: 75, price: 38, from: true },
      { name: 'Mèches ou balayage', minutes: 120, price: 65, from: true },
      { name: 'Soin profond', minutes: 15, price: 10 },
      { name: 'Chignon, coiffure de mariage', minutes: 60, price: 45, from: true },
    ],
  },
];

/** L'équipe (prénoms fictifs), proposée au moment de réserver. */
export const TEAM = ['Camille', 'Julien'];

/** Qui a fait le site : affiché dans le bandeau « démonstration ». */
export const AUTHOR = {
  name: 'Léo Chartrain' as string | null,
  contact: null as string | null, // ex. '06 00 00 00 00' ou une adresse e-mail
};
