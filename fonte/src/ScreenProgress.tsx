import { BarChart, RankBars } from "./charts";
import { allBests, finished, formatKg, formatShortDate, formatVolume, setsByMuscle, weekStreak, weeklyVolume } from "./domain";
import { exerciseName, Header, type Data } from "./ui";

export function ScreenProgress({ data }: { data: Data }) {
  const now = Date.now();
  const total = finished(data.sessions).length;
  const weeks = weeklyVolume(data.sessions, 12, now);
  const muscles = setsByMuscle(data.sessions, data.exercises, now);
  const bests = allBests(data.sessions, data.exercises.map((e) => e.id));

  if (!total) {
    return (
      <>
        <Header title="Progrès" />
        <p className="empty">Termine ta première séance pour voir tes statistiques.</p>
      </>
    );
  }

  return (
    <>
      <Header title="Progrès" />
      <section className="stats">
        <div>
          <strong className="num">{total}</strong>
          <small>séances</small>
        </div>
        <div>
          <strong className="num">{weekStreak(data.sessions, now)}</strong>
          <small>sem. d'affilée</small>
        </div>
        <div>
          <strong className="num">{formatVolume(weeks.reduce((sum, w) => sum + w.volume, 0))}</strong>
          <small>en 12 semaines</small>
        </div>
      </section>

      <h2 className="group-title">Volume par semaine</h2>
      <BarChart
        key={total}
        label="Volume soulevé par semaine sur 12 semaines"
        points={weeks.map((w) => ({
          label: formatShortDate(w.weekStart),
          value: w.volume,
          detail: `Sem. du ${formatShortDate(w.weekStart)} : ${formatVolume(w.volume)}, ${w.count} séance${w.count > 1 ? "s" : ""}`,
        }))}
      />

      <h2 className="group-title">Séries par muscle, 7 derniers jours</h2>
      {muscles.length ? (
        <RankBars rows={muscles.map((m) => ({ label: m.muscle, value: m.sets }))} unit="série" />
      ) : (
        <p className="empty">Aucune série de travail ces 7 derniers jours.</p>
      )}

      <h2 className="group-title">Mes records</h2>
      <ul className="list">
        {bests.map((b) => (
          <li key={b.exerciseId}>
            <a className="row" href={`#/exercice/${b.exerciseId}`}>
              <span>{exerciseName(data, b.exerciseId)}</span>
              <small className="num">
                {b.topWeight > 0 ? `${formatKg(b.topWeight)} kg max` : "Sans charge"}
                {b.best1RM !== null ? ` · 1RM est. ${formatKg(b.best1RM)} kg` : ""}
              </small>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
