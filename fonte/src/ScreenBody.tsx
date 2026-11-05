import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { LineChart } from "./charts";
import { db, newId } from "./db";
import { formatDate, formatKg, formatShortDate, parseNumber } from "./domain";
import type { Measurement } from "./types";
import { Header } from "./ui";

type Metric = "weight" | "waist" | "bodyFat" | "chest" | "arm" | "thigh";

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "weight", label: "Poids", unit: "kg" },
  { key: "waist", label: "Taille", unit: "cm" },
  { key: "bodyFat", label: "Masse grasse", unit: "%" },
  { key: "chest", label: "Poitrine", unit: "cm" },
  { key: "arm", label: "Bras", unit: "cm" },
  { key: "thigh", label: "Cuisse", unit: "cm" },
];

const emptyForm = () => Object.fromEntries(METRICS.map((m) => [m.key, ""])) as Record<Metric, string>;

export function ScreenBody() {
  const rows = useLiveQuery(() => db.measurements.orderBy("date").toArray());
  const [metric, setMetric] = useState<Metric>("weight");
  const [form, setForm] = useState(emptyForm);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  if (!rows) return null;

  const current = METRICS.find((m) => m.key === metric)!;
  const series = rows.filter((r) => r[metric] !== null);
  const hasValue = METRICS.some((m) => parseNumber(form[m.key]) !== null);

  const add = async () => {
    const entry: Measurement = {
      id: newId(),
      date: new Date(`${date}T12:00`).getTime(),
      weight: parseNumber(form.weight),
      waist: parseNumber(form.waist),
      bodyFat: parseNumber(form.bodyFat),
      chest: parseNumber(form.chest),
      arm: parseNumber(form.arm),
      thigh: parseNumber(form.thigh),
    };
    await db.measurements.add(entry);
    setForm(emptyForm());
  };

  const remove = async (id: string) => {
    if (window.confirm("Supprimer cette mesure ?")) await db.measurements.delete(id);
  };

  return (
    <>
      <Header title="Corps" />
      <div className="chips" role="group" aria-label="Mesure affichée">
        {METRICS.map((m) => (
          <button key={m.key} className={metric === m.key ? "chip on" : "chip"} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {series.length >= 2 ? (
        <LineChart
          key={`${metric}-${series.length}`}
          label={`Évolution : ${current.label}`}
          points={series.map((r) => ({
            label: formatShortDate(r.date),
            value: r[metric]!,
            detail: `${formatDate(r.date)} : ${formatKg(r[metric]!)} ${current.unit}`,
          }))}
        />
      ) : (
        <p className="empty">La courbe apparaîtra après deux mesures de {current.label.toLowerCase()}.</p>
      )}

      <section className="exercise">
        <h2>Nouvelle mesure</h2>
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="form-grid">
          {METRICS.map((m) => (
            <label key={m.key} className="field">
              {m.label} ({m.unit})
              <input
                inputMode="decimal"
                value={form[m.key]}
                onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button className="btn primary" disabled={!hasValue || !date} onClick={add}>
          Enregistrer
        </button>
      </section>

      <h2 className="group-title">Mesures</h2>
      {!rows.length && <p className="empty">Aucune mesure pour l'instant.</p>}
      <ul className="list">
        {[...rows].reverse().map((r) => (
          <li key={r.id} className="row split">
            <span>
              {formatDate(r.date)}
              <small className="num">
                {METRICS.filter((m) => r[m.key] !== null)
                  .map((m) => `${m.label} ${formatKg(r[m.key]!)} ${m.unit}`)
                  .join(" · ")}
              </small>
            </span>
            <button className="text-btn danger" onClick={() => remove(r.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
