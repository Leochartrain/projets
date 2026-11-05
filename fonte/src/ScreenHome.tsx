import { db, newId } from "./db";
import { formatVolume, startOfWeek, weekStreak, finished, sessionVolume } from "./domain";
import { buildSession } from "./session";
import type { Template } from "./types";
import { exerciseName, go, Header, type Data } from "./ui";

export async function startSession(data: Data, template: Template | null): Promise<void> {
  if (!data.active) {
    const now = Date.now();
    await db.sessions.add(buildSession(template, data.sessions, now, newId));
  }
  go("/seance");
}

export function ScreenHome({ data }: { data: Data }) {
  const now = Date.now();
  const week = finished(data.sessions).filter((s) => s.startedAt >= startOfWeek(now));
  const volume = week.reduce((sum, s) => sum + sessionVolume(s), 0);

  return (
    <>
      <Header
        title="Fonte"
        action={
          <a className="text-btn" href="#/reglages">
            Réglages
          </a>
        }
      />

      <section className="stats">
        <div>
          <strong className="num">{week.length}</strong>
          <small>séance{week.length > 1 ? "s" : ""} cette semaine</small>
        </div>
        <div>
          <strong className="num">{formatVolume(volume)}</strong>
          <small>soulevés</small>
        </div>
        <div>
          <strong className="num">{weekStreak(data.sessions, now)}</strong>
          <small>sem. d'affilée</small>
        </div>
      </section>

      {data.active ? (
        <a className="btn primary big" href="#/seance">
          Reprendre « {data.active.name} »
        </a>
      ) : (
        <button className="btn primary big" onClick={() => startSession(data, null)}>
          Démarrer une séance libre
        </button>
      )}

      <div className="section-title">
        <h2>Mes modèles</h2>
        <a className="text-btn" href="#/modele/nouveau">
          + Nouveau
        </a>
      </div>
      {data.templates.length === 0 && (
        <p className="empty">
          Crée un modèle (Push, Jambes…) pour lancer ta séance en un geste, avec tes charges de la
          dernière fois déjà remplies.
        </p>
      )}
      <ul className="cards">
        {data.templates.map((t) => (
          <li key={t.id} className="card">
            <a className="card-main" href={`#/modele/${t.id}`}>
              <h3>{t.name}</h3>
              <p>{t.items.map((i) => exerciseName(data, i.exerciseId)).join(", ") || "Aucun exercice"}</p>
            </a>
            <button
              className="btn small"
              disabled={!!data.active || !t.items.length}
              onClick={() => startSession(data, t)}
            >
              Démarrer
            </button>
          </li>
        ))}
      </ul>

      <a className="btn" href="#/exercices">
        Tous les exercices
      </a>
    </>
  );
}
