import type { Equipment, Exercise, Muscle } from "./types";

/** Catalogue de départ, écrit pour Fonte. Les identifiants ne doivent jamais changer. */
const rows: [string, string, Muscle, Equipment][] = [
  ["dc-barre", "Développé couché", "Pectoraux", "Barre"],
  ["dc-halteres", "Développé couché haltères", "Pectoraux", "Haltères"],
  ["di-barre", "Développé incliné", "Pectoraux", "Barre"],
  ["di-halteres", "Développé incliné haltères", "Pectoraux", "Haltères"],
  ["presse-pecs", "Presse à pectoraux", "Pectoraux", "Machine"],
  ["ecarte-poulie", "Écarté à la poulie", "Pectoraux", "Poulie"],
  ["ecarte-halteres", "Écarté haltères", "Pectoraux", "Haltères"],
  ["pec-deck", "Pec deck", "Pectoraux", "Machine"],
  ["pompes", "Pompes", "Pectoraux", "Poids du corps"],
  ["dips-pecs", "Dips", "Pectoraux", "Poids du corps"],

  ["tractions", "Tractions", "Dos", "Poids du corps"],
  ["tractions-sup", "Tractions supination", "Dos", "Poids du corps"],
  ["tirage-vertical", "Tirage vertical", "Dos", "Poulie"],
  ["tirage-horizontal", "Tirage horizontal", "Dos", "Poulie"],
  ["rowing-barre", "Rowing barre", "Dos", "Barre"],
  ["rowing-haltere", "Rowing haltère", "Dos", "Haltères"],
  ["rowing-machine", "Rowing machine", "Dos", "Machine"],
  ["pull-over", "Pull-over à la poulie", "Dos", "Poulie"],
  ["souleve-terre", "Soulevé de terre", "Dos", "Barre"],
  ["hyperextension", "Extensions lombaires", "Dos", "Poids du corps"],

  ["dm-barre", "Développé militaire", "Épaules", "Barre"],
  ["dm-halteres", "Développé épaules haltères", "Épaules", "Haltères"],
  ["presse-epaules", "Presse à épaules", "Épaules", "Machine"],
  ["elev-lat", "Élévations latérales", "Épaules", "Haltères"],
  ["elev-lat-poulie", "Élévations latérales poulie", "Épaules", "Poulie"],
  ["oiseau", "Oiseau", "Épaules", "Haltères"],
  ["face-pull", "Face pull", "Épaules", "Poulie"],
  ["shrugs", "Shrugs", "Épaules", "Haltères"],

  ["curl-barre", "Curl barre", "Biceps", "Barre"],
  ["curl-halteres", "Curl haltères", "Biceps", "Haltères"],
  ["curl-incline", "Curl incliné", "Biceps", "Haltères"],
  ["curl-marteau", "Curl marteau", "Biceps", "Haltères"],
  ["curl-poulie", "Curl à la poulie", "Biceps", "Poulie"],
  ["curl-pupitre", "Curl pupitre", "Biceps", "Machine"],

  ["ext-poulie", "Extensions triceps poulie", "Triceps", "Poulie"],
  ["barre-front", "Barre au front", "Triceps", "Barre"],
  ["ext-nuque", "Extensions au-dessus de la tête", "Triceps", "Haltères"],
  ["dc-serre", "Développé couché serré", "Triceps", "Barre"],
  ["dips-banc", "Dips sur banc", "Triceps", "Poids du corps"],

  ["curl-poignets", "Curl poignets", "Avant-bras", "Haltères"],
  ["marche-fermier", "Marche du fermier", "Avant-bras", "Haltères"],

  ["squat", "Squat", "Quadriceps", "Barre"],
  ["squat-avant", "Squat avant", "Quadriceps", "Barre"],
  ["presse-cuisses", "Presse à cuisses", "Quadriceps", "Machine"],
  ["hack-squat", "Hack squat", "Quadriceps", "Machine"],
  ["fentes", "Fentes", "Quadriceps", "Haltères"],
  ["bulgare", "Squat bulgare", "Quadriceps", "Haltères"],
  ["leg-extension", "Leg extension", "Quadriceps", "Machine"],

  ["sdt-roumain", "Soulevé de terre roumain", "Ischios", "Barre"],
  ["leg-curl-assis", "Leg curl assis", "Ischios", "Machine"],
  ["leg-curl-allonge", "Leg curl allongé", "Ischios", "Machine"],

  ["hip-thrust", "Hip thrust", "Fessiers", "Barre"],
  ["abducteurs", "Machine à abducteurs", "Fessiers", "Machine"],
  ["kickback", "Kickback à la poulie", "Fessiers", "Poulie"],

  ["mollets-debout", "Mollets debout", "Mollets", "Machine"],
  ["mollets-assis", "Mollets assis", "Mollets", "Machine"],

  ["crunch", "Crunch", "Abdos", "Poids du corps"],
  ["crunch-poulie", "Crunch à la poulie", "Abdos", "Poulie"],
  ["releve-jambes", "Relevés de jambes", "Abdos", "Poids du corps"],
  ["gainage", "Gainage", "Abdos", "Poids du corps"],
  ["ab-wheel", "Roulette abdominale", "Abdos", "Autre"],

  ["kb-swing", "Swing kettlebell", "Fessiers", "Kettlebell"],
  ["rameur", "Rameur", "Cardio", "Machine"],
  ["velo", "Vélo", "Cardio", "Machine"],
  ["tapis", "Tapis de course", "Cardio", "Machine"],
];

export const CATALOG: Exercise[] = rows.map(([id, name, muscle, equipment]) => ({
  id,
  name,
  muscle,
  equipment,
  custom: false,
}));
