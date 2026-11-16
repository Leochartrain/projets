// Liste de morceaux virtualisée, triable, avec sélection multiple et navigation clavier.
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, MicVocal } from "lucide-react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Track } from "../lib/api";
import { formatTime, qualityOf } from "../lib/library";
import { trackMenu } from "../lib/menus";
import { player } from "../lib/player";
import { useApp, type MenuItem } from "../lib/store";
import { Cover, cx, Equalizer, LoveButton, QualityBadge, useScrollParent, useWidth } from "./ui";
import { useCompact } from "../lib/compact";

type SortKey = "title" | "artist" | "album" | "duration" | "plays" | "added" | "year" | "bpm" | "quality";

const COMPARE: Record<SortKey, (a: Track, b: Track) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  artist: (a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.track_no ?? 0) - (b.track_no ?? 0),
  album: (a, b) => a.album.localeCompare(b.album) || (a.disc_no ?? 1) - (b.disc_no ?? 1) || (a.track_no ?? 0) - (b.track_no ?? 0),
  duration: (a, b) => a.duration_ms - b.duration_ms,
  plays: (a, b) => a.play_count - b.play_count,
  added: (a, b) => a.added_at - b.added_at,
  year: (a, b) => (a.year ?? 0) - (b.year ?? 0),
  bpm: (a, b) => (a.bpm ?? 0) - (b.bpm ?? 0),
  quality: (a, b) => a.bit_depth * 1e6 + a.sample_rate - (b.bit_depth * 1e6 + b.sample_rate),
};

const ROW = 52;

interface Props {
  ids: number[];
  /** "album" : numéros de piste, pas de pochette ni de colonne album. */
  variant?: "full" | "album";
  sortable?: boolean;
  /** Entrées de menu supplémentaires (ex. retirer de la playlist). */
  extraMenu?: (id: number, index: number) => MenuItem[];
  albumArtist?: string;
}

export function TrackList({ ids, variant = "full", sortable, extraMenu, albumArtist }: Props) {
  const byId = useApp((s) => s.byId);
  const currentId = useApp((s) => s.player.track_id);
  const playing = useApp((s) => s.player.status === "playing");
  const selection = useApp((s) => s.selection);
  const scrollRef = useScrollParent();
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [margin, setMargin] = useState(0);
  const anchor = useRef<number | null>(null);

  const rows = useMemo(() => {
    const list = ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
    if (sort) list.sort((a, b) => COMPARE[sort.key](a, b) * sort.dir);
    return list;
  }, [ids, byId, sort]);
  const order = useMemo(() => rows.map((t) => t.id), [rows]);
  // Les lignes sont mémoïsées : leurs rappels lisent l'ordre et la sélection à jour par référence.
  const orderRef = useRef(order);
  orderRef.current = order;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const sc = scrollRef.current;
    if (el && sc) setMargin(el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop);
  }, [width, ids.length]);

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW,
    overscan: 12,
    scrollMargin: margin,
  });

  const wide = width > 860;
  const medium = width > 620;
  const narrow = width > 0 && width < 480;
  const compact = useCompact();
  const full = variant === "full";

  const select = (e: React.MouseEvent | React.KeyboardEvent, index: number) => {
    const order = orderRef.current;
    const selection = useApp.getState().selection;
    const id = order[index];
    let next: Set<number>;
    if (e.shiftKey && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      next = new Set(order.slice(a, b + 1));
    } else if (e.ctrlKey || e.metaKey) {
      next = new Set(selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = index;
    } else {
      next = new Set([id]);
      anchor.current = index;
    }
    useApp.setState({ selection: next });
  };

  const onKey = (e: React.KeyboardEvent, index: number) => {
    const order = orderRef.current;
    if (e.key === "Enter") {
      e.preventDefault();
      player.playQueue(order, index, { shuffle: false });
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(0, Math.min(order.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
      select(e, n);
      virt.scrollToIndex(n);
      requestAnimationFrame(() => wrapRef.current?.querySelector<HTMLElement>(`[data-row="${n}"]`)?.focus());
    } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      useApp.setState({ selection: new Set(order) });
    }
  };

  const head = (key: SortKey, label: string, className?: string) => (
    <button
      type="button"
      disabled={!sortable}
      onClick={() => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null))}
      className={cx("flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wider", sort?.key === key ? "text-ink" : "text-ink-3", sortable && "hover:text-ink", className)}
    >
      {label}
      {sort?.key === key && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );

  const grid = full
    ? wide
      ? "grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)_84px_56px]"
      : medium
        ? "grid-cols-[minmax(0,5fr)_minmax(0,3fr)_84px_56px]"
        : "grid-cols-[minmax(0,1fr)_56px]"
    : narrow
      ? "grid-cols-[26px_minmax(0,1fr)_48px]"
      : "grid-cols-[34px_minmax(0,1fr)_84px_56px]";

  return (
    <div ref={wrapRef} role="grid" aria-rowcount={rows.length}>
      {(sortable || full) && (
        <div className={cx("grid items-center gap-3 border-b border-line px-3 pb-2", grid)}>
          {!full && <span className="text-center text-[11px] font-semibold text-ink-3">#</span>}
          {head("title", "Titre", full ? "pl-[52px]" : undefined)}
          {full && medium && head("artist", "Artiste")}
          {full && wide && head("album", "Album")}
          {(medium || (!full && !narrow)) && head("quality", "Qualité")}
          {head("duration", "Durée", "justify-end")}
        </div>
      )}
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((v) => {
          const t = rows[v.index];
          return (
            <Row
              key={t.id}
              track={t}
              index={v.index}
              top={v.start - margin}
              grid={grid}
              full={full}
              wide={wide}
              medium={medium}
              current={t.id === currentId}
              playing={playing}
              selected={selection.has(t.id)}
              showArtist={!full && !!albumArtist && t.artist !== albumArtist && !!t.artist}
              onSelect={compact ? (_e, i) => player.playQueue(orderRef.current, i, { shuffle: false }) : select}
              narrow={narrow}
              onKey={onKey}
              onPlay={() => player.playQueue(orderRef.current, v.index, { shuffle: false })}
              onMenu={(e) => {
                let sel = useApp.getState().selection;
                if (!sel.has(t.id)) {
                  sel = new Set([t.id]);
                  useApp.setState({ selection: sel });
                }
                const picked = orderRef.current.filter((id) => sel.has(id));
                useApp.getState().openMenu(e, trackMenu(picked, picked.length === 1 && extraMenu ? extraMenu(t.id, v.index) : []));
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface RowProps {
  track: Track;
  index: number;
  top: number;
  grid: string;
  full: boolean;
  wide: boolean;
  medium: boolean;
  narrow: boolean;
  current: boolean;
  playing: boolean;
  selected: boolean;
  showArtist: boolean;
  onSelect: (e: React.MouseEvent, index: number) => void;
  onKey: (e: React.KeyboardEvent, index: number) => void;
  onPlay: () => void;
  onMenu: (e: React.MouseEvent) => void;
}

const Row = memo(
  function Row({ track: t, index, top, grid, full, wide, medium, narrow, current, playing, selected, showArtist, onSelect, onKey, onPlay, onMenu }: RowProps) {
    return (
      <div
        role="row"
        data-row={index}
        tabIndex={0}
        aria-selected={selected}
        onClick={(e) => onSelect(e, index)}
        onDoubleClick={onPlay}
        onContextMenu={onMenu}
        onKeyDown={(e) => onKey(e, index)}
        style={{ position: "absolute", top, left: 0, right: 0, height: ROW }}
        className={cx(
          "group grid items-center gap-3 rounded-[10px] px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          grid,
          selected ? "bg-[var(--accent-soft)]" : "hover:bg-fill",
        )}
      >
        {!full && (
          <span className="flex justify-center text-[13px] tabular-nums text-ink-3">
            {current ? <Equalizer playing={playing} /> : (t.track_no ?? "–")}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-3">
          {full && (
            <div className="relative">
              <Cover id={t.cover} size={96} className="h-10 w-10" rounded="rounded-[6px]" />
              {current && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/45">
                  <Equalizer playing={playing} />
                </div>
              )}
            </div>
          )}
          <div className="min-w-0">
            <div className={cx("flex items-center gap-1.5 truncate font-medium", current && "text-accent")}>
              <span className="truncate">{t.title}</span>
              {t.has_lyrics && <MicVocal size={12} className="shrink-0 text-ink-3" aria-label="Paroles disponibles" />}
            </div>
            {((full && !medium) || showArtist) && <div className="truncate text-[12px] text-ink-2">{t.artist}</div>}
          </div>
        </div>
        {full && medium && <div className="truncate text-ink-2">{t.artist}</div>}
        {full && wide && <div className="truncate text-ink-2">{t.album}</div>}
        {(medium || (!full && !narrow)) && (
          <div className="flex items-center">
            <QualityBadge quality={qualityOf(t)} />
            {qualityOf(t) === "lossy" && <span className="text-[11px] text-ink-3">{t.format}</span>}
          </div>
        )}
        <div className="relative flex items-center justify-end">
          <span className="tabular-nums text-ink-3 group-hover:opacity-0">{formatTime(t.duration_ms)}</span>
          <span className="absolute right-[-4px] opacity-0 group-hover:opacity-100">
            <LoveButton track={t} size={28} />
          </span>
        </div>
      </div>
    );
  },
  (a, b) =>
    a.track === b.track &&
    a.top === b.top &&
    a.index === b.index &&
    a.current === b.current &&
    a.selected === b.selected &&
    a.grid === b.grid &&
    a.showArtist === b.showArtist &&
    (!a.current || a.playing === b.playing),
);
