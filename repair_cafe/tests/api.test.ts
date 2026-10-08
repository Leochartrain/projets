import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createApp, today } from '../server/app.ts';
import { openDb } from '../server/db.ts';
import { createUser } from '../server/auth.ts';
import { seedDemo } from '../server/seed.ts';
import { suggestedRate, type Me, type MembershipSettings, type TeamUser, type PublicSession, type Repair, type SessionDetail, type Stats, type Visitor, type VisitorDetail } from '../shared/domain.ts';

let app: ReturnType<typeof createApp>;
/** Cookie de session, comme un navigateur : envoyé à chaque appel, mis à jour par les réponses. */
let cookie = '';

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};
  if (cookie) headers.Cookie = cookie;
  const response = await app.request(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]!.endsWith('=') ? '' : setCookie.split(';')[0]!;
  const text = await response.text();
  return { status: response.status, data: (text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) as T };
}

async function login(username: string, password: string) {
  cookie = '';
  return call<TeamUser>('POST', '/auth/login', { username, password });
}

async function newSession(perSlot = 1) {
  const { data } = await call<{ id: number }>('POST', '/sessions', { date: today(), startTime: '14:00', endTime: '15:00', place: 'Salle', slotMinutes: 30, perSlot });
  return data.id;
}

async function newVisitor() {
  const { data } = await call<{ id: number }>('POST', '/visitors', { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@exemple.fr' });
  return data.id;
}

const object = { category: 'petit-electromenager', object: 'Grille-pain', problem: 'Ne chauffe plus' };

beforeEach(async () => {
  const db = openDb(':memory:');
  createUser(db, { username: 'admin', name: 'Admin', password: 'mot-de-passe', role: 'admin' });
  app = createApp(db);
  await login('admin', 'mot-de-passe');
});

describe('connexion de l’équipe', () => {
  test('sans connexion, seules la réservation publique et la connexion répondent', async () => {
    cookie = '';
    assert.equal((await call('GET', '/stats')).status, 401);
    assert.equal((await call('GET', '/visitors')).status, 401);
    assert.equal((await call('GET', '/public/sessions')).status, 200);
    assert.deepEqual((await call<Me>('GET', '/auth/me')).data, { user: null, needsSetup: false });
  });

  test('mauvais mot de passe refusé, puis blocage après 5 essais', async () => {
    assert.equal((await login('admin', 'faux')).status, 401);
    assert.equal((await login('inconnu', 'faux')).status, 401);
    for (let i = 0; i < 4; i++) await login('admin', 'faux');
    assert.equal((await login('admin', 'mot-de-passe')).status, 429);
  });

  test('déconnexion : le cookie ne vaut plus rien', async () => {
    const before = cookie;
    assert.equal((await call('POST', '/auth/logout')).status, 204);
    cookie = before;
    assert.equal((await call('GET', '/stats')).status, 401);
  });

  test('un bénévole ne gère ni l’équipe ni les réglages', async () => {
    const created = await call<TeamUser>('POST', '/users', { username: 'fatou', name: 'Fatou', password: 'atelier2026', role: 'member' });
    assert.equal(created.status, 201);
    assert.equal((await login('fatou', 'atelier2026')).status, 200);
    assert.equal((await call('GET', '/stats')).status, 200);
    assert.equal((await call('GET', '/users')).status, 403);
    assert.equal((await call('PUT', '/settings', { reducedCents: 0, standardCents: 0, reducedTowns: [] })).status, 403);
  });

  test('désactiver un compte ferme ses connexions ; le dernier administrateur reste', async () => {
    const { data: fatou } = await call<TeamUser>('POST', '/users', { username: 'fatou', name: 'Fatou', password: 'atelier2026', role: 'member' });
    const adminCookie = cookie;
    await login('fatou', 'atelier2026');
    const fatouCookie = cookie;
    cookie = adminCookie;
    await call('PATCH', `/users/${fatou.id}`, { active: false });
    cookie = fatouCookie;
    assert.equal((await call('GET', '/stats')).status, 401);
    assert.equal((await login('fatou', 'atelier2026')).status, 403);

    cookie = adminCookie;
    const { data: me } = await call<Me>('GET', '/auth/me');
    assert.equal((await call('PATCH', `/users/${me.user!.id}`, { role: 'member' })).status, 409);
  });

  test('changer son mot de passe', async () => {
    assert.equal((await call('PUT', '/auth/password', { currentPassword: 'faux', newPassword: 'nouveau-mdp' })).status, 400);
    assert.equal((await call('PUT', '/auth/password', { currentPassword: 'mot-de-passe', newPassword: 'court' })).status, 400);
    assert.equal((await call('PUT', '/auth/password', { currentPassword: 'mot-de-passe', newPassword: 'nouveau-mdp' })).status, 204);
    assert.equal((await call('GET', '/stats')).status, 200, 'reste connecté');
    assert.equal((await login('admin', 'nouveau-mdp')).status, 200);
  });

  test('base vide : le premier compte se crée une seule fois, en administrateur', async () => {
    app = createApp(openDb(':memory:'));
    cookie = '';
    assert.equal((await call<Me>('GET', '/auth/me')).data.needsSetup, true);
    const { status, data } = await call<TeamUser>('POST', '/auth/setup', { username: 'chef', name: 'Chef', password: 'premier-compte' });
    assert.equal(status, 201);
    assert.equal(data.role, 'admin');
    assert.equal((await call('GET', '/stats')).status, 200);
    assert.equal((await call('POST', '/auth/setup', { username: 'autre', name: 'Autre', password: 'premier-compte' })).status, 409);
  });
});

describe('séances et créneaux', () => {
  test('les créneaux découpent la séance et un créneau plein est refusé', async () => {
    const sessionId = await newSession(1);
    const visitorId = await newVisitor();
    const { data: session } = await call<SessionDetail>('GET', `/sessions/${sessionId}`);
    assert.deepEqual(session.slots, ['14:00', '14:30']);
    assert.equal(session.capacity, 2);

    assert.equal((await call('POST', '/repairs', { ...object, visitorId, sessionId, slotTime: '14:00' })).status, 201);
    const full = await call<{ error: string }>('POST', '/repairs', { ...object, visitorId, sessionId, slotTime: '14:00' });
    assert.equal(full.status, 409);
    assert.match(full.data.error, /complet/);
    assert.equal((await call('POST', '/repairs', { ...object, visitorId, sessionId, slotTime: '16:00' })).status, 400);
  });

  test('une séance avec des rendez-vous ne se supprime pas', async () => {
    const sessionId = await newSession();
    await call('POST', '/repairs', { ...object, visitorId: await newVisitor(), sessionId, slotTime: '14:00' });
    assert.equal((await call('DELETE', `/sessions/${sessionId}`)).status, 409);
  });
});

describe('parcours d’une réparation', () => {
  test('rendez-vous → arrivé → en réparation → terminé, avec horodatage', async () => {
    const sessionId = await newSession();
    const visitorId = await newVisitor();
    const { data: created } = await call<Repair>('POST', '/repairs', { ...object, visitorId, sessionId, slotTime: '14:30' });
    assert.equal(created.status, 'booked');

    const { data: arrived } = await call<Repair>('PATCH', `/repairs/${created.id}`, { status: 'waiting' });
    assert.ok(arrived.arrivedAt);

    const refused = await call('PATCH', `/repairs/${created.id}`, { status: 'done' });
    assert.equal(refused.status, 400, 'terminer sans résultat est refusé');

    const { data: done } = await call<Repair>('PATCH', `/repairs/${created.id}`, { status: 'done', outcome: 'repaired', diagnosis: 'Fil ressoudé', weightKg: 1.2 });
    assert.equal(done.outcome, 'repaired');
    assert.ok(done.startedAt && done.endedAt);

    const { data: stats } = await call<Stats>('GET', '/stats');
    assert.equal(stats.repaired, 1);
    assert.equal(stats.kgSaved, 1.2);
  });

  test('un passage sans rendez-vous arrive directement en attente', async () => {
    const { data } = await call<Repair>('POST', '/repairs', { ...object, visitorId: await newVisitor(), sessionId: await newSession() });
    assert.equal(data.status, 'waiting');
    assert.equal(data.slotTime, null);
    assert.ok(data.arrivedAt);
  });
});

describe('réservation en ligne', () => {
  test('réserve un créneau, retrouve le visiteur existant et refuse sans la charte', async () => {
    const sessionId = await newSession(2);
    const visitorId = await newVisitor();
    const booking = { sessionId, slotTime: '14:00', firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@exemple.fr', ...object, charter: true };

    assert.equal((await call('POST', '/public/bookings', { ...booking, charter: false })).status, 400);
    assert.equal((await call('POST', '/public/bookings', { ...booking, email: '', phone: '' })).status, 400);

    const { status } = await call('POST', '/public/bookings', booking);
    assert.equal(status, 201);
    const { data: visitor } = await call<VisitorDetail>('GET', `/visitors/${visitorId}`);
    assert.equal(visitor.repairs.length, 1, 'rattaché au visiteur existant (même e-mail)');
    assert.ok(visitor.charterAcceptedAt);

    const { data: open } = await call<PublicSession[]>('GET', '/public/sessions');
    assert.deepEqual(open[0]!.slots, [
      { time: '14:00', free: 1 },
      { time: '14:30', free: 2 },
    ]);
  });
});

describe('visiteurs', () => {
  test('la suppression anonymise mais garde les réparations', async () => {
    const visitorId = await newVisitor();
    await call('POST', '/repairs', { ...object, visitorId });
    assert.equal((await call('DELETE', `/visitors/${visitorId}`)).status, 204);
    const { data } = await call<VisitorDetail>('GET', `/visitors/${visitorId}`);
    assert.equal(data.anonymized, true);
    assert.equal(data.email, null);
    assert.equal(data.repairs.length, 1);
  });

  test('recherche par nom ou téléphone', async () => {
    await call('POST', '/visitors', { firstName: 'Grace', lastName: 'Hopper', phone: '06 12 34 56 78' });
    await newVisitor();
    assert.equal((await call<unknown[]>('GET', '/visitors?q=hopp')).data.length, 1);
    assert.equal((await call<unknown[]>('GET', '/visitors?q=0612 34')).data.length, 1);
  });
});

describe('adhésion', () => {
  test('le tarif dépend de la commune, sans tenir compte des accents ni de « St »', () => {
    const settings = { reducedCents: 800, standardCents: 5000, reducedTowns: ['Saint-Jacques-de-la-Lande', 'Cesson-Sévigné'] };
    assert.equal(suggestedRate('st jacques de la lande', settings), 'reduced');
    assert.equal(suggestedRate('CESSON SEVIGNE', settings), 'reduced');
    assert.equal(suggestedRate('Pacé', settings), 'standard');
    assert.equal(suggestedRate('', settings), null);
  });

  test('réglée à la création, une seule par an, visible sur les réparations', async () => {
    const { data: visitor } = await call<Visitor>('POST', '/visitors', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Rennes',
      membership: { rate: 'reduced', amountCents: 800, paymentMethod: 'cash' },
    });
    assert.equal(visitor.membership?.amountCents, 800);
    assert.equal(visitor.membership?.year, new Date().getFullYear());

    const again = await call('POST', `/visitors/${visitor.id}/memberships`, { rate: 'standard', amountCents: 5000, paymentMethod: null });
    assert.equal(again.status, 409);

    const { data: repair } = await call<Repair>('POST', '/repairs', { ...object, visitorId: visitor.id });
    assert.equal(repair.visitorIsMember, true);
    const { data: stats } = await call<Stats>('GET', '/stats');
    assert.equal(stats.members, 1);
    assert.equal(stats.membershipsCents, 800);
  });

  test('un visiteur sans adhésion est signalé, puis la règle à l’accueil', async () => {
    const visitorId = await newVisitor();
    const { data: repair } = await call<Repair>('POST', '/repairs', { ...object, visitorId });
    assert.equal(repair.visitorIsMember, false);
    assert.equal((await call('POST', `/visitors/${visitorId}/memberships`, { rate: 'standard', amountCents: 5000, paymentMethod: 'check' })).status, 201);
    assert.equal((await call<Repair>('GET', `/repairs/${repair.id}`)).data.visitorIsMember, true);
    const { data: detail } = await call<VisitorDetail>('GET', `/visitors/${visitorId}`);
    assert.equal(detail.memberships.length, 1);
  });

  test('les réglages se modifient et sont publics pour la réservation', async () => {
    const { data } = await call<MembershipSettings>('PUT', '/settings', { reducedCents: 1000, standardCents: 4000, reducedTowns: ['Rennes', 'rennes', 'Bruz'] });
    assert.deepEqual(data.reducedTowns, ['Bruz', 'Rennes']);
    assert.equal((await call<MembershipSettings>('GET', '/public/membership')).data.reducedCents, 1000);
  });
});

test('les données d’exemple se chargent et donnent des statistiques', async () => {
  const db = openDb(':memory:');
  seedDemo(db);
  app = createApp(db);
  assert.equal((await login('test', 'test')).status, 200, 'compte de test');
  const { data: stats } = await call<Stats>('GET', '/stats');
  assert.ok(stats.finished > 30);
  assert.ok(stats.repaired > stats.notRepairable);
  assert.equal(stats.nextSession?.date, today());
  const csv = new Uint8Array(await (await app.request('/api/repairs/export.csv', { headers: { Cookie: cookie } })).arrayBuffer());
  assert.deepEqual([...csv.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM pour Excel');
  assert.match(new TextDecoder().decode(csv), /^N°;Séance;Catégorie/);
});
