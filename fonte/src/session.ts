import { previousSets } from "./domain";
import type { Session, SessionItem, Template, WorkSet } from "./types";

export const emptySet = (id: string, extra: Partial<WorkSet> = {}): WorkSet => ({
  id,
  weight: null,
  reps: null,
  rpe: null,
  warmup: false,
  done: false,
  ...extra,
});

/** Crée un exercice de séance, pré-rempli avec les charges de la dernière fois. */
export function buildItem(
  exerciseId: string,
  setCount: number,
  targetReps: number | null,
  history: Session[],
  now: number,
  newId: () => string,
): SessionItem {
  const previous = previousSets(history, exerciseId, now).filter((s) => !s.warmup);
  return {
    id: newId(),
    exerciseId,
    sets: Array.from({ length: setCount }, (_, i) => {
      const last = previous[Math.min(i, previous.length - 1)];
      return emptySet(newId(), {
        weight: last?.weight ?? null,
        reps: targetReps ?? last?.reps ?? null,
      });
    }),
  };
}

export function buildSession(
  template: Template | null,
  history: Session[],
  now: number,
  newId: () => string,
): Session {
  return {
    id: newId(),
    name: template?.name ?? "Séance libre",
    templateId: template?.id ?? null,
    startedAt: now,
    endedAt: null,
    note: "",
    items: (template?.items ?? []).map((t) =>
      buildItem(t.exerciseId, t.sets, t.reps, history, now, newId),
    ),
  };
}

/** Termine une séance : seules les séries validées sont conservées. */
export function finalizeSession(session: Session, now: number): Session {
  return {
    ...session,
    endedAt: now,
    items: session.items
      .map((item) => ({ ...item, sets: item.sets.filter((s) => s.done) }))
      .filter((item) => item.sets.length > 0),
  };
}

export function doneSetCount(session: Session): number {
  return session.items.reduce((n, item) => n + item.sets.filter((s) => s.done).length, 0);
}

/** Crée un modèle à partir d'une séance terminée. */
export function templateFromSession(session: Session, id: string, now: number): Template {
  return {
    id,
    name: session.name,
    updatedAt: now,
    items: session.items.map((item) => {
      const work = item.sets.filter((s) => !s.warmup);
      return {
        exerciseId: item.exerciseId,
        sets: Math.max(1, work.length),
        reps: work[0]?.reps ?? 10,
      };
    }),
  };
}
