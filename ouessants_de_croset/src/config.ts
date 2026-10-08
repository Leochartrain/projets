// Tout ce que l'association doit renseigner est ici. Une valeur à null s'affiche
// sur le site comme « [à compléter] » (surligné), pour ne rien oublier avant la mise en ligne.

export const ASSO = {
  name: 'Les Ouessants de Croset',
  tagline: 'Éco-pâturage avec des moutons d’Ouessant et des chèvres des fossés',

  phone: null as string | null, // ex. '06 10 33 00 00' (le logo montre « 06 10 33… », à confirmer)
  email: null as string | null, // ex. 'contact@ouessants-de-croset.fr'
  /** Commune ou secteur, affiché dans la page contact. */
  area: null as string | null,

  /** Présentation de l'association (« Qui sommes-nous ? » sur l'accueil) : histoire, lieu, valeurs, en 2 à 4 phrases. */
  about: null as string | null,

  // Mentions légales (obligatoires)
  address: null as string | null, // siège de l'association
  rna: null as string | null, // numéro RNA (W…) ou SIRET
  publicationManager: null as string | null, // responsable de la publication (souvent le ou la président·e)

  /** Les chiffres de la page d'accueil. */
  stats: {
    ouessant: null as number | null,
    fosses: null as number | null,
    sites: null as number | null,
  },

  social: {
    facebook: null as string | null,
    instagram: null as string | null,
  },
};

/**
 * Clé Web3Forms (gratuite, sur web3forms.com) : les messages du formulaire de contact
 * arrivent alors par e-mail. Elle n'est pas secrète. Sans clé, le formulaire propose d'écrire par e-mail.
 */
export const WEB3FORMS_KEY: string | null = null;

/**
 * Ce qui manque encore. Tant que cette liste n'est pas vide, le site demande aux moteurs
 * de recherche de ne pas le référencer (balise « noindex ») : Google n'affiche pas une version à moitié remplie.
 * Le blocage se lève tout seul au prochain déploiement une fois tout rempli.
 */
export const MISSING: string[] = Object.entries({
  téléphone: ASSO.phone,
  'e-mail': ASSO.email,
  secteur: ASSO.area,
  'présentation (about)': ASSO.about,
  'adresse du siège': ASSO.address,
  'numéro RNA ou SIRET': ASSO.rna,
  'responsable de la publication': ASSO.publicationManager,
  'nombre de moutons': ASSO.stats.ouessant,
  'nombre de chèvres': ASSO.stats.fosses,
  'nombre de terrains': ASSO.stats.sites,
  'clé Web3Forms': WEB3FORMS_KEY,
})
  .filter(([, value]) => value === null || value === '')
  .map(([label]) => label);

/** Hébergeur, pour les mentions légales. */
export const HOST = {
  name: 'Cloudflare, Inc.',
  address: '101 Townsend Street, San Francisco, CA 94107, États-Unis',
  site: 'https://www.cloudflare.com',
};
