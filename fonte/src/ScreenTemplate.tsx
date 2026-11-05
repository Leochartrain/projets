import { useState } from "react";
import { db, newId } from "./db";
import type { TemplateItem } from "./types";
import { exerciseName, ExercisePicker, Header, type Data } from "./ui";

function Stepper(props: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <small>{props.label}</small>
      <button aria-label={`${props.label} : moins`} onClick={() => props.onChange(Math.max(props.min, props.value - 1))}>
        −
      </button>
      <strong className="num">{props.value}</strong>
      <button aria-label={`${props.label} : plus`} onClick={() => props.onChange(props.value + 1)}>
        +
      </button>
    </div>
  );
}

export function ScreenTemplate({ data, id }: { data: Data; id: string }) {
  const existing = data.templates.find((t) => t.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [items, setItems] = useState<TemplateItem[]>(existing?.items ?? []);
  const [picking, setPicking] = useState(false);

  const patch = (i: number, change: Partial<TemplateItem>) =>
    setItems(items.map((item, n) => (n === i ? { ...item, ...change } : item)));

  const move = (i: number, by: number) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    setItems(next);
  };

  const save = async () => {
    await db.templates.put({
      id: existing?.id ?? newId(),
      name: name.trim(),
      items,
      updatedAt: Date.now(),
    });
    window.history.back();
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Supprimer le modèle « ${existing.name} » ?`)) return;
    await db.templates.delete(existing.id);
    window.history.back();
  };

  return (
    <>
      <Header title={existing ? "Modifier le modèle" : "Nouveau modèle"} back />
      <label className="field">
        Nom
        <input value={name} placeholder="Push, Jambes, Haut du corps…" onChange={(e) => setName(e.target.value)} />
      </label>
      <ul className="stack">
        {items.map((item, i) => (
          <li key={`${item.exerciseId}-${i}`} className="exercise">
            <div className="exercise-head">
              <h2>{exerciseName(data, item.exerciseId)}</h2>
              <button className="text-btn danger" onClick={() => setItems(items.filter((_, n) => n !== i))}>
                Retirer
              </button>
            </div>
            <div className="template-controls">
              <Stepper label="Séries" value={item.sets} min={1} onChange={(sets) => patch(i, { sets })} />
              <Stepper label="Rép." value={item.reps} min={1} onChange={(reps) => patch(i, { reps })} />
              <div className="stepper">
                <small>Ordre</small>
                <button aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button aria-label="Descendre" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={() => setPicking(true)}>
        + Ajouter un exercice
      </button>
      <button className="btn primary" disabled={!name.trim() || !items.length} onClick={save}>
        Enregistrer
      </button>
      {existing && (
        <button className="text-btn danger center" onClick={remove}>
          Supprimer ce modèle
        </button>
      )}
      {picking && (
        <ExercisePicker
          data={data}
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            setPicking(false);
            setItems([...items, { exerciseId, sets: 3, reps: 10 }]);
          }}
        />
      )}
    </>
  );
}
