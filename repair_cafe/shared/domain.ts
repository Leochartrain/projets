// Vocabulaire commun au serveur et à l'interface : catégories d'objets, étapes d'une
// réparation, résultats (inspirés de la fiche Repair Monitor de la fondation Repair Café).

export const CATEGORIES = [
  { id: 'petit-electromenager', label: 'Petit électroménager', kg: 2.5 },
  { id: 'electronique', label: 'Audio, vidéo, électronique', kg: 3 },
  { id: 'informatique', label: 'Informatique et téléphonie', kg: 1.5 },
  { id: 'luminaire', label: 'Luminaires', kg: 1.5 },
  { id: 'textile', label: 'Textile et couture', kg: 0.6 },
  { id: 'velo', label: 'Vélos et trottinettes', kg: 14 },
  { id: 'mobilier', label: 'Mobilier et bois', kg: 7 },
  { id: 'jouet', label: 'Jouets', kg: 1 },
  { id: 'autre', label: 'Autre', kg: 1 },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Poids retenu pour les déchets évités : celui pesé, sinon une moyenne de la catégorie. */
export function weightOf(category: string, weightKg: number | null): number {
  return weightKg ?? CATEGORIES.find((c) => c.id === category)?.kg ?? 1;
}

/** Le parcours d'un objet : rendez-vous → arrivé (en attente) → en réparation → terminé. */
export const STATUSES = ['booked', 'waiting', 'in_progress', 'done', 'cancelled', 'no_show'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = {
  booked: 'Rendez-vous',
  waiting: 'En attente',
  in_progress: 'En réparation',
  done: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

export const OUTCOMES = ['repaired', 'repairable', 'not_repairable', 'advice'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABELS: Record<Outcome, string> = {
  repaired: 'Réparé',
  repairable: 'À poursuivre',
  not_repairable: 'Non réparable',
  advice: 'Conseil donné',
};
export const OUTCOME_HINTS: Record<Outcome, string> = {
  repaired: "L'objet repart en état de marche.",
  repairable: 'Pièce à commander, ou à finir à la prochaine séance.',
  not_repairable: 'Panne trop lourde, pièce introuvable ou réparation dangereuse.',
  advice: 'Pas de réparation sur place, mais une piste pour la faire soi-même.',
};

/** Créneaux d'une séance : de l'ouverture à la fermeture, par pas de `slotMinutes`. */
export function slotsOf(session: { startTime: string; endTime: string; slotMinutes: number }): string[] {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const slots: string[] = [];
  for (let t = toMinutes(session.startTime); t + session.slotMinutes <= toMinutes(session.endTime); t += session.slotMinutes) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
}

// Formes renvoyées par l'API.

export interface Session {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  slotMinutes: number;
  perSlot: number;
  notes: string | null;
  /** Rendez-vous et passages non annulés. */
  booked: number;
  capacity: number;
  done: number;
}

export interface Repair {
  id: number;
  visitorId: number;
  visitorName: string;
  visitorPhone: string | null;
  sessionId: number | null;
  sessionDate: string | null;
  slotTime: string | null;
  category: CategoryId;
  object: string;
  brand: string | null;
  model: string | null;
  ageYears: number | null;
  problem: string;
  weightKg: number | null;
  status: Status;
  volunteerId: number | null;
  volunteerName: string | null;
  outcome: Outcome | null;
  diagnosis: string | null;
  notes: string | null;
  donationCents: number | null;
  arrivedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface SessionDetail extends Session {
  slots: string[];
  repairs: Repair[];
}

export interface Visitor {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  notes: string | null;
  charterAcceptedAt: string | null;
  anonymized: boolean;
  createdAt: string;
  repairCount: number;
  lastVisit: string | null;
}

export interface VisitorDetail extends Visitor {
  repairs: Repair[];
}

export interface Volunteer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  skills: CategoryId[];
  active: boolean;
  interventions: number;
  repaired: number;
}

export interface Stats {
  received: number;
  finished: number;
  repaired: number;
  repairable: number;
  notRepairable: number;
  advice: number;
  kgSaved: number;
  visitors: number;
  volunteers: number;
  donationsCents: number;
  byCategory: { category: CategoryId; finished: number; repaired: number }[];
  nextSession: Session | null;
  recent: Repair[];
}

export interface PublicSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  slots: { time: string; free: number }[];
}

export interface BookingConfirmation {
  repairId: number;
  date: string;
  slotTime: string;
  place: string;
}

export const CHARTER = [
  "Les réparations sont faites gratuitement par des bénévoles. Une participation libre aide à payer les pièces, l'outillage et le café.",
  "Les réparateurs font de leur mieux mais n'ont pas d'obligation de résultat : ils peuvent refuser une réparation qu'ils jugent dangereuse ou impossible.",
  "Tu répares avec le bénévole : l'idée est d'apprendre, pas de déposer l'objet.",
  "Le Repair Café et ses bénévoles ne sont pas responsables des dommages causés à l'objet ni des conséquences d'une réparation ratée.",
  "Les pièces neuves éventuelles sont à ta charge. Les objets non récupérés en fin de séance ne sont pas gardés.",
  "Tes coordonnées servent uniquement à te recontacter pour ce rendez-vous ou cette réparation. Tu peux demander leur suppression à tout moment.",
];
