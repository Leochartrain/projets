// Statistiques d'écoute façon « rétrospective » : chiffres clés, classements, graphiques animés.
import { animate, motion } from "motion/react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Stats as StatsData, type TopItem } from "../lib/api";
import { albumKeyOf } from "../lib/library";
import { player } from "../lib/player";
import { useApp } from "../lib/store";
import { Cover, cx, Empty, Heading, IconButton, Section, Segmented } from "../components/ui";

type Period = "week" | "month" | "year" | "all";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function range(period: Period, offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    const to = new Date(d);
    to.setDate(d.getDate() + 7);
    const end = new Date(to.getTime() - 1);
    return { from: d, to, label: `Du ${d.getDate()} ${MONTHS[d.getMonth()]} au ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}` };
  }
  if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 1), label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` };
  }
  if (period === "year") {
    const y = now.getFullYear() + offset;
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), label: String(y) };
  }
  return { from: new Date(2000, 0, 1), to: new Date(now.getFullYear() + 1, 0, 1), label: "Depuis le début" };
}

const hm = (ms: number) => {
  if (ms > 0 && ms < 90_000) return `${Math.round(ms / 1000)} s`;
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
};

/** Nombre qui « compte » jusqu'à sa valeur. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => ref.current && (ref.current.textContent = format(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{format(value)}</span>;
}

function Tile({ label, value, format, accent }: { label: string; value: number; format: (n: number) => string; accent?: boolean }) {
  return (
    <div className={cx("rounded-[18px] p-5", accent ? "bg-accent text-on-accent" : "bg-fill")}>
      <div className={cx("text-[12px] font-semibold uppercase tracking-wider", accent ? "opacity-80" : "text-ink-2")}>{label}</div>
      <div className="mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums">
        <CountUp value={value} format={format} />
      </div>
    </div>
  );
}

interface Bar {
  label: string;
  /** Étiquette d'axe (vide = masquée). */
  axis: string;
  value: number;
}

/** Histogramme à une série : une seule teinte, barres fines arrondies, infobulle au survol. */
function BarChart({ data, height = 170, title }: { data: Bar[]; height?: number; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <figure className="m-0" aria-label={`${title} — total ${hm(total)}`}>
      <div className="relative flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-[15px] right-0 text-[10px] tabular-nums text-ink-3">{hm(max * g)}</span>
          </div>
        ))}
        {data.map((d, i) => (
          <div key={i} className="relative flex h-full min-w-0 flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 24, delay: Math.min(0.5, i * 0.012) }}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, transformOrigin: "bottom" }}
              className={cx("w-full max-w-[26px] rounded-t-[4px] bg-accent transition-opacity", hover !== null && hover !== i && "opacity-40")}
            />
            {hover === i && (
              <div className="glass-strong pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[8px] border border-line px-2.5 py-1 text-[12px] shadow-[var(--shadow)]">
                <span className="text-ink-2">{d.label} : </span>
                <span className="font-semibold tabular-nums">{hm(d.value)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1">
        {data.map((d, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-ink-3">
            {d.axis}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Ranking({ items, onClick, round }: { items: TopItem[]; onClick?: (it: TopItem) => void; round?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.ms));
  return (
    <ol className="m-0 list-none space-y-1 p-0">
      {items.slice(0, 10).map((it, i) => (
        <motion.li key={`${it.name}-${it.sub}-${i}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
          <button type="button" disabled={!onClick} onClick={() => onClick?.(it)} className={cx("relative flex h-[52px] w-full items-center gap-3 overflow-hidden rounded-[10px] px-2 text-left", onClick && "hover:bg-fill")}>
            <motion.span
              aria-hidden
              initial={{ width: 0 }}
              animate={{ width: `${(it.ms / max) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.1 + i * 0.04 }}
              className="absolute inset-y-1 left-0 rounded-[8px] bg-[var(--accent-soft)]"
            />
            <span className="relative w-5 text-center text-[13px] font-bold tabular-nums text-ink-3">{i + 1}</span>
            <Cover id={it.cover} size={96} round={round} className="relative h-9 w-9" rounded="rounded-[6px]" />
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{it.name}</span>
              {it.sub && <span className="block truncate text-[12px] text-ink-2">{it.sub}</span>}
            </span>
            <span className="relative text-right text-[12px] tabular-nums text-ink-2">
              <span className="block font-semibold text-ink">{hm(it.ms)}</span>
              {it.plays} écoute{it.plays > 1 ? "s" : ""}
            </span>
          </button>
        </motion.li>
      ))}
    </ol>
  );
}

export function Stats() {
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<StatsData | null>(null);
  const navigate = useApp((s) => s.navigate);
  const byId = useApp((s) => s.byId);
  const plays = useApp((s) => s.history.length);
  const r = useMemo(() => range(period, offset), [period, offset]);

  useEffect(() => {
    let alive = true;
    api.getStats(Math.floor(r.from.getTime() / 1000), Math.floor(r.to.getTime() / 1000)).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [r, plays]);

  const series = useMemo<Bar[]>(() => {
    if (!data) return [];
    const map = new Map(data.days);
    if (period === "week" || period === "month") {
      const out: Bar[] = [];
      for (let d = new Date(r.from); d < r.to; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const label = `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
        const axis = period === "week" ? DAYS[(d.getDay() + 6) % 7] : d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : "";
        out.push({ label, axis, value: map.get(key) ?? 0 });
      }
      return out;
    }
    // Année ou tout : regroupement par mois.
    const months = new Map<string, number>();
    for (const [day, ms] of data.days) months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + ms);
    if (period === "year") {
      return MONTHS.map((m, i) => ({ label: `${MONTHS_LONG[i]} ${r.from.getFullYear()}`, axis: m, value: months.get(`${r.from.getFullYear()}-${String(i + 1).padStart(2, "0")}`) ?? 0 }));
    }
    return [...months.entries()].sort().map(([k, v], i, all) => {
      const [y, m] = k.split("-").map(Number);
      return { label: `${MONTHS_LONG[m - 1]} ${y}`, axis: m === 1 || i === 0 || all.length <= 12 ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : "", value: v };
    });
  }, [data, period, r]);

  const empty = data && data.total_plays === 0;
  const bestHour = data ? data.hours.indexOf(Math.max(...data.hours)) : 0;

  return (
    <>
      <Heading
        title="Statistiques"
        subtitle={r.label}
        right={
          <>
            {period !== "all" && (
              <div className="flex">
                <IconButton label="Période précédente" onClick={() => setOffset(offset - 1)}>
                  <ChevronLeft size={18} />
                </IconButton>
                <IconButton label="Période suivante" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
                  <ChevronRight size={18} />
                </IconButton>
              </div>
            )}
            <Segmented
              id="stats-period"
              value={period}
              onChange={(p) => (setPeriod(p), setOffset(0))}
              options={[
                { value: "week", label: "Semaine" },
                { value: "month", label: "Mois" },
                { value: "year", label: "Année" },
                { value: "all", label: "Tout" },
              ]}
            />
          </>
        }
      />
      {!data ? null : empty ? (
        <Empty icon={<BarChart3 />} title="Rien écouté sur cette période" text="Les statistiques se remplissent au fil de vos écoutes. Tout est calculé et conservé sur cet ordinateur." />
      ) : (
        <motion.div key={`${period}-${offset}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Tile accent label="Temps d'écoute" value={data.total_ms} format={hm} />
            <Tile label="Écoutes" value={data.total_plays} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
            <Tile label="Morceaux différents" value={data.distinct_tracks} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
            <Tile label="Artistes différents" value={data.distinct_artists} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
          </div>

          <Section title={period === "week" || period === "month" ? "Temps d'écoute par jour" : "Temps d'écoute par mois"}>
            <div className="rounded-[18px] bg-fill p-5 pt-7">
              <BarChart data={series} title="Temps d'écoute" height={190} />
            </div>
          </Section>

          <div className="grid gap-x-10 xl:grid-cols-2">
            <Section title="Artistes les plus écoutés">
              <Ranking round items={data.top_artists} onClick={(it) => navigate({ name: "artist", param: it.name })} />
            </Section>
            <Section title="Morceaux les plus écoutés">
              <Ranking items={data.top_tracks} onClick={(it) => it.track_id !== null && player.playQueue([it.track_id], 0, { shuffle: false })} />
            </Section>
            <Section title="Albums les plus écoutés">
              <Ranking
                items={data.top_albums}
                onClick={(it) => {
                  const t = it.track_id !== null ? byId.get(it.track_id) : undefined;
                  if (t) navigate({ name: "album", param: albumKeyOf(t) });
                }}
              />
            </Section>
            <Section title="Genres">
              <Ranking items={data.genres} onClick={(it) => navigate({ name: "genre", param: it.name })} />
            </Section>
          </div>

          <div className="grid gap-x-10 xl:grid-cols-2">
            <Section title="Heures d'écoute préférées" right={<span className="text-[12.5px] text-ink-2">Pic vers {bestHour} h</span>}>
              <div className="rounded-[18px] bg-fill p-5 pt-7">
                <BarChart title="Temps d'écoute par heure" data={data.hours.map((v, h) => ({ label: `${h} h – ${h + 1} h`, axis: h % 3 === 0 ? `${h} h` : "", value: v }))} />
              </div>
            </Section>
            <Section title="Jours de la semaine">
              <div className="rounded-[18px] bg-fill p-5 pt-7">
                <BarChart title="Temps d'écoute par jour de la semaine" data={data.weekdays.map((v, d) => ({ label: DAYS[d], axis: DAYS[d], value: v }))} />
              </div>
            </Section>
          </div>
        </motion.div>
      )}
    </>
  );
}
