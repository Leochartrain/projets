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

// Adhésion annuelle : obligatoire pour faire réparer un objet, valable pour l'année civile.
// Tarif réduit pour les habitants de certaines communes (liste réglable), tarif normal sinon.

export const RATES = ['reduced', 'standard', 'free'] as const;
export type Rate = (typeof RATES)[number];
export const RATE_LABELS: Record<Rate, string> = { reduced: 'Tarif réduit', standard: 'Tarif normal', free: 'Offerte' };

export const PAYMENT_METHODS = ['cash', 'check', 'card', 'transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: 'Espèces', check: 'Chèque', card: 'Carte', transfer: 'Virement' };

export interface MembershipSettings {
  reducedCents: number;
  standardCents: number;
  /** Communes dont les habitants paient le tarif réduit. */
  reducedTowns: string[];
}

export const DEFAULT_MEMBERSHIP: MembershipSettings = { reducedCents: 800, standardCents: 5000, reducedTowns: [] };

/** « Saint-Jacques-de-la-Lande », « st jacques de la lande » → « saintjacquesdelalande ». */
export function townKey(town: string): string {
  return town
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\bste?\b/g, (m) => (m === 'st' ? 'saint' : 'sainte'))
    .replace(/[^a-z0-9]/g, '');
}

/** Tarif d'après la commune ; null si la commune n'est pas encore connue. */
export function suggestedRate(city: string | null, settings: MembershipSettings): Exclude<Rate, 'free'> | null {
  if (!city?.trim()) return null;
  const key = townKey(city);
  return settings.reducedTowns.some((town) => townKey(town) === key) ? 'reduced' : 'standard';
}

export function rateAmount(rate: Rate, settings: MembershipSettings): number {
  return rate === 'reduced' ? settings.reducedCents : rate === 'standard' ? settings.standardCents : 0;
}

export interface Membership {
  id: number;
  visitorId: number;
  year: number;
  rate: Rate;
  amountCents: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string;
}

export interface MembershipInput {
  rate: Rate;
  amountCents: number;
  paymentMethod: PaymentMethod | null;
}

// Comptes de l'équipe : les administrateurs gèrent les comptes et les réglages.

export const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrateur', member: 'Bénévole' };

/** Longueur minimale d'un mot de passe choisi dans l'appli. */
export const MIN_PASSWORD = 8;

export interface TeamUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
}

export interface Me {
  user: TeamUser | null;
  /** Aucun compte n'existe encore : la page de connexion propose de créer le premier. */
  needsSetup: boolean;
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
  visitorCity: string | null;
  /** Adhésion de l'année en cours réglée. */
  visitorIsMember: boolean;
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
  city: string | null;
  notes: string | null;
  charterAcceptedAt: string | null;
  anonymized: boolean;
  createdAt: string;
  repairCount: number;
  lastVisit: string | null;
  /** Adhésion de l'année en cours, si elle est réglée. */
  membership: Membership | null;
}

export interface VisitorDetail extends Visitor {
  repairs: Repair[];
  memberships: Membership[];
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
  /** Adhésions de l'année en cours. */
  members: number;
  membershipsCents: number;
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
  "L'adhésion à l'association, valable pour l'année civile, est obligatoire pour faire réparer un objet. Elle se règle à l'accueil.",
  "Les pièces neuves éventuelles sont à ta charge. Les objets non récupérés en fin de séance ne sont pas gardés.",
  "Tes coordonnées servent uniquement à te recontacter pour ce rendez-vous ou cette réparation. Tu peux demander leur suppression à tout moment.",
];
