import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
import { db, newId } from "./db";
import { EQUIPMENTS, MUSCLES, type Equipment, type Exercise, type Muscle, type Session, type Template } from "./types";

export interface Data {
  sessions: Session[];
  exercises: Exercise[];
  templates: Template[];
  active: Session | null;
  exerciseById: Map<string, Exercise>;
}

export function useData(): Data | null {
  const data = useLiveQuery(async () => {
    const [sessions, exercises, templates] = await Promise.all([
      db.sessions.toArray(),
      db.exercises.toArray(),
      db.templates.orderBy("updatedAt").reverse().toArray(),
    ]);
    return { sessions, exercises, templates };
  });
  return useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      active: data.sessions.find((s) => s.endedAt === null) ?? null,
      exerciseById: new Map(data.exercises.map((e) => [e.id, e])),
    };
  }, [data]);
}

export function exerciseName(data: Data, id: string): string {
  return data.exerciseById.get(id)?.name ?? "Exercice supprimé";
}

export function go(path: string): void {
  window.location.hash = path;
}

export function Header(props: { title: string; back?: boolean; action?: ReactNode }) {
  return (
    <header className="header">
      {props.back && (
        <button className="icon-btn" aria-label="Retour" onClick={() => window.history.back()}>
          ‹
        </button>
      )}
      <h1>{props.title}</h1>
      {props.action}
    </header>
  );
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ExercisePicker(props: {
  data: Data;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState<Muscle>("Pectoraux");
  const [newEquipment, setNewEquipment] = useState<Equipment>("Machine");

  const list = props.data.exercises
    .filter((e) => (!muscle || e.muscle === muscle) && normalize(e.name).includes(normalize(query)))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const create = async () => {
    const name = query.trim();
    if (!name) return;
    const id = newId();
    await db.exercises.add({ id, name, muscle: newMuscle, equipment: newEquipment, custom: true });
    props.onPick(id);
  };

  return (
    <div className="sheet" role="dialog" aria-label="Choisir un exercice">
      <Header
        title="Choisir un exercice"
        action={
          <button className="text-btn" onClick={props.onClose}>
            Fermer
          </button>
        }
      />
      <input
        className="search"
        placeholder={creating ? "Nom du nouvel exercice" : "Rechercher…"}
        aria-label="Nom de l'exercice"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {creating ? (
        <div className="stack">
          <label className="field">
            Muscle
            <select value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as Muscle)}>
              {MUSCLES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Matériel
            <select
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value as Equipment)}
            >
              {EQUIPMENTS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={!query.trim()} onClick={create}>
            Créer et ajouter
          </button>
          <button className="btn" onClick={() => setCreating(false)}>
            Retour à la liste
          </button>
        </div>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Filtrer par muscle">
            <button className={muscle ? "chip" : "chip on"} onClick={() => setMuscle(null)}>
              Tous
            </button>
            {MUSCLES.map((m) => (
              <button
                key={m}
                className={muscle === m ? "chip on" : "chip"}
                onClick={() => setMuscle(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => setCreating(true)}>
            + Créer un exercice
          </button>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <button className="row" onClick={() => props.onPick(e.id)}>
                  <span>{e.name}</span>
                  <small>
                    {e.muscle} · {e.equipment}
                  </small>
                </button>
              </li>
            ))}
            {!list.length && <li className="empty">Aucun exercice trouvé.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
