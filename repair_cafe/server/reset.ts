// Réinitialise la base : `npm run db:demo` (données d'exemple) ou `npm run db:vide` (base vide).
// Arrêter le serveur avant.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from './db.ts';
import { seedDemo } from './seed.ts';

const dbPath = process.env.DB_PATH ?? join(import.meta.dirname, '..', 'data', 'repair-cafe.db');
for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });

const db = openDb(dbPath);
if (process.argv.includes('--demo')) seedDemo(db);
db.close();
console.log(process.argv.includes('--demo') ? 'Base réinitialisée avec les données d’exemple.' : 'Base vidée.');
