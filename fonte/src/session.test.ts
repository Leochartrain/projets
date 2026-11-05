import { describe, expect, it } from "vitest";
import { buildSession, finalizeSession, templateFromSession } from "./session";
import type { Session, Template, WorkSet } from "./types";

let n = 0;
const id = () => `id${n++}`;
const set = (weight: number, reps: number, extra: Partial<WorkSet> = {}): WorkSet => ({
  id: id(),
  weight,
  reps,
  rpe: null,
  warmup: false,
  done: true,
  ...extra,
});

const past: Session = {
  id: "p",
  name: "P",
  templateId: null,
  startedAt: 1000,
  endedAt: 2000,
  note: "",
  items: [{ id: "i", exerciseId: "dc", sets: [set(40, 10, { warmup: true }), set(80, 8), set(75, 8)] }],
};
const template: Template = {
  id: "t",
  name: "Haut du corps",
  updatedAt: 0,
  items: [
    { exerciseId: "dc", sets: 3, reps: 10 },
    { exerciseId: "nouveau", sets: 2, reps: 12 },
  ],
};

describe("démarrer une séance", () => {
  const s = buildSession(template, [past], 5000, id);
  it("reprend les charges de travail, sans les échauffements", () => {
    expect(s.items[0].sets.map((x) => x.weight)).toEqual([80, 75, 75]);
  });
  it("garde les répétitions visées et ne valide rien", () => {
    expect(s.items[0].sets.every((x) => x.reps === 10 && !x.done)).toBe(true);
  });
  it("laisse vide un exercice jamais fait", () => {
    expect(s.items[1].sets.map((x) => x.weight)).toEqual([null, null]);
  });
  it("une séance libre commence vide", () => {
    const free = buildSession(null, [past], 5000, id);
    expect(free.name).toBe("Séance libre");
    expect(free.items).toEqual([]);
  });
});

describe("terminer une séance", () => {
  it("retire les séries non validées et les exercices vides", () => {
    const s = finalizeSession(
      {
        ...past,
        endedAt: null,
        items: [
          { id: "a", exerciseId: "dc", sets: [set(80, 8), set(80, 8, { done: false })] },
          { id: "b", exerciseId: "squat", sets: [set(100, 5, { done: false })] },
        ],
      },
      9000,
    );
    expect(s.endedAt).toBe(9000);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].sets).toHaveLength(1);
  });
});

describe("créer un modèle depuis une séance", () => {
  it("compte les séries de travail seulement", () => {
    const t = templateFromSession(past, "n", 1);
    expect(t.items).toEqual([{ exerciseId: "dc", sets: 2, reps: 8 }]);
  });
});
