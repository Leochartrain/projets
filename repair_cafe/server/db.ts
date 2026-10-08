import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

const SCHEMA = `
pragma foreign_keys = on;
pragma journal_mode = wal;

create table if not exists volunteers (
  id integer primary key,
  name text not null,
  phone text,
  email text,
  skills text not null default '[]',
  active integer not null default 1,
  created_at text not null default ${NOW}
);

create table if not exists visitors (
  id integer primary key,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  postal_code text,
  notes text,
  charter_accepted_at text,
  anonymized integer not null default 0,
  created_at text not null default ${NOW}
);

create table if not exists sessions (
  id integer primary key,
  date text not null,
  start_time text not null,
  end_time text not null,
  place text not null,
  slot_minutes integer not null default 30,
  per_slot integer not null default 3,
  notes text,
  created_at text not null default ${NOW}
);

create table if not exists repairs (
  id integer primary key,
  visitor_id integer not null references visitors(id),
  session_id integer references sessions(id) on delete set null,
  slot_time text,
  category text not null,
  object text not null,
  brand text,
  model text,
  age_years integer,
  problem text not null,
  weight_kg real,
  status text not null default 'booked',
  volunteer_id integer references volunteers(id) on delete set null,
  outcome text,
  diagnosis text,
  notes text,
  donation_cents integer,
  arrived_at text,
  started_at text,
  ended_at text,
  created_at text not null default ${NOW}
);

create table if not exists memberships (
  id integer primary key,
  visitor_id integer not null references visitors(id),
  year integer not null,
  rate text not null,
  amount_cents integer not null,
  payment_method text,
  paid_at text not null default ${NOW},
  unique (visitor_id, year)
);

create table if not exists users (
  id integer primary key,
  username text not null unique collate nocase,
  name text not null,
  password_hash text not null,
  role text not null default 'member',
  active integer not null default 1,
  last_login_at text,
  created_at text not null default ${NOW}
);

-- Connexions ouvertes (on garde l'empreinte du jeton, jamais le jeton lui-même).
create table if not exists auth_sessions (
  token_hash text primary key,
  user_id integer not null references users(id) on delete cascade,
  expires_at text not null,
  created_at text not null default ${NOW}
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create index if not exists repairs_session on repairs(session_id);
create index if not exists repairs_visitor on repairs(visitor_id);
create index if not exists repairs_volunteer on repairs(volunteer_id);
`;

/** Ouvre (ou crée) la base. `:memory:` pour les tests. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Colonnes ajoutées après la première version : on les crée sur les bases existantes. */
function migrate(db: Db): void {
  const has = (table: string, column: string) => (db.prepare(`select name from pragma_table_info('${table}')`).all() as { name: string }[]).some((c) => c.name === column);
  if (!has('visitors', 'city')) db.exec('alter table visitors add column city text');
}

/** Exécute `fn` dans une transaction : tout ou rien. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('begin');
  try {
    const result = fn();
    db.exec('commit');
    return result;
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}
