import { useEffect, useState, type FocusEvent } from "react";
import { db, newId } from "./db";
import { formatDuration, formatKg, parseNumber, previousSets, sessionVolume, formatVolume } from "./domain";
import { cancelRestAlert, scheduleRestAlert, vibrate } from "./native";
import { buildItem, doneSetCount, emptySet, finalizeSession } from "./session";
import type { Session, SessionItem, WorkSet } from "./types";
import { exerciseName, ExercisePicker, go, type Data } from "./ui";

const REST_KEY = "fonte.rest";
const DEFAULT_REST_KEY = "fonte.restSeconds";

export function defaultRest(): number {
  return Number(localStorage.getItem(DEFAULT_REST_KEY)) || 120;
}
export function setDefaultRest(seconds: number): void {
  localStorage.setItem(DEFAULT_REST_KEY, String(seconds));
}

function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** La fin du repos est une heure absolue : le compte reste juste si l'écran s'est éteint. */
function useRest() {
  const [endAt, setEndAt] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(REST_KEY));
    return saved > Date.now() ? saved : null;
  });
  const set = (value: number | null) => {
    setEndAt(value);
    if (value === null) {
      localStorage.removeItem(REST_KEY);
      void cancelRestAlert();
    } else {
      localStorage.setItem(REST_KEY, String(value));
      void scheduleRestAlert(value);
    }
  };
  return { endAt, set };
}

/** Toucher un champ rempli remplace sa valeur, au lieu d'insérer des chiffres au milieu. */
const selectAll = (e: FocusEvent<HTMLInputElement>) => e.target.select();

function SetRow(props: {
  index: number;
  set: WorkSet;
  previous: WorkSet | undefined;
  onChange: (patch: Partial<WorkSet>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { set, previous } = props;
  const [weight, setWeight] = useState(set.weight?.toString().replace(".", ",") ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");

  return (
    <div className={set.done ? "set done" : "set"}>
      <button
        className={set.warmup ? "set-num warmup" : "set-num"}
        aria-label={set.warmup ? "Échauffement : passer en série de travail" : `Série ${props.index} : passer en échauffement`}
        onClick={() => props.onChange({ warmup: !set.warmup })}
      >
        {set.warmup ? "É" : props.index}
      </button>
      <span className="prev num">
        {previous ? `${formatKg(previous.weight ?? 0)} × ${previous.reps ?? 0}` : "—"}
      </span>
      <input
        inputMode="decimal"
        onFocus={selectAll}
        aria-label="Charge en kilos"
        placeholder={previous?.weight != null ? formatKg(previous.weight) : "kg"}
        value={weight}
        onChange={(e) => {
          setWeight(e.target.value);
          props.onChange({ weight: parseNumber(e.target.value) });
        }}
      />
      <input
        inputMode="numeric"
        onFocus={selectAll}
        aria-label="Répétitions"
        placeholder={previous?.reps != null ? String(previous.reps) : "rép."}
        value={reps}
        onChange={(e) => {
          setReps(e.target.value);
          props.onChange({ reps: parseNumber(e.target.value) });
        }}
      />
      <input
        inputMode="decimal"
        onFocus={selectAll}
        aria-label="RPE, de 1 à 10, facultatif"
        placeholder="RPE"
        defaultValue={set.rpe ?? ""}
        onChange={(e) => {
          const value = parseNumber(e.target.value);
          props.onChange({ rpe: value !== null && value <= 10 ? value : null });
        }}
      />
      <button
        className={set.done ? "check on" : "check"}
        aria-label={set.done ? "Annuler la validation" : "Valider la série"}
        aria-pressed={set.done}
        onClick={() => {
          if (!set.done && set.reps === null && previous?.reps != null) setReps(String(previous.reps));
          if (!set.done && set.weight === null && previous?.weight != null) {
            setWeight(String(previous.weight).replace(".", ","));
          }
          props.onToggle();
        }}
      >
        ✓
      </button>
      {!set.done && (
        <button className="set-remove" aria-label="Supprimer la série" onClick={props.onRemove}>
          ×
        </button>
      )}
    </div>
  );
}

export function ScreenSession({ data }: { data: Data }) {
  const session = data.active;
  const now = useNow();
  const rest = useRest();
  const [picking, setPicking] = useState(false);
  const [hint, setHint] = useState("");

  const remaining = rest.endAt ? rest.endAt - now : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0) {
      void vibrate();
      rest.set(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (!session) {
    return (
      <section className="stack">
        <p className="empty">Aucune séance en cours.</p>
        <a className="btn primary" href="#/">
          Retour à l'accueil
        </a>
      </section>
    );
  }

  /** Relit la séance en base à chaque écriture : deux saisies rapprochées ne s'écrasent pas. */
  const mutate = (change: (current: Session) => Session) =>
    db.transaction("rw", db.sessions, async () => {
      const current = await db.sessions.get(session.id);
      if (current) await db.sessions.put(change(current));
    });

  const updateItem = (itemId: string, change: (item: SessionItem) => SessionItem) =>
    mutate((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? change(i) : i)) }));

  const updateSet = (itemId: string, setId: string, patch: Partial<WorkSet>) =>
    updateItem(itemId, (item) => ({
      ...item,
      sets: item.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    }));

  const toggle = (item: SessionItem, set: WorkSet, previous: WorkSet | undefined) => {
    if (set.done) return updateSet(item.id, set.id, { done: false });
    const reps = set.reps ?? previous?.reps ?? null;
    if (!reps) {
      setHint("Indique le nombre de répétitions avant de valider.");
      return;
    }
    setHint("");
    void updateSet(item.id, set.id, { done: true, reps, weight: set.weight ?? previous?.weight ?? null });
    rest.set(Date.now() + defaultRest() * 1000);
  };

  const addSet = (item: SessionItem) => {
    const last = item.sets[item.sets.length - 1];
    return updateItem(item.id, (i) => ({
      ...i,
      sets: [...i.sets, emptySet(newId(), { weight: last?.weight ?? null, reps: last?.reps ?? null })],
    }));
  };

  const finish = async () => {
    if (!doneSetCount(session)) {
      setHint("Valide au moins une série pour terminer, ou abandonne la séance.");
      return;
    }
    if (!window.confirm("Terminer la séance ? Les séries non validées ne seront pas gardées.")) return;
    await mutate((s) => finalizeSession(s, Date.now()));
    rest.set(null);
    window.location.replace(`#/historique/${session.id}`);
  };

  const abandon = async () => {
    if (!window.confirm("Abandonner cette séance ? Tout ce qui a été saisi sera perdu.")) return;
    await db.sessions.delete(session.id);
    rest.set(null);
    go("/");
  };

  return (
    <div className={rest.endAt ? "session with-rest" : "session"}>
      <header className="session-head">
        <button className="text-btn" onClick={() => go("/")}>
          Réduire
        </button>
        <div className="session-clock">
          <strong className="num">{formatDuration(now - session.startedAt)}</strong>
          <small className="num">{formatVolume(sessionVolume(session))}</small>
        </div>
        <button className="btn small primary" onClick={finish}>
          Terminer
        </button>
      </header>

      <input
        className="session-name"
        aria-label="Nom de la séance"
        defaultValue={session.name}
        onChange={(e) => mutate((s) => ({ ...s, name: e.target.value || "Séance" }))}
      />

      {hint && <p className="hint" role="alert">{hint}</p>}

      {session.items.length === 0 && <p className="empty">Ajoute ton premier exercice pour commencer.</p>}

      {session.items.map((item) => {
        const previous = previousSets(data.sessions, item.exerciseId, session.startedAt);
        let workIndex = 0;
        return (
          <section key={item.id} className="exercise">
            <div className="exercise-head">
              <a href={`#/exercice/${item.exerciseId}`}>
                <h2>{exerciseName(data, item.exerciseId)}</h2>
              </a>
              <button
                className="text-btn danger"
                onClick={() => {
                  if (window.confirm("Retirer cet exercice de la séance ?")) {
                    void mutate((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
                  }
                }}
              >
                Retirer
              </button>
            </div>
            <div className="set set-title" aria-hidden="true">
              <span>Série</span>
              <span>Dernière fois</span>
              <span>kg</span>
              <span>Rép.</span>
              <span>RPE</span>
              <span />
            </div>
            {item.sets.map((set, i) => {
              if (!set.warmup) workIndex += 1;
              return (
                <SetRow
                  key={set.id}
                  index={workIndex}
                  set={set}
                  previous={previous[i]}
                  onChange={(patch) => updateSet(item.id, set.id, patch)}
                  onToggle={() => toggle(item, set, previous[i])}
                  onRemove={() =>
                    updateItem(item.id, (it) => ({ ...it, sets: it.sets.filter((s) => s.id !== set.id) }))
                  }
                />
              );
            })}
            <button className="btn small ghost" onClick={() => addSet(item)}>
              + Ajouter une série
            </button>
          </section>
        );
      })}

      <button className="btn" onClick={() => setPicking(true)}>
        + Ajouter un exercice
      </button>
      <label className="field">
        Note
        <textarea
          rows={2}
          placeholder="Forme du jour, réglages machine…"
          defaultValue={session.note}
          onChange={(e) => mutate((s) => ({ ...s, note: e.target.value }))}
        />
      </label>
      <button className="text-btn danger center" onClick={abandon}>
        Abandonner la séance
      </button>

      {rest.endAt && remaining !== null && remaining > 0 && (
        <aside className="rest" aria-label="Temps de repos">
          <button className="btn small" onClick={() => rest.set(Math.max(Date.now() + 1000, rest.endAt! - 15_000))}>
            −15 s
          </button>
          <strong className="num" role="timer">
            {formatDuration(remaining + 999)}
          </strong>
          <button className="btn small" onClick={() => rest.set(rest.endAt! + 15_000)}>
            +15 s
          </button>
          <button className="btn small primary" onClick={() => rest.set(null)}>
            Passer
          </button>
        </aside>
      )}

      {picking && (
        <ExercisePicker
          data={data}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            void mutate((s) => ({
              ...s,
              items: [...s.items, buildItem(id, 3, null, data.sessions, s.startedAt, newId)],
            }));
          }}
        />
      )}
    </div>
  );
}
