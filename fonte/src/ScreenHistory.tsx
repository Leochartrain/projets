import { db, newId } from "./db";
import {
  finished, formatDate, formatDuration, formatKg, formatVolume, sessionRecords, sessionVolume, sessionWorkSets,
} from "./domain";
import { buildSession, templateFromSession } from "./session";
import type { Session } from "./types";
import { exerciseName, go, Header, type Data } from "./ui";

/** Relance une séance passée, avec les charges les plus récentes de chaque exercice. */
async function startSessionFrom(data: Data, past: Session): Promise<void> {
  if (!data.active) {
    const now = Date.now();
    const next = buildSession(templateFromSession(past, past.id, now), data.sessions, now, newId);
    await db.sessions.add({ ...next, templateId: past.templateId });
  }
  go("/seance");
}

export function ScreenHistory({ data }: { data: Data }) {
  const list = finished(data.sessions).reverse();
  return (
    <>
      <Header title="Historique" />
      {!list.length && <p className="empty">Tes séances terminées apparaîtront ici.</p>}
      <ul className="cards">
        {list.map((s) => (
          <li key={s.id} className="card">
            <a className="card-main" href={`#/historique/${s.id}`}>
              <h3>{s.name}</h3>
              <p>
                {formatDate(s.startedAt)} · {formatDuration(s.endedAt! - s.startedAt)}
              </p>
              <p className="num">
                {sessionWorkSets(s)} séries · {formatVolume(sessionVolume(s))}
                {sessionRecords(s, data.sessions).length > 0 && <span className="pr"> ★ record</span>}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ScreenSessionDetail({ data, id }: { data: Data; id: string }) {
  const session = data.sessions.find((s) => s.id === id);
  if (!session || session.endedAt === null) {
    return (
      <>
        <Header title="Séance" back />
        <p className="empty">Cette séance n'existe plus.</p>
      </>
    );
  }
  const records = sessionRecords(session, data.sessions);

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette séance de l'historique ?")) return;
    await db.sessions.delete(session.id);
    go("/historique");
  };
  const saveTemplate = async () => {
    await db.templates.add(templateFromSession(session, newId(), Date.now()));
    go("/");
  };

  return (
    <>
      <Header title={session.name} back />
      <p className="sub">{formatDate(session.startedAt)}</p>
      <section className="stats">
        <div>
          <strong className="num">{formatDuration(session.endedAt - session.startedAt)}</strong>
          <small>durée</small>
        </div>
        <div>
          <strong className="num">{sessionWorkSets(session)}</strong>
          <small>séries</small>
        </div>
        <div>
          <strong className="num">{formatVolume(sessionVolume(session))}</strong>
          <small>volume</small>
        </div>
      </section>

      {records.length > 0 && (
        <section className="records">
          <h2>★ Nouveaux records</h2>
          <ul>
            {records.map((r) => (
              <li key={`${r.exerciseId}-${r.kind}`}>
                <strong>{exerciseName(data, r.exerciseId)}</strong> :{" "}
                {r.kind === "weight" ? "charge max" : "1RM estimé"} {formatKg(r.value)} kg
                <small className="num"> (avant : {formatKg(r.previous)} kg)</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.items.map((item) => (
        <section key={item.id} className="exercise">
          <a href={`#/exercice/${item.exerciseId}`}>
            <h2>{exerciseName(data, item.exerciseId)}</h2>
          </a>
          <ol className="done-sets num">
            {item.sets.map((s) => (
              <li key={s.id} className={s.warmup ? "muted" : undefined}>
                {s.warmup ? "Échauffement · " : ""}
                {formatKg(s.weight ?? 0)} kg × {s.reps}
                {s.rpe !== null ? ` · RPE ${formatKg(s.rpe)}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {session.note && <p className="note">{session.note}</p>}

      <button className="btn primary" disabled={!!data.active} onClick={() => startSessionFrom(data, session)}>
        Refaire cette séance
      </button>
      <button className="btn" onClick={saveTemplate}>
        Enregistrer comme modèle
      </button>
      <button className="text-btn danger center" onClick={remove}>
        Supprimer cette séance
      </button>
    </>
  );
}
