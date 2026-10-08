// Serveur : l'API sous /api et, après `npm run build`, l'interface compilée (dossier dist/).
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Hono } from 'hono';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { seedDemo } from './seed.ts';

const root = join(import.meta.dirname, '..');
const dbPath = process.env.DB_PATH ?? join(root, 'data', 'repair-cafe.db');
const port = Number(process.env.PORT ?? 3001);

mkdirSync(dirname(dbPath), { recursive: true });
const firstRun = !existsSync(dbPath);
const db = openDb(dbPath);
if (firstRun) {
  seedDemo(db);
  console.log('Base créée avec des données d’exemple (npm run db:vide pour repartir de zéro).');
}

const app = new Hono();
app.route('/', createApp(db));

const dist = join(root, 'dist');
if (existsSync(dist)) {
  const rootDir = relative(process.cwd(), dist) || '.';
  app.use('/*', serveStatic({ root: rootDir }));
  // Les adresses de l'appli (/visiteurs/12…) renvoient la page, le routeur fait le reste.
  app.get('*', serveStatic({ path: join(rootDir, 'index.html') }));
}

serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`API prête sur http://localhost:${port}/api`);
  if (existsSync(dist)) console.log(`Appli sur http://localhost:${port}/`);
});
