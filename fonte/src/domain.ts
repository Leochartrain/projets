import type { Backup, Exercise, Muscle, Session, WorkSet } from "./types";

const DAY = 86_400_000;

/** 1RM estimé (Epley). Au-delà de 12 répétitions, l'estimation n'est plus fiable. */
export function estimated1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0 || reps > 12) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function countsAsWork(set: WorkSet): boolean {
  return set.done && !set.warmup && (set.reps ?? 0) > 0;
}

export function setVolume(set: WorkSet): number {
  return countsAsWork(set) ? (set.weight ?? 0) * (set.reps ?? 0) : 0;
}

export function sessionVolume(session: Session): number {
  return session.items.reduce(
    (sum, item) => sum + item.sets.reduce((s, set) => s + setVolume(set), 0),
    0,
  );
}

export function sessionWorkSets(session: Session): number {
  return session.items.reduce((sum, item) => sum + item.sets.filter(countsAsWork).length, 0);
}

/** Lundi 0 h (heure locale) de la semaine contenant `time`. */
export function startOfWeek(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function addWeeks(weekStart: number, n: number): number {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + n * 7);
  return d.getTime();
}

export function finished(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.endedAt !== null).sort((a, b) => a.startedAt - b.startedAt);
}

export function weeklyVolume(sessions: Session[], weeks: number, now: number) {
  const current = startOfWeek(now);
  const rows = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addWeeks(current, i - weeks + 1),
    volume: 0,
    count: 0,
  }));
  for (const s of finished(sessions)) {
    const row = rows.find((r) => r.weekStart === startOfWeek(s.startedAt));
    if (row) {
      row.volume += sessionVolume(s);
      row.count += 1;
    }
  }
  return rows;
}

/** Semaines consécutives avec au moins une séance. La semaine en cours ne casse pas la série. */
export function weekStreak(sessions: Session[], now: number): number {
  const weeks = new Set(finished(sessions).map((s) => startOfWeek(s.startedAt)));
  let cursor = startOfWeek(now);
  if (!weeks.has(cursor)) cursor = addWeeks(cursor, -1);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

export function setsByMuscle(
  sessions: Session[],
  exercises: Exercise[],
  now: number,
  days = 7,
): { muscle: Muscle; sets: number }[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = new Map<Muscle, number>();
  const since = now - days * DAY;
  for (const s of finished(sessions)) {
    if (s.startedAt < since) continue;
    for (const item of s.items) {
      const muscle = byId.get(item.exerciseId)?.muscle;
      if (!muscle) continue;
      const n = item.sets.filter(countsAsWork).length;
      if (n) totals.set(muscle, (totals.get(muscle) ?? 0) + n);
    }
  }
  return [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export interface ExercisePoint {
  sessionId: string;
  date: number;
  topWeight: number;
  best1RM: number | null;
  volume: number;
  sets: WorkSet[];
}

export function exerciseHistory(sessions: Session[], exerciseId: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const s of finished(sessions)) {
    const sets = s.items
      .filter((i) => i.exerciseId === exerciseId)
      .flatMap((i) => i.sets)
      .filter(countsAsWork);
    if (!sets.length) continue;
    const e1rms = sets
      .map((x) => estimated1RM(x.weight, x.reps))
      .filter((x): x is number => x !== null);
    points.push({
      sessionId: s.id,
      date: s.startedAt,
      topWeight: Math.max(...sets.map((x) => x.weight ?? 0)),
      best1RM: e1rms.length ? Math.max(...e1rms) : null,
      volume: sets.reduce((sum, x) => sum + setVolume(x), 0),
      sets,
    });
  }
  return points;
}

/** Dernière performance sur cet exercice avant `before` (échauffements compris, pour pré-remplir). */
export function previousSets(sessions: Session[], exerciseId: string, before: number): WorkSet[] {
  const past = finished(sessions)
    .filter((s) => s.startedAt < before)
    .reverse();
  for (const s of past) {
    const sets = s.items
      .filter((i) => i.exerciseId === exerciseId)
      .flatMap((i) => i.sets)
      .filter((x) => x.done);
    if (sets.length) return sets;
  }
  return [];
}

export interface PersonalRecord {
  exerciseId: string;
  kind: "weight" | "e1rm";
  value: number;
  previous: number;
}

/**
 * Records battus par une séance par rapport aux séances antérieures.
 * Pas de record sur la toute première fois : il n'y a rien à battre.
 */
export function sessionRecords(session: Session, sessions: Session[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const before = finished(sessions).filter(
    (s) => s.startedAt < session.startedAt && s.id !== session.id,
  );
  const ids = [...new Set(session.items.map((i) => i.exerciseId))];
  for (const exerciseId of ids) {
    const history = exerciseHistory(before, exerciseId);
    if (!history.length) continue;
    const closed = { ...session, endedAt: session.endedAt ?? session.startedAt };
    const current = exerciseHistory([closed], exerciseId)[0];
    if (!current) continue;
    const oldWeight = Math.max(...history.map((h) => h.topWeight));
    if (current.topWeight > oldWeight && oldWeight > 0) {
      records.push({ exerciseId, kind: "weight", value: current.topWeight, previous: oldWeight });
    }
    const old1RM = Math.max(0, ...history.map((h) => h.best1RM ?? 0));
    if (current.best1RM !== null && old1RM > 0 && current.best1RM > old1RM) {
      records.push({ exerciseId, kind: "e1rm", value: current.best1RM, previous: old1RM });
    }
  }
  return records;
}

/** Meilleure charge et meilleur 1RM estimé de chaque exercice, du plus récent au plus ancien. */
export function allBests(sessions: Session[], exerciseIds: string[]) {
  return exerciseIds
    .map((exerciseId) => {
      const h = exerciseHistory(sessions, exerciseId);
      if (!h.length) return null;
      return {
        exerciseId,
        topWeight: Math.max(...h.map((p) => p.topWeight)),
        best1RM: h.some((p) => p.best1RM !== null)
          ? Math.max(...h.map((p) => p.best1RM ?? 0))
          : null,
        lastDate: h[h.length - 1].date,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.lastDate - a.lastDate);
}

/** Vérifie une sauvegarde avant tout écrasement. Lève une erreur en français si elle est invalide. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde lisible.");
  }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== "fonte") throw new Error("Ce fichier n'est pas une sauvegarde Fonte.");
  if (b.version !== 1) throw new Error("Cette sauvegarde vient d'une version inconnue de Fonte.");
  for (const key of ["exercises", "templates", "sessions", "measurements"] as const) {
    if (!Array.isArray(b[key])) throw new Error("Cette sauvegarde est incomplète.");
  }
  return b as Backup;
}

export function formatKg(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
}

export function formatVolume(n: number): string {
  if (n >= 10_000) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n / 1000)} t`;
  }
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} kg`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(time: number): string {
  return new Date(time).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatShortDate(time: number): string {
  return new Date(time).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Accepte la virgule française. Vide ou invalide = null. */
export function parseNumber(text: string): number | null {
  const n = Number(text.replace(",", ".").trim());
  return text.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
}
