import { describe, expect, it } from "vitest";
import {
  estimated1RM, exerciseHistory, formatDuration, parseBackup, parseNumber, previousSets,
  sessionRecords, sessionVolume, setsByMuscle, startOfWeek, weekStreak, weeklyVolume,
} from "./domain";
import type { Exercise, Session, WorkSet } from "./types";

const set = (weight: number, reps: number, extra: Partial<WorkSet> = {}): WorkSet => ({
  id: Math.random().toString(),
  weight,
  reps,
  rpe: null,
  warmup: false,
  done: true,
  ...extra,
});

const session = (
  id: string,
  date: string,
  sets: WorkSet[],
  exerciseId = "dc",
  ended = true,
): Session => {
  const t = new Date(date).getTime();
  return {
    id,
    name: id,
    templateId: null,
    startedAt: t,
    endedAt: ended ? t + 3_600_000 : null,
    note: "",
    items: [{ id: `${id}-i`, exerciseId, sets }],
  };
};

describe("1RM estimé", () => {
  it("vaut la charge à 1 répétition", () => expect(estimated1RM(100, 1)).toBe(100));
  it("suit Epley", () => expect(estimated1RM(100, 10)).toBeCloseTo(133.33, 1));
  it("refuse au-delà de 12 répétitions ou sans charge", () => {
    expect(estimated1RM(50, 13)).toBeNull();
    expect(estimated1RM(0, 5)).toBeNull();
    expect(estimated1RM(null, 5)).toBeNull();
  });
});

describe("volume", () => {
  it("ignore échauffements et séries non validées", () => {
    const s = session("a", "2026-11-02T10:00", [
      set(100, 5),
      set(40, 10, { warmup: true }),
      set(100, 5, { done: false }),
    ]);
    expect(sessionVolume(s)).toBe(500);
  });

  it("regroupe du lundi au dimanche et ignore la séance en cours", () => {
    const now = new Date("2026-11-05T12:00").getTime();
    const rows = weeklyVolume(
      [
        session("dim", "2026-11-01T10:00", [set(10, 10)]),
        session("lun", "2026-11-02T10:00", [set(20, 10)]),
        session("cours", "2026-11-03T10:00", [set(99, 10)], "dc", false),
      ],
      2,
      now,
    );
    expect(rows.map((r) => r.volume)).toEqual([100, 200]);
  });
});

describe("semaines d'affilée", () => {
  const now = new Date("2026-11-05T12:00").getTime();
  it("ne casse pas si la semaine en cours n'a pas encore de séance", () => {
    expect(
      weekStreak([session("a", "2026-10-27T10:00", []), session("b", "2026-10-20T10:00", [])], now),
    ).toBe(2);
  });
  it("s'arrête au premier trou", () => {
    expect(
      weekStreak([session("a", "2026-11-03T10:00", []), session("b", "2026-10-20T10:00", [])], now),
    ).toBe(1);
  });
  it("vaut 0 sans séance récente", () => {
    expect(weekStreak([session("a", "2026-09-01T10:00", [])], now)).toBe(0);
  });
  it("commence bien le lundi", () => {
    expect(new Date(startOfWeek(new Date("2026-11-08T23:00").getTime())).getDate()).toBe(2);
  });
});

describe("records", () => {
  const old = session("old", "2026-10-01T10:00", [set(100, 5)]);
  it("détecte une charge et un 1RM battus", () => {
    const kinds = sessionRecords(session("new", "2026-10-08T10:00", [set(105, 5)]), [old]);
    expect(kinds.map((r) => r.kind)).toEqual(["weight", "e1rm"]);
  });
  it("détecte un 1RM battu à charge égale", () => {
    const kinds = sessionRecords(session("new", "2026-10-08T10:00", [set(100, 6)]), [old]);
    expect(kinds.map((r) => r.kind)).toEqual(["e1rm"]);
  });
  it("ne compte pas la première fois ni l'égalité", () => {
    expect(sessionRecords(old, [old])).toEqual([]);
    expect(sessionRecords(session("new", "2026-10-08T10:00", [set(100, 5)]), [old])).toEqual([]);
  });
  it("ne se compare pas à une séance plus récente", () => {
    const later = session("later", "2026-10-20T10:00", [set(200, 5)]);
    const records = sessionRecords(session("new", "2026-10-08T10:00", [set(105, 5)]), [old, later]);
    expect(records).toHaveLength(2);
  });
});

describe("historique", () => {
  it("reprend la dernière performance avant la date donnée", () => {
    const a = session("a", "2026-10-01T10:00", [set(80, 8)]);
    const b = session("b", "2026-10-08T10:00", [set(85, 8)]);
    expect(previousSets([a, b], "dc", new Date("2026-10-09").getTime())[0].weight).toBe(85);
    expect(previousSets([a, b], "dc", new Date("2026-10-05").getTime())[0].weight).toBe(80);
    expect(previousSets([a, b], "autre", Date.now())).toEqual([]);
  });
  it("donne les points d'un exercice dans l'ordre", () => {
    const h = exerciseHistory(
      [
        session("b", "2026-10-08T10:00", [set(85, 8)]),
        session("a", "2026-10-01T10:00", [set(80, 8), set(70, 8)]),
      ],
      "dc",
    );
    expect(h.map((p) => p.topWeight)).toEqual([80, 85]);
    expect(h[0].volume).toBe(80 * 8 + 70 * 8);
  });
  it("compte les séries par muscle sur 7 jours", () => {
    const ex: Exercise[] = [
      { id: "dc", name: "DC", muscle: "Pectoraux", equipment: "Barre", custom: false },
    ];
    const now = new Date("2026-11-05T12:00").getTime();
    const rows = setsByMuscle(
      [
        session("a", "2026-11-04T10:00", [set(80, 8), set(80, 8)]),
        session("b", "2026-10-01T10:00", [set(80, 8)]),
      ],
      ex,
      now,
    );
    expect(rows).toEqual([{ muscle: "Pectoraux", sets: 2 }]);
  });
});

describe("saisie et sauvegarde", () => {
  it("accepte la virgule, refuse le reste", () => {
    expect(parseNumber("82,5")).toBe(82.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("-3")).toBeNull();
  });
  it("affiche les durées", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
  it("refuse un fichier qui n'est pas une sauvegarde complète", () => {
    expect(() => parseBackup("pas du json")).toThrow(/lisible/);
    expect(() => parseBackup('{"app":"autre"}')).toThrow(/Fonte/);
    expect(() => parseBackup('{"app":"fonte","version":2}')).toThrow(/version/);
    expect(() => parseBackup('{"app":"fonte","version":1,"exercises":[]}')).toThrow(/incomplète/);
    const ok = { app: "fonte", version: 1, exercises: [], templates: [], sessions: [], measurements: [] };
    expect(parseBackup(JSON.stringify(ok)).version).toBe(1);
  });
});
