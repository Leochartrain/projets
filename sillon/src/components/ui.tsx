// Petites briques d'interface partagées.
import { motion } from "motion/react";
import { Heart, Music2, Star } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { coverUrl, type Track } from "../lib/api";
import { qualityOf, type Quality } from "../lib/library";
import { currentPosition, player } from "../lib/player";
import { useApp } from "../lib/store";

export const ScrollContext = createContext<RefObject<HTMLDivElement | null>>({ current: null });
export const useScrollParent = () => useContext(ScrollContext);

export const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 32 } as const;

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Pochette (ou motif neutre si absente). `layoutId` relie deux écrans pour l'effet de zoom partagé. */
export function Cover({
  id,
  size = 320,
  className,
  rounded = "rounded-lg",
  layoutId,
  round,
}: {
  id: string | null | undefined;
  size?: 96 | 320 | 1000;
  className?: string;
  rounded?: string;
  layoutId?: string;
  round?: boolean;
}) {
  const url = coverUrl(id, size);
  const shape = round ? "rounded-full" : rounded;
  return (
    <motion.div
      layoutId={layoutId}
      transition={softSpring}
      className={cx("relative aspect-square shrink-0 overflow-hidden bg-fill", shape, className)}
    >
      {url ? (
        <img src={url} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fill to-fill-2 text-ink-3">
          <Music2 className="h-[34%] w-[34%]" strokeWidth={1.4} />
        </div>
      )}
      <div className={cx("pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/8 dark:ring-white/8", shape)} />
    </motion.div>
  );
}

const QUALITY_TEXT: Record<Quality, string> = { hires: "Hi-Res", lossless: "Lossless", lossy: "" };

export function QualityBadge({ quality, className }: { quality: Quality; className?: string }) {
  if (quality === "lossy") return null;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide",
        quality === "hires" ? "bg-amber-400/18 text-amber-700 dark:text-amber-300" : "bg-fill-2 text-ink-2",
        className,
      )}
    >
      {QUALITY_TEXT[quality]}
    </span>
  );
}

export const TrackQuality = ({ track, className }: { track: Track; className?: string }) => (
  <QualityBadge quality={qualityOf(track)} className={className} />
);

export function IconButton({
  children,
  label,
  onClick,
  active,
  className,
  size = 32,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  className?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      style={{ width: size, height: size }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-fill disabled:opacity-35",
        active ? "text-accent" : "text-ink-2 hover:text-ink",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function Button({
  children,
  onClick,
  primary,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors disabled:opacity-40",
        primary ? "bg-accent text-on-accent hover:brightness-110" : "bg-fill text-ink hover:bg-fill-2",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-accent" : "bg-fill-2")}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
        style={{ left: checked ? 21 : 3 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-[10px] bg-fill p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx("relative h-7 rounded-[8px] px-3 text-[13px] font-medium", o.value === value ? "text-ink" : "text-ink-2 hover:text-ink")}
        >
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-[8px] bg-elev shadow-sm ring-1 ring-line" />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Heading({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="truncate text-[32px] max-md:text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-2">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill text-ink-3">{icon}</div>
      <div className="text-[17px] font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoveButton({ track, size = 30 }: { track: Track; size?: number }) {
  return (
    <IconButton label={track.loved ? "Ne plus aimer" : "Aimer"} active={track.loved} size={size} onClick={(e) => (e.stopPropagation(), player.toggleLoved(track.id))}>
      <motion.span animate={{ scale: track.loved ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.35 }} className="inline-flex">
        <Heart size={size * 0.5} fill={track.loved ? "currentColor" : "none"} />
      </motion.span>
    </IconButton>
  );
}

export function Stars({ value, onChange, size = 13 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`Note : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          tabIndex={onChange ? 0 : -1}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          onClick={(e) => (e.stopPropagation(), onChange?.(n === value ? 0 : n))}
          className={cx("p-[1px]", n <= value ? "text-amber-500" : "text-ink-3/50", onChange && "hover:text-amber-400")}
        >
          <Star size={size} fill={n <= value ? "currentColor" : "none"} strokeWidth={1.6} />
        </button>
      ))}
    </span>
  );
}

/** Trois barres animées : repère du morceau en cours de lecture. */
export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px] text-accent" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-sm bg-current"
          animate={playing ? { height: ["30%", "100%", "45%", "80%", "30%"] } : { height: "30%" }}
          transition={playing ? { duration: 0.9 + i * 0.17, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ hooks

/** Position de lecture rafraîchie à chaque image tant que la musique joue. */
export function usePosition(): number {
  const status = useApp((s) => s.player.status);
  const stamp = useApp((s) => s.positionAt);
  const [pos, setPos] = useState(currentPosition());
  useEffect(() => {
    setPos(currentPosition());
    if (status !== "playing") return;
    let raf = 0;
    const tick = () => {
      setPos(currentPosition());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, stamp]);
  return pos;
}

export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Range({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  onCommit,
  label,
  className,
  accent,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  label: string;
  className?: string;
  accent?: boolean;
}) {
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      className={className}
      style={{ "--p": `${p}%`, "--range-fill": accent ? "var(--accent)" : undefined } as React.CSSProperties}
    />
  );
}
