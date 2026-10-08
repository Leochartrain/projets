// Site de démonstration pour la prospection des boulangeries.
// La boulangerie est fictive. Le nom et la ville se changent sans recompiler, dans l'adresse :
//   https://boulangerie-demo.pages.dev/?nom=La%20Caisse%20à%20Pains&ville=La%20Ferté-Bernard

export const BOULANGERIE = {
  name: 'Le Fournil du Marché',
  city: 'votre ville',
  address: '1 place du Marché',
  phone: '02 00 00 00 00',
  /** Coordonnées du point sur la carte (ici : le centre de La Ferté-Bernard). */
  map: { lat: 48.1867, lon: 0.6533 },
};

/**
 * Horaires : une ligne par jour, du lundi (index 0) au dimanche.
 * Chaque créneau est [ouverture, fermeture] en heures décimales (7.5 = 7 h 30). Vide = fermé.
 */
export const HOURS: { day: string; slots: [number, number][] }[] = [
  { day: 'Lundi', slots: [[7, 13], [15.5, 19.5]] },
  { day: 'Mardi', slots: [[7, 13], [15.5, 19.5]] },
  { day: 'Mercredi', slots: [] },
  { day: 'Jeudi', slots: [[7, 13], [15.5, 19.5]] },
  { day: 'Vendredi', slots: [[7, 13], [15.5, 19.5]] },
  { day: 'Samedi', slots: [[7, 19.5]] },
  { day: 'Dimanche', slots: [[7, 13]] },
];

/** Qui a fait le site : affiché dans le bandeau « démonstration ». À compléter. */
export const AUTHOR = {
  name: null as string | null, // ex. 'Léo Dupont'
  contact: null as string | null, // ex. '06 00 00 00 00' ou une adresse e-mail
};
