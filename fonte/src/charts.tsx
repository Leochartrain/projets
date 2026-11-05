import { useState } from "react";

export interface Point {
  label: string;
  value: number;
  /** Texte complet affiché au toucher. */
  detail: string;
}

const W = 340;
const H = 190;
const M = { top: 12, right: 10, bottom: 24, left: 42 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

function niceStep(range: number): number {
  const rough = range / 3 || 1;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) out.push(v);
  return out;
}

const compact = (v: number) =>
  v >= 10_000 ? `${Math.round(v / 1000)} t` : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);

function Readout({ point }: { point: Point | undefined }) {
  return <p className="readout">{point?.detail ?? " "}</p>;
}

function ValuesTable({ points }: { points: Point[] }) {
  return (
    <details className="values">
      <summary>Voir les valeurs</summary>
      <ul>
        {[...points].reverse().map((p, i) => (
          <li key={i}>{p.detail}</li>
        ))}
      </ul>
    </details>
  );
}

function Grid({ yTicks, y }: { yTicks: number[]; y: (v: number) => number }) {
  return (
    <>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="grid" />
          <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="axis">
            {compact(t)}
          </text>
        </g>
      ))}
    </>
  );
}

/** Barres sur une base zéro. Toucher une barre affiche sa valeur. */
export function BarChart({ points, label }: { points: Point[]; label: string }) {
  const [selected, setSelected] = useState(points.length - 1);
  const yTicks = ticks(0, Math.max(...points.map((p) => p.value), 1));
  const top = yTicks[yTicks.length - 1];
  const y = (v: number) => M.top + IH - (v / top) * IH;
  const band = IW / points.length;
  const barW = Math.max(4, Math.min(band - 2, 16));

  return (
    <figure className="chart">
      <Readout point={points[selected]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <Grid yTicks={yTicks} y={y} />
        {points.map((p, i) => {
          const x = M.left + band * i + (band - barW) / 2;
          const h = Math.max(p.value > 0 ? 3 : 0, (p.value / top) * IH);
          const r = Math.min(4, barW / 2, h);
          const base = M.top + IH;
          return (
            <g key={i} onClick={() => setSelected(i)} className="hit">
              <rect x={M.left + band * i} y={M.top} width={band} height={IH + M.bottom} fill="transparent" />
              {h > 0 && (
                <path
                  className={i === selected ? "mark selected" : "mark"}
                  d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                />
              )}
              {i % 3 === (points.length - 1) % 3 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="axis">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ValuesTable points={points} />
    </figure>
  );
}

/** Courbe sur échelle ajustée : c'est la tendance qui compte, pas la distance à zéro. */
export function LineChart({ points, label }: { points: Point[]; label: string }) {
  const [selected, setSelected] = useState(points.length - 1);
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.02, 0.5);
  const yTicks = ticks(Math.max(0, lo - pad), hi + pad);
  const min = yTicks[0];
  const max = yTicks[yTicks.length - 1];
  const y = (v: number) => M.top + IH - ((v - min) / (max - min || 1)) * IH;
  const x = (i: number) => M.left + (points.length === 1 ? IW / 2 : (i / (points.length - 1)) * IW);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const current = Math.min(selected, points.length - 1);

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setSelected(best);
  };

  const labelEvery = Math.max(1, Math.ceil(points.length / 4));

  return (
    <figure className="chart">
      <Readout point={points[current]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerDown={pick} onPointerMove={pick}>
        <Grid yTicks={yTicks} y={y} />
        <line x1={x(current)} x2={x(current)} y1={M.top} y2={M.top + IH} className="crosshair" />
        <path d={path} className="line" />
        <circle cx={x(current)} cy={y(points[current].value)} r={5} className="dot" />
        {points.map(
          (p, i) =>
            (points.length - 1 - i) % labelEvery === 0 && (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor={i === points.length - 1 && points.length > 1 ? "end" : i === 0 ? "start" : "middle"}
                className="axis"
              >
                {p.label}
              </text>
            ),
        )}
      </svg>
      <ValuesTable points={points} />
    </figure>
  );
}

/** Barres horizontales avec libellé et valeur en texte. */
export function RankBars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="rank">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="rank-track">
            <span className="rank-bar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="num">
            {r.value} {unit}{r.value > 1 ? "s" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
