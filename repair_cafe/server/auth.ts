// Connexion de l'équipe : identifiant + mot de passe, puis un cookie de session.
// Les mots de passe sont hachés avec scrypt, les jetons de session ne sont stockés qu'en empreinte SHA-256.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { MIN_PASSWORD, ROLES, type Me, type Role, type TeamUser } from '../shared/domain.ts';
import type { Db } from './db.ts';

export type AuthEnv = { Variables: { user: TeamUser } };

const COOKIE = 'rc_session';
const SESSION_DAYS = 30;

// --- Mots de passe ------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'base64'), expected.length), expected);
}

/** Pour comparer le temps de réponse d'un identifiant inconnu à celui d'un mauvais mot de passe. */
const DUMMY_HASH = hashPassword(randomBytes(8).toString('hex'));

// --- Comptes ------------------------------------------------------------------

const USER_SELECT = `select id, username, name, role, active, last_login_at as lastLoginAt from users`;
const toUser = (row: Record<string, unknown>): TeamUser => ({ ...(row as unknown as TeamUser), active: Boolean(row.active) });

export function createUser(db: Db, input: { username: string; name: string; password: string; role: Role }): number {
  return Number(
    db.prepare('insert into users (username, name, password_hash, role) values (?, ?, ?, ?)').run(input.username, input.name, hashPassword(input.password), input.role).lastInsertRowid,
  );
}

function getUser(db: Db, userId: number): TeamUser {
  const row = db.prepare(`${USER_SELECT} where id = ?`).get(userId);
  if (!row) throw new HTTPException(404, { message: 'Compte introuvable.' });
  return toUser(row);
}

const hasUsers = (db: Db) => Boolean(db.prepare('select 1 from users limit 1').get());

// --- Sessions -----------------------------------------------------------------

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function openSession(db: Db, c: Context, userId: number): void {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare('insert into auth_sessions (token_hash, user_id, expires_at) values (?, ?, ?)').run(tokenHash(token), userId, expires.toISOString());
  db.prepare('update users set last_login_at = ? where id = ?').run(new Date().toISOString(), userId);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: new URL(c.req.url).protocol === 'https:',
    expires,
  });
}

function currentUser(db: Db, c: Context): TeamUser | null {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = db
    .prepare(
      `select u.id, u.username, u.name, u.role, u.active, u.last_login_at as lastLoginAt
       from auth_sessions s join users u on u.id = s.user_id
       where s.token_hash = ? and s.expires_at > ? and u.active = 1`,
    )
    .get(tokenHash(token), new Date().toISOString());
  return row ? toUser(row) : null;
}

// --- Limite des essais --------------------------------------------------------

/** 5 erreurs pour un même identifiant → 5 minutes d'attente. En mémoire : remis à zéro au redémarrage. */
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;

function loginThrottle() {
  const failures = new Map<string, { count: number; until: number }>();
  return {
    check(username: string) {
      const entry = failures.get(username.toLowerCase());
      if (entry && entry.count >= MAX_FAILURES && entry.until > Date.now()) {
        const minutes = Math.ceil((entry.until - Date.now()) / 60_000);
        throw new HTTPException(429, { message: `Trop d'essais. Réessaie dans ${minutes} minute${minutes > 1 ? 's' : ''}.` });
      }
    },
    fail(username: string) {
      const key = username.toLowerCase();
      const entry = failures.get(key);
      const count = entry && entry.until > Date.now() ? entry.count + 1 : 1;
      failures.set(key, { count, until: Date.now() + LOCK_MS });
    },
    reset(username: string) {
      failures.delete(username.toLowerCase());
    },
  };
}

// --- Routes et garde ----------------------------------------------------------

const password = z.string().min(MIN_PASSWORD, `au moins ${MIN_PASSWORD} caractères`).max(200);
const username = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, 'lettres, chiffres, point, tiret ou tiret bas, sans espace');

async function json(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0]!;
  const labels: Record<string, string> = { username: 'Identifiant', password: 'Mot de passe', newPassword: 'Nouveau mot de passe', name: 'Nom' };
  const field = issue.path.join('.');
  throw new HTTPException(400, { message: field ? `${labels[field] ?? field} : ${issue.message}` : issue.message });
}

/** Tout /api demande d'être connecté, sauf la connexion elle-même et la réservation publique. */
export function requireAuth(db: Db): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/public/') || path.startsWith('/api/auth/')) return next();
    const user = currentUser(db, c);
    if (!user) throw new HTTPException(401, { message: 'Connecte-toi pour continuer.' });
    c.set('user', user);
    return next();
  };
}

export function requireAdmin(c: Context<AuthEnv>): void {
  if (c.get('user').role !== 'admin') throw new HTTPException(403, { message: 'Réservé aux administrateurs.' });
}

export function authRoutes(app: Hono<AuthEnv>, db: Db): void {
  const throttle = loginThrottle();

  app.get('/auth/me', (c) => {
    const me: Me = { user: currentUser(db, c), needsSetup: !hasUsers(db) };
    return c.json(me);
  });

  app.post('/auth/login', async (c) => {
    const input = parse(z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) }), await json(c));
    throttle.check(input.username);
    const row = db.prepare('select id, password_hash as hash, active from users where username = ?').get(input.username) as { id: number; hash: string; active: number } | undefined;
    const ok = verifyPassword(input.password, row?.hash ?? DUMMY_HASH) && row !== undefined;
    if (!ok || !row) {
      throttle.fail(input.username);
      throw new HTTPException(401, { message: 'Identifiant ou mot de passe incorrect.' });
    }
    if (!row.active) throw new HTTPException(403, { message: 'Ce compte est désactivé. Demande à un administrateur.' });
    throttle.reset(input.username);
    openSession(db, c, row.id);
    return c.json(getUser(db, row.id));
  });

  app.post('/auth/logout', (c) => {
    const token = getCookie(c, COOKIE);
    if (token) db.prepare('delete from auth_sessions where token_hash = ?').run(tokenHash(token));
    deleteCookie(c, COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  /** Premier lancement sur une base vide : le premier compte créé est administrateur. */
  app.post('/auth/setup', async (c) => {
    if (hasUsers(db)) throw new HTTPException(409, { message: 'Un compte existe déjà : connecte-toi.' });
    const input = parse(z.object({ username, name: z.string().trim().min(1).max(80), password }), await json(c));
    const userId = createUser(db, { ...input, role: 'admin' });
    openSession(db, c, userId);
    return c.json(getUser(db, userId), 201);
  });

  /** Changer son propre mot de passe : les autres connexions de ce compte sont fermées. */
  app.put('/auth/password', async (c) => {
    const user = currentUser(db, c);
    if (!user) throw new HTTPException(401, { message: 'Connecte-toi pour continuer.' });
    const input = parse(z.object({ currentPassword: z.string().max(200), newPassword: password }), await json(c));
    const { hash } = db.prepare('select password_hash as hash from users where id = ?').get(user.id) as { hash: string };
    if (!verifyPassword(input.currentPassword, hash)) throw new HTTPException(400, { message: 'Le mot de passe actuel est incorrect.' });
    db.prepare('update users set password_hash = ? where id = ?').run(hashPassword(input.newPassword), user.id);
    db.prepare('delete from auth_sessions where user_id = ?').run(user.id);
    openSession(db, c, user.id);
    return c.body(null, 204);
  });

  // Gestion de l'équipe (administrateurs)

  app.get('/users', (c) => {
    requireAdmin(c);
    return c.json(db.prepare(`${USER_SELECT} order by active desc, name collate nocase`).all().map(toUser));
  });

  app.post('/users', async (c) => {
    requireAdmin(c);
    const input = parse(z.object({ username, name: z.string().trim().min(1).max(80), password, role: z.enum(ROLES) }), await json(c));
    if (db.prepare('select 1 from users where username = ?').get(input.username)) throw new HTTPException(409, { message: `L'identifiant « ${input.username} » est déjà pris.` });
    return c.json(getUser(db, createUser(db, input)), 201);
  });

  app.patch('/users/:id', async (c) => {
    requireAdmin(c);
    const target = getUser(db, Number(c.req.param('id')));
    const input = parse(
      z.object({ name: z.string().trim().min(1).max(80).optional(), role: z.enum(ROLES).optional(), active: z.boolean().optional(), password: password.optional() }),
      await json(c),
    );
    const me = c.get('user');
    // Il faut toujours au moins un administrateur actif, sinon plus personne ne gère l'équipe.
    const losesAdmin = target.role === 'admin' && target.active && (input.role === 'member' || input.active === false);
    if (losesAdmin) {
      const { n } = db.prepare(`select count(*) as n from users where role = 'admin' and active = 1`).get() as { n: number };
      if (n <= 1) throw new HTTPException(409, { message: 'Il faut garder au moins un administrateur actif.' });
    }
    if (target.id === me.id && input.active === false) throw new HTTPException(409, { message: 'Tu ne peux pas désactiver ton propre compte.' });
    if (input.name !== undefined) db.prepare('update users set name = ? where id = ?').run(input.name, target.id);
    if (input.role !== undefined) db.prepare('update users set role = ? where id = ?').run(input.role, target.id);
    if (input.active !== undefined) db.prepare('update users set active = ? where id = ?').run(Number(input.active), target.id);
    if (input.password !== undefined) db.prepare('update users set password_hash = ? where id = ?').run(hashPassword(input.password), target.id);
    // Compte désactivé ou mot de passe réinitialisé : ses connexions en cours sont fermées.
    if (input.active === false || input.password !== undefined) db.prepare('delete from auth_sessions where user_id = ?').run(target.id);
    return c.json(getUser(db, target.id));
  });
}
