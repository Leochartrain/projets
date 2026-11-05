import Dexie, { type EntityTable } from "dexie";
import { CATALOG } from "./catalog";
import type { Backup, Exercise, Measurement, Session, Template } from "./types";

export const db = new Dexie("fonte") as Dexie & {
  exercises: EntityTable<Exercise, "id">;
  templates: EntityTable<Template, "id">;
  sessions: EntityTable<Session, "id">;
  measurements: EntityTable<Measurement, "id">;
};

db.version(1).stores({
  exercises: "id, name, muscle",
  templates: "id, updatedAt",
  sessions: "id, startedAt, endedAt",
  measurements: "id, date",
});

db.on("populate", (tx) => {
  void tx.table("exercises").bulkAdd(CATALOG);
});

export const newId = () => crypto.randomUUID();

export async function exportBackup(): Promise<Backup> {
  return {
    app: "fonte",
    version: 1,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    sessions: await db.sessions.toArray(),
    measurements: await db.measurements.toArray(),
  };
}

/** Remplace toutes les données, ou rien si une écriture échoue (transaction). */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction("rw", [db.exercises, db.templates, db.sessions, db.measurements], async () => {
    await Promise.all([
      db.exercises.clear(),
      db.templates.clear(),
      db.sessions.clear(),
      db.measurements.clear(),
    ]);
    await db.exercises.bulkAdd(backup.exercises);
    await db.templates.bulkAdd(backup.templates);
    await db.sessions.bulkAdd(backup.sessions);
    await db.measurements.bulkAdd(backup.measurements);
  });
}
