import { LineChart } from "./charts";
import { db } from "./db";
import { exerciseHistory, formatDate, formatKg, formatShortDate, formatVolume } from "./domain";
import { MUSCLES } from "./types";
import { Header, type Data } from "./ui";

export function ScreenExercises({ data }: { data: Data }) {
  return (
    <>
      <Header title="Exercices" back />
      {MUSCLES.map((muscle) => {
        const list = data.exercises
          .filter((e) => e.muscle === muscle)
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        if (!list.length) return null;
        return (
          <section key={muscle}>
            <h2 className="group-title">{muscle}</h2>
            <ul className="list">
              {list.map((e) => (
                <li key={e.id}>
                  <a className="row" href={`#/exercice/${e.id}`}>
                    <span>{e.name}</span>
                    <small>{e.equipment}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function ScreenExercise({ data, id }: { data: Data; id: string }) {
  const exercise = data.exerciseById.get(id);
  if (!exercise) {
    return (
      <>
        <Header title="Exercice" back />
        <p className="empty">Cet exercice n'existe plus.</p>
      </>
    );
  }
  const history = exerciseHistory(data.sessions, id);
  const curve = history.filter((p) => p.best1RM !== null);
  const usedInTemplate = data.templates.some((t) => t.items.some((i) => i.exerciseId === id));
  const usedInSession = data.sessions.some((s) => s.items.some((i) => i.exerciseId === id));

  const remove = async () => {
    if (!window.confirm(`Supprimer « ${exercise.name} » ?`)) return;
    await db.exercises.delete(id);
    window.history.back();
  };

  return (
    <>
      <Header title={exercise.name} back />
      <p className="sub">
        {exercise.muscle} · {exercise.equipment}
      </p>
      {history.length > 0 && (
        <section className="stats">
          <div>
            <strong className="num">{formatKg(Math.max(...history.map((p) => p.topWeight)))} kg</strong>
            <small>charge max</small>
          </div>
          <div>
            <strong className="num">
              {curve.length ? `${formatKg(Math.max(...curve.map((p) => p.best1RM!)))} kg` : "—"}
            </strong>
            <small>1RM estimé</small>
          </div>
          <div>
            <strong className="num">{history.length}</strong>
            <small>séance{history.length > 1 ? "s" : ""}</small>
          </div>
        </section>
      )}
      <h2 className="group-title">1RM estimé</h2>
      {curve.length >= 2 ? (
        <LineChart
          key={curve.length}
          label={`Progression du 1RM estimé : ${exercise.name}`}
          points={curve.map((p) => ({
            label: formatShortDate(p.date),
            value: Math.round(p.best1RM! * 10) / 10,
            detail: `${formatDate(p.date)} : ${formatKg(p.best1RM!)} kg`,
          }))}
        />
      ) : (
        <p className="empty">La courbe apparaîtra après deux séances sur cet exercice (12 répétitions maximum).</p>
      )}
      <h2 className="group-title">Historique</h2>
      {!history.length && <p className="empty">Pas encore fait.</p>}
      <ul className="list">
        {[...history].reverse().map((p) => (
          <li key={p.sessionId}>
            <a className="row" href={`#/historique/${p.sessionId}`}>
              <span>{formatDate(p.date)}</span>
              <small className="num">
                {p.sets.map((s) => `${formatKg(s.weight ?? 0)}×${s.reps}`).join("  ")} · {formatVolume(p.volume)}
              </small>
            </a>
          </li>
        ))}
      </ul>
      {exercise.custom && !usedInTemplate && !usedInSession && (
        <button className="text-btn danger center" onClick={remove}>
          Supprimer cet exercice
        </button>
      )}
    </>
  );
}
