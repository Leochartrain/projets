import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { SQLInputValue } from 'node:sqlite';
import { z } from 'zod';
import {
  CATEGORY_IDS,
  DEFAULT_MEMBERSHIP,
  OUTCOMES,
  PAYMENT_METHODS,
  RATES,
  STATUSES,
  type Membership,
  type MembershipSettings,
  categoryLabel,
  slotsOf,
  townKey,
  weightOf,
  OUTCOME_LABELS,
  STATUS_LABELS,
  type BookingConfirmation,
  type PublicSession,
  type Repair,
  type Session,
  type SessionDetail,
  type Stats,
  type Visitor,
  type VisitorDetail,
  type Volunteer,
} from '../shared/domain.ts';
import { transaction, type Db } from './db.ts';

z.config(z.locales.fr());

type Row = Record<string, SQLInputValue>;

/** Date du jour au format AAAA-MM-JJ, dans le fuseau du serveur (celui du Repair Café). */
export const today = () => new Date().toLocaleDateString('sv-SE');
const nowIso = () => new Date().toISOString();
/** L'adhésion vaut pour l'année civile. */
export const thisYear = () => new Date().getFullYear();
const YEAR_SQL = "cast(strftime('%Y', 'now', 'localtime') as integer)";

// --- Validation ---------------------------------------------------------------

/** Texte facultatif : une chaîne vide devient null. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));
const email = z
  .union([z.literal(''), z.email()])
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.toLowerCase() || null));
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure au format HH:MM');
const id = z.number().int().positive();

const FIELD_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'E-mail',
  phone: 'Téléphone',
  date: 'Date',
  startTime: 'Ouverture',
  endTime: 'Fermeture',
  place: 'Lieu',
  object: 'Objet',
  problem: 'Panne',
  category: 'Catégorie',
  name: 'Nom',
};

function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0]!;
  const field = issue.path.join('.');
  throw new HTTPException(400, { message: field ? `${FIELD_LABELS[field] ?? field} : ${issue.message}` : issue.message });
}

async function body(c: Context): Promise<unknown> {
  return c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Requête illisible.' });
  });
}

function idParam(c: Context): number {
  const value = Number(c.req.param('id'));
  if (!Number.isInteger(value) || value <= 0) throw new HTTPException(404, { message: 'Introuvable.' });
  return value;
}

function notFound(what: string): never {
  throw new HTTPException(404, { message: `${what} introuvable.` });
}

/** Garde les champs fournis (undefined = non fourni) et les renomme en colonnes SQL. */
function columns(input: Record<string, unknown>, names: Record<string, string>): Row {
  const row: Row = {};
  for (const [key, column] of Object.entries(names)) {
    const value = input[key];
    if (value === undefined) continue;
    row[column] = typeof value === 'boolean' ? Number(value) : (value as SQLInputValue);
  }
  return row;
}

function insert(db: Db, table: string, row: Row): number {
  const keys = Object.keys(row);
  const sql = `insert into ${table} (${keys.join(', ')}) values (${keys.map((k) => `:${k}`).join(', ')})`;
  return Number(db.prepare(sql).run(row).lastInsertRowid);
}

function update(db: Db, table: string, rowId: number, row: Row): void {
  const keys = Object.keys(row);
  if (keys.length === 0) return;
  db.prepare(`update ${table} set ${keys.map((k) => `${k} = :${k}`).join(', ')} where id = :id`).run({ ...row, id: rowId });
}

// --- Lectures ----------------------------------------------------------------

const REPAIR_SELECT = `
  select r.id, r.visitor_id as visitorId, v.first_name || ' ' || v.last_name as visitorName, v.phone as visitorPhone,
    v.city as visitorCity,
    exists (select 1 from memberships m where m.visitor_id = r.visitor_id and m.year = ${YEAR_SQL}) as visitorIsMember,
    r.session_id as sessionId, s.date as sessionDate, r.slot_time as slotTime, r.category, r.object, r.brand, r.model,
    r.age_years as ageYears, r.problem, r.weight_kg as weightKg, r.status, r.volunteer_id as volunteerId,
    vo.name as volunteerName, r.outcome, r.diagnosis, r.notes, r.donation_cents as donationCents,
    r.arrived_at as arrivedAt, r.started_at as startedAt, r.ended_at as endedAt, r.created_at as createdAt
  from repairs r
  join visitors v on v.id = r.visitor_id
  left join sessions s on s.id = r.session_id
  left join volunteers vo on vo.id = r.volunteer_id`;

const SESSION_SELECT = `
  select s.id, s.date, s.start_time as startTime, s.end_time as endTime, s.place, s.slot_minutes as slotMinutes,
    s.per_slot as perSlot, s.notes,
    (select count(*) from repairs r where r.session_id = s.id and r.status not in ('cancelled', 'no_show')) as booked,
    (select count(*) from repairs r where r.session_id = s.id and r.status = 'done') as done
  from sessions s`;

const VISITOR_SELECT = `
  select v.id, v.first_name as firstName, v.last_name as lastName, v.phone, v.email, v.postal_code as postalCode,
    v.city, v.notes, v.charter_accepted_at as charterAcceptedAt, v.anonymized, v.created_at as createdAt,
    (select count(*) from repairs r where r.visitor_id = v.id) as repairCount,
    (select max(s.date) from repairs r join sessions s on s.id = r.session_id
       where r.visitor_id = v.id and r.status in ('waiting', 'in_progress', 'done')) as lastVisit,
    m.id as m_id, m.year as m_year, m.rate as m_rate, m.amount_cents as m_amountCents,
    m.payment_method as m_paymentMethod, m.paid_at as m_paidAt
  from visitors v
  left join memberships m on m.visitor_id = v.id and m.year = ${YEAR_SQL}`;

const MEMBERSHIP_SELECT = `
  select id, visitor_id as visitorId, year, rate, amount_cents as amountCents, payment_method as paymentMethod, paid_at as paidAt
  from memberships`;

const VOLUNTEER_SELECT = `
  select vo.id, vo.name, vo.phone, vo.email, vo.skills, vo.active,
    (select count(*) from repairs r where r.volunteer_id = vo.id and r.status in ('in_progress', 'done')) as interventions,
    (select count(*) from repairs r where r.volunteer_id = vo.id and r.outcome = 'repaired') as repaired
  from volunteers vo`;

function toSession(row: Record<string, unknown>): Session {
  const session = row as unknown as Omit<Session, 'capacity'>;
  return { ...session, capacity: slotsOf(session).length * session.perSlot };
}

function toVisitor(row: Record<string, unknown>): Visitor {
  const visitor: Record<string, unknown> = {};
  const membership: Record<string, unknown> = { visitorId: row.id };
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('m_')) membership[key.slice(2)] = value;
    else visitor[key] = value;
  }
  return {
    ...(visitor as unknown as Visitor),
    anonymized: Boolean(row.anonymized),
    membership: row.m_id ? (membership as unknown as Membership) : null,
  };
}

const toRepair = (row: Record<string, unknown>): Repair => ({ ...(row as unknown as Repair), visitorIsMember: Boolean(row.visitorIsMember) });

function getSettings(db: Db): MembershipSettings {
  const row = db.prepare(`select value from settings where key = 'membership'`).get() as { value: string } | undefined;
  return { ...DEFAULT_MEMBERSHIP, ...(row ? JSON.parse(row.value) : {}) };
}

export function saveSettings(db: Db, settings: MembershipSettings): void {
  db.prepare(`insert into settings (key, value) values ('membership', ?) on conflict (key) do update set value = excluded.value`).run(JSON.stringify(settings));
}

const toVolunteer = (row: Record<string, unknown>): Volunteer => ({
  ...(row as unknown as Volunteer),
  skills: JSON.parse(String(row.skills)),
  active: Boolean(row.active),
});

function getRepair(db: Db, repairId: number): Repair {
  const row = db.prepare(`${REPAIR_SELECT} where r.id = ?`).get(repairId);
  return row ? toRepair(row) : notFound('Réparation');
}

function getSession(db: Db, sessionId: number): Session {
  const row = db.prepare(`${SESSION_SELECT} where s.id = ?`).get(sessionId);
  return row ? toSession(row) : notFound('Séance');
}

/** Places libres sur un créneau, sans compter la réparation `exceptId` (en cas de déplacement). */
function freeSeats(db: Db, session: Session, slotTime: string, exceptId = 0): number {
  const { taken } = db
    .prepare(`select count(*) as taken from repairs where session_id = ? and slot_time = ? and id != ? and status not in ('cancelled', 'no_show')`)
    .get(session.id, slotTime, exceptId) as { taken: number };
  return session.perSlot - taken;
}

function checkSlot(db: Db, sessionId: number, slotTime: string, exceptId = 0): Session {
  const session = getSession(db, sessionId);
  if (!slotsOf(session).includes(slotTime)) throw new HTTPException(400, { message: `Le créneau ${slotTime} n'existe pas pour cette séance.` });
  if (freeSeats(db, session, slotTime, exceptId) <= 0) throw new HTTPException(409, { message: `Le créneau de ${slotTime} est complet.` });
  return session;
}

// --- Schémas ------------------------------------------------------------------

const visitorFields = {
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: optional(30),
  email,
  postalCode: optional(10),
  city: optional(80),
  notes: optional(2000),
  charterAccepted: z.boolean().optional(),
};
const VISITOR_COLUMNS = { firstName: 'first_name', lastName: 'last_name', phone: 'phone', email: 'email', postalCode: 'postal_code', city: 'city', notes: 'notes' };

const membershipFields = z.object({
  rate: z.enum(RATES),
  amountCents: z.number().int().min(0).max(1_000_000),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
});

const settingsFields = z.object({
  reducedCents: z.number().int().min(0).max(1_000_000),
  standardCents: z.number().int().min(0).max(1_000_000),
  reducedTowns: z.array(z.string().trim().min(1).max(80)).max(500),
});

/** Enregistre l'adhésion de l'année en cours (une seule par visiteur et par an). */
function addMembership(db: Db, visitorId: number, input: z.output<typeof membershipFields>): void {
  const existing = db.prepare('select id from memberships where visitor_id = ? and year = ?').get(visitorId, thisYear());
  if (existing) throw new HTTPException(409, { message: `L'adhésion ${thisYear()} est déjà réglée.` });
  insert(db, 'memberships', { visitor_id: visitorId, year: thisYear(), rate: input.rate, amount_cents: input.amountCents, payment_method: input.paymentMethod, paid_at: nowIso() });
}

const sessionFields = {
  date,
  startTime: time,
  endTime: time,
  place: z.string().trim().min(1).max(200),
  slotMinutes: z.number().int().min(10).max(240),
  perSlot: z.number().int().min(1).max(50),
  notes: optional(2000),
};
const SESSION_COLUMNS = { date: 'date', startTime: 'start_time', endTime: 'end_time', place: 'place', slotMinutes: 'slot_minutes', perSlot: 'per_slot', notes: 'notes' };

const volunteerFields = {
  name: z.string().trim().min(1).max(80),
  phone: optional(30),
  email,
  skills: z.array(z.enum(CATEGORY_IDS)).max(CATEGORY_IDS.length),
  active: z.boolean(),
};

const objectFields = {
  category: z.enum(CATEGORY_IDS),
  object: z.string().trim().min(1).max(120),
  brand: optional(80),
  model: optional(80),
  ageYears: z.number().int().min(0).max(150).nullable().optional(),
  problem: z.string().trim().min(1).max(2000),
  weightKg: z.number().min(0).max(500).nullable().optional(),
};
const repairFields = {
  ...objectFields,
  visitorId: id,
  sessionId: id.nullable().optional(),
  slotTime: time.nullable().optional(),
  status: z.enum(STATUSES).optional(),
  volunteerId: id.nullable().optional(),
  outcome: z.enum(OUTCOMES).nullable().optional(),
  diagnosis: optional(4000),
  notes: optional(4000),
  donationCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
};
const REPAIR_COLUMNS = {
  visitorId: 'visitor_id',
  sessionId: 'session_id',
  slotTime: 'slot_time',
  category: 'category',
  object: 'object',
  brand: 'brand',
  model: 'model',
  ageYears: 'age_years',
  problem: 'problem',
  weightKg: 'weight_kg',
  status: 'status',
  volunteerId: 'volunteer_id',
  outcome: 'outcome',
  diagnosis: 'diagnosis',
  notes: 'notes',
  donationCents: 'donation_cents',
};

/** Horodatage de chaque étape, posé la première fois qu'on y arrive. */
const STEP_COLUMNS: Partial<Record<(typeof STATUSES)[number], 'arrived_at' | 'started_at' | 'ended_at'>> = {
  waiting: 'arrived_at',
  in_progress: 'started_at',
  done: 'ended_at',
};

// --- Application --------------------------------------------------------------

export function createApp(db: Db) {
  const app = new Hono().basePath('/api');

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: 'Erreur interne du serveur.' }, 500);
  });

  // Tableau de bord

  app.get('/stats', (c) => {
    const count = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n ?? 0;
    const done = db.prepare(`select category, weight_kg as weightKg, outcome, donation_cents as donationCents from repairs where status = 'done'`).all() as {
      category: string;
      weightKg: number | null;
      outcome: string;
      donationCents: number | null;
    }[];
    const byCategory = new Map<string, { finished: number; repaired: number }>();
    for (const r of done) {
      const entry = byCategory.get(r.category) ?? { finished: 0, repaired: 0 };
      entry.finished++;
      if (r.outcome === 'repaired') entry.repaired++;
      byCategory.set(r.category, entry);
    }
    const next = db.prepare(`${SESSION_SELECT} where s.date >= ? order by s.date, s.start_time limit 1`).get(today());
    const stats: Stats = {
      received: count(`select count(*) as n from repairs where status in ('waiting', 'in_progress', 'done')`),
      finished: done.length,
      repaired: done.filter((r) => r.outcome === 'repaired').length,
      repairable: done.filter((r) => r.outcome === 'repairable').length,
      notRepairable: done.filter((r) => r.outcome === 'not_repairable').length,
      advice: done.filter((r) => r.outcome === 'advice').length,
      kgSaved: Math.round(done.filter((r) => r.outcome === 'repaired').reduce((sum, r) => sum + weightOf(r.category, r.weightKg), 0) * 10) / 10,
      visitors: count(`select count(*) as n from visitors`),
      volunteers: count(`select count(*) as n from volunteers where active = 1`),
      donationsCents: done.reduce((sum, r) => sum + (r.donationCents ?? 0), 0),
      members: count(`select count(*) as n from memberships where year = ${YEAR_SQL}`),
      membershipsCents: count(`select sum(amount_cents) as n from memberships where year = ${YEAR_SQL}`),
      byCategory: [...byCategory].map(([category, v]) => ({ category: category as Stats['byCategory'][number]['category'], ...v })).sort((a, b) => b.finished - a.finished),
      nextSession: next ? toSession(next) : null,
      recent: db.prepare(`${REPAIR_SELECT} where r.status = 'done' order by r.ended_at desc limit 6`).all().map(toRepair),
    };
    return c.json(stats);
  });

  // Réglages de l'adhésion

  app.get('/settings', (c) => c.json(getSettings(db)));

  app.put('/settings', async (c) => {
    const input = parse(settingsFields, await body(c));
    // Une commune par ligne, sans doublon.
    const unique = new Map<string, string>();
    for (const town of input.reducedTowns) if (!unique.has(townKey(town))) unique.set(townKey(town), town);
    const towns = [...unique.values()].sort((a, b) => a.localeCompare(b, 'fr'));
    saveSettings(db, { ...input, reducedTowns: towns });
    return c.json(getSettings(db));
  });

  // Séances

  app.get('/sessions', (c) => c.json(db.prepare(`${SESSION_SELECT} order by s.date desc, s.start_time desc`).all().map(toSession)));

  app.get('/sessions/:id', (c) => {
    const session = getSession(db, idParam(c));
    const repairs = db.prepare(`${REPAIR_SELECT} where r.session_id = ? order by r.slot_time is null, r.slot_time, r.id`).all(session.id).map(toRepair);
    const detail: SessionDetail = { ...session, slots: slotsOf(session), repairs };
    return c.json(detail);
  });

  app.post('/sessions', async (c) => {
    const input = parse(z.object(sessionFields), await body(c));
    if (input.endTime <= input.startTime) throw new HTTPException(400, { message: "La fermeture doit être après l'ouverture." });
    return c.json(getSession(db, insert(db, 'sessions', columns(input, SESSION_COLUMNS))), 201);
  });

  app.patch('/sessions/:id', async (c) => {
    const before = getSession(db, idParam(c));
    const input = parse(z.object(sessionFields).partial(), await body(c));
    if ((input.endTime ?? before.endTime) <= (input.startTime ?? before.startTime)) {
      throw new HTTPException(400, { message: "La fermeture doit être après l'ouverture." });
    }
    update(db, 'sessions', before.id, columns(input, SESSION_COLUMNS));
    return c.json(getSession(db, before.id));
  });

  app.delete('/sessions/:id', (c) => {
    const session = getSession(db, idParam(c));
    if (session.booked > 0) throw new HTTPException(409, { message: 'Cette séance a des rendez-vous : annule-les avant de la supprimer.' });
    db.prepare('delete from sessions where id = ?').run(session.id);
    return c.body(null, 204);
  });

  // Visiteurs

  app.get('/visitors', (c) => {
    const q = (c.req.query('q') ?? '').trim().toLowerCase();
    const where = q
      ? `where lower(v.first_name || ' ' || v.last_name) like :q or lower(v.last_name || ' ' || v.first_name) like :q
           or lower(coalesce(v.email, '')) like :q or replace(coalesce(v.phone, ''), ' ', '') like :phone`
      : '';
    const rows = db.prepare(`${VISITOR_SELECT} ${where} order by v.last_name collate nocase, v.first_name collate nocase limit 500`);
    return c.json((q ? rows.all({ q: `%${q}%`, phone: `%${q.replaceAll(' ', '')}%` }) : rows.all()).map(toVisitor));
  });

  app.get('/visitors/:id', (c) => {
    const row = db.prepare(`${VISITOR_SELECT} where v.id = ?`).get(idParam(c)) ?? notFound('Visiteur');
    const visitor = toVisitor(row);
    const repairs = db.prepare(`${REPAIR_SELECT} where r.visitor_id = ? order by coalesce(s.date, r.created_at) desc, r.id desc`).all(visitor.id).map(toRepair);
    const memberships = db.prepare(`${MEMBERSHIP_SELECT} where visitor_id = ? order by year desc`).all(visitor.id) as unknown as Membership[];
    const detail: VisitorDetail = { ...visitor, repairs, memberships };
    return c.json(detail);
  });

  /** Création d'une fiche, avec l'adhésion de l'année si elle est réglée tout de suite. */
  app.post('/visitors', async (c) => {
    const input = parse(z.object({ ...visitorFields, membership: membershipFields.nullable().optional() }), await body(c));
    const visitorId = transaction(db, () => {
      const newId = insert(db, 'visitors', { ...columns(input, VISITOR_COLUMNS), charter_accepted_at: input.charterAccepted ? nowIso() : null });
      if (input.membership) addMembership(db, newId, input.membership);
      return newId;
    });
    return c.json(toVisitor(db.prepare(`${VISITOR_SELECT} where v.id = ?`).get(visitorId)!), 201);
  });

  app.post('/visitors/:id/memberships', async (c) => {
    const visitorId = idParam(c);
    db.prepare('select id from visitors where id = ? and anonymized = 0').get(visitorId) ?? notFound('Visiteur');
    addMembership(db, visitorId, parse(membershipFields, await body(c)));
    return c.json(toVisitor(db.prepare(`${VISITOR_SELECT} where v.id = ?`).get(visitorId)!), 201);
  });

  /** Pour corriger une erreur de saisie. */
  app.delete('/memberships/:id', (c) => {
    const membershipId = idParam(c);
    db.prepare('select id from memberships where id = ?').get(membershipId) ?? notFound('Adhésion');
    db.prepare('delete from memberships where id = ?').run(membershipId);
    return c.body(null, 204);
  });

  app.patch('/visitors/:id', async (c) => {
    const visitorId = idParam(c);
    const input = parse(z.object(visitorFields).partial(), await body(c));
    const row = columns(input, VISITOR_COLUMNS);
    if (input.charterAccepted !== undefined) row.charter_accepted_at = input.charterAccepted ? nowIso() : null;
    db.prepare('select id from visitors where id = ?').get(visitorId) ?? notFound('Visiteur');
    update(db, 'visitors', visitorId, row);
    return c.json(toVisitor(db.prepare(`${VISITOR_SELECT} where v.id = ?`).get(visitorId)!));
  });

  /** Droit à l'effacement (RGPD) : on efface l'identité mais on garde les réparations pour les statistiques. */
  app.delete('/visitors/:id', (c) => {
    const visitorId = idParam(c);
    db.prepare('select id from visitors where id = ?').get(visitorId) ?? notFound('Visiteur');
    update(db, 'visitors', visitorId, { first_name: 'Visiteur', last_name: `anonyme n° ${visitorId}`, phone: null, email: null, notes: null, anonymized: 1 });
    return c.body(null, 204);
  });

  // Bénévoles

  app.get('/volunteers', (c) => c.json(db.prepare(`${VOLUNTEER_SELECT} order by vo.active desc, vo.name collate nocase`).all().map(toVolunteer)));

  app.post('/volunteers', async (c) => {
    const input = parse(z.object(volunteerFields), await body(c));
    const volunteerId = insert(db, 'volunteers', { name: input.name, phone: input.phone ?? null, email: input.email ?? null, skills: JSON.stringify(input.skills), active: Number(input.active) });
    return c.json(toVolunteer(db.prepare(`${VOLUNTEER_SELECT} where vo.id = ?`).get(volunteerId)!), 201);
  });

  app.patch('/volunteers/:id', async (c) => {
    const volunteerId = idParam(c);
    db.prepare('select id from volunteers where id = ?').get(volunteerId) ?? notFound('Bénévole');
    const input = parse(z.object(volunteerFields).partial(), await body(c));
    const row = columns(input, { name: 'name', phone: 'phone', email: 'email', active: 'active' });
    if (input.skills) row.skills = JSON.stringify(input.skills);
    update(db, 'volunteers', volunteerId, row);
    return c.json(toVolunteer(db.prepare(`${VOLUNTEER_SELECT} where vo.id = ?`).get(volunteerId)!));
  });

  // Réparations

  app.get('/repairs', (c) => {
    const filters: string[] = [];
    const params: Row = {};
    for (const [key, column] of [
      ['status', 'r.status'],
      ['category', 'r.category'],
      ['outcome', 'r.outcome'],
      ['sessionId', 'r.session_id'],
      ['volunteerId', 'r.volunteer_id'],
    ] as const) {
      const value = c.req.query(key);
      if (value) {
        filters.push(`${column} = :${key}`);
        params[key] = value;
      }
    }
    const q = (c.req.query('q') ?? '').trim().toLowerCase();
    if (q) {
      filters.push(`lower(r.object || ' ' || coalesce(r.brand, '') || ' ' || coalesce(r.model, '') || ' ' || r.problem || ' ' || v.first_name || ' ' || v.last_name) like :q`);
      params.q = `%${q}%`;
    }
    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    return c.json(db.prepare(`${REPAIR_SELECT} ${where} order by coalesce(s.date, substr(r.created_at, 1, 10)) desc, r.id desc limit 500`).all(params).map(toRepair));
  });

  app.get('/repairs/export.csv', (c) => {
    const repairs = db.prepare(`${REPAIR_SELECT} order by s.date, r.id`).all().map(toRepair);
    const header = ['N°', 'Séance', 'Catégorie', 'Objet', 'Marque', 'Modèle', 'Âge (ans)', 'Panne', 'Étape', 'Résultat', 'Diagnostic', 'Réparateur', 'Poids (kg)', 'Participation (€)'];
    const cell = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const lines = repairs.map((r) =>
      [
        r.id,
        r.sessionDate,
        categoryLabel(r.category),
        r.object,
        r.brand,
        r.model,
        r.ageYears,
        r.problem,
        STATUS_LABELS[r.status],
        r.outcome ? OUTCOME_LABELS[r.outcome] : '',
        r.diagnosis,
        r.volunteerName,
        r.weightKg?.toString().replace('.', ','),
        r.donationCents === null ? '' : (r.donationCents / 100).toFixed(2).replace('.', ','),
      ]
        .map(cell)
        .join(';'),
    );
    // BOM et point-virgule : s'ouvre directement dans Excel en français.
    return c.body(`﻿${[header.join(';'), ...lines].join('\r\n')}`, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reparations-${today()}.csv"`,
    });
  });

  app.get('/repairs/:id', (c) => c.json(getRepair(db, idParam(c))));

  app.post('/repairs', async (c) => {
    const input = parse(z.object(repairFields), await body(c));
    db.prepare('select id from visitors where id = ?').get(input.visitorId) ?? notFound('Visiteur');
    if (input.slotTime && !input.sessionId) throw new HTTPException(400, { message: 'Un créneau doit appartenir à une séance.' });
    if (input.sessionId) {
      if (input.slotTime) checkSlot(db, input.sessionId, input.slotTime);
      else getSession(db, input.sessionId);
    }
    // Sans créneau, c'est un passage sans rendez-vous : la personne est déjà là.
    const status = input.status ?? (input.slotTime ? 'booked' : 'waiting');
    if (status === 'done' && !input.outcome) throw new HTTPException(400, { message: 'Indique le résultat de la réparation pour la terminer.' });
    const now = nowIso();
    const row: Row = { ...columns(input, REPAIR_COLUMNS), status };
    if (status === 'waiting' || status === 'in_progress' || status === 'done') row.arrived_at = now;
    if (status === 'in_progress' || status === 'done') row.started_at = now;
    if (status === 'done') row.ended_at = now;
    return c.json(getRepair(db, insert(db, 'repairs', row)), 201);
  });

  app.patch('/repairs/:id', async (c) => {
    const before = getRepair(db, idParam(c));
    const input = parse(z.object(repairFields).partial(), await body(c));
    const sessionId = input.sessionId === undefined ? before.sessionId : input.sessionId;
    const slotTime = input.slotTime === undefined ? before.slotTime : input.slotTime;
    if (slotTime && !sessionId) throw new HTTPException(400, { message: 'Un créneau doit appartenir à une séance.' });
    if ((input.sessionId !== undefined || input.slotTime !== undefined) && sessionId && slotTime && (sessionId !== before.sessionId || slotTime !== before.slotTime)) {
      checkSlot(db, sessionId, slotTime, before.id);
    }
    const status = input.status ?? before.status;
    const outcome = input.outcome === undefined ? before.outcome : input.outcome;
    if (status === 'done' && !outcome) throw new HTTPException(400, { message: 'Indique le résultat de la réparation pour la terminer.' });

    const row = columns(input, REPAIR_COLUMNS);
    const stepColumn = input.status && input.status !== before.status ? STEP_COLUMNS[input.status] : undefined;
    const stepValues: Record<string, string | null> = { arrived_at: before.arrivedAt, started_at: before.startedAt, ended_at: before.endedAt };
    if (stepColumn && !stepValues[stepColumn]) row[stepColumn] = nowIso();
    // Arrivé sans être passé par « en attente » (passage direct en réparation) : on date aussi l'arrivée.
    if (stepColumn && stepColumn !== 'arrived_at' && !before.arrivedAt) row.arrived_at = nowIso();
    if (status === 'done' && !before.startedAt && !row.started_at) row.started_at = row.ended_at ?? nowIso();

    transaction(db, () => update(db, 'repairs', before.id, row));
    return c.json(getRepair(db, before.id));
  });

  // Réservation en ligne (page publique)

  app.get('/public/sessions', (c) => {
    const sessions = db.prepare(`${SESSION_SELECT} where s.date >= ? order by s.date, s.start_time limit 12`).all(today()).map(toSession);
    const result: PublicSession[] = sessions
      .map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        place: s.place,
        slots: slotsOf(s).map((t) => ({ time: t, free: Math.max(0, freeSeats(db, s, t)) })),
      }))
      .filter((s) => s.slots.some((slot) => slot.free > 0));
    return c.json(result);
  });

  /** Tarifs de l'adhésion, affichés sur la page de réservation. */
  app.get('/public/membership', (c) => c.json(getSettings(db)));

  app.post('/public/bookings', async (c) => {
    const input = parse(
      z.object({
        sessionId: id,
        slotTime: time,
        firstName: visitorFields.firstName,
        lastName: visitorFields.lastName,
        phone: visitorFields.phone,
        email: visitorFields.email,
        postalCode: visitorFields.postalCode,
        city: visitorFields.city,
        ...objectFields,
        charter: z.literal(true, { error: 'il faut accepter la charte pour réserver' }),
      }),
      await body(c),
    );
    if (!input.email && !input.phone) throw new HTTPException(400, { message: 'Laisse un e-mail ou un téléphone pour qu’on puisse te prévenir.' });
    const confirmation = transaction(db, (): BookingConfirmation => {
      const session = checkSlot(db, input.sessionId, input.slotTime);
      if (session.date < today()) throw new HTTPException(400, { message: 'Cette séance est passée.' });
      const visitorId = findVisitor(db, input.email ?? null, input.phone ?? null) ?? insert(db, 'visitors', { ...columns(input, VISITOR_COLUMNS) });
      update(db, 'visitors', visitorId, {
        charter_accepted_at: nowIso(),
        ...columns({ phone: input.phone ?? undefined, email: input.email ?? undefined, postalCode: input.postalCode ?? undefined, city: input.city ?? undefined }, VISITOR_COLUMNS),
      });
      const repairId = insert(db, 'repairs', {
        ...columns(input, REPAIR_COLUMNS),
        visitor_id: visitorId,
        session_id: session.id,
        slot_time: input.slotTime,
        status: 'booked',
      });
      return { repairId, date: session.date, slotTime: input.slotTime, place: session.place };
    });
    return c.json(confirmation, 201);
  });

  return app;
}

/** Un visiteur déjà connu (même e-mail ou même numéro), pour ne pas créer de doublon. */
function findVisitor(db: Db, email: string | null, phone: string | null): number | null {
  const digits = (value: string) => value.replace(/\D/g, '').replace(/^33/, '0');
  if (email) {
    const row = db.prepare('select id from visitors where email = ? and anonymized = 0').get(email) as { id: number } | undefined;
    if (row) return row.id;
  }
  if (phone && digits(phone).length >= 6) {
    const rows = db.prepare('select id, phone from visitors where phone is not null and anonymized = 0').all() as { id: number; phone: string }[];
    return rows.find((r) => digits(r.phone) === digits(phone))?.id ?? null;
  }
  return null;
}
