export const MUSCLES = [
  "Pectoraux", "Dos", "Épaules", "Biceps", "Triceps", "Avant-bras",
  "Quadriceps", "Ischios", "Fessiers", "Mollets", "Abdos", "Cardio",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENTS = [
  "Barre", "Haltères", "Machine", "Poulie", "Poids du corps", "Kettlebell", "Autre",
] as const;
export type Equipment = (typeof EQUIPMENTS)[number];

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  custom: boolean;
}

export interface TemplateItem {
  exerciseId: string;
  sets: number;
  reps: number;
}

export interface Template {
  id: string;
  name: string;
  items: TemplateItem[];
  updatedAt: number;
}

export interface WorkSet {
  id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  warmup: boolean;
  done: boolean;
}

export interface SessionItem {
  id: string;
  exerciseId: string;
  sets: WorkSet[];
}

export interface Session {
  id: string;
  name: string;
  templateId: string | null;
  startedAt: number;
  /** null tant que la séance est en cours. */
  endedAt: number | null;
  note: string;
  items: SessionItem[];
}

export interface Measurement {
  id: string;
  date: number;
  weight: number | null;
  waist: number | null;
  bodyFat: number | null;
  chest: number | null;
  arm: number | null;
  thigh: number | null;
}

export interface Backup {
  app: "fonte";
  version: 1;
  exportedAt: number;
  exercises: Exercise[];
  templates: Template[];
  sessions: Session[];
  measurements: Measurement[];
}
