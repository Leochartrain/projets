// Écran plein « En cours de lecture » : grande pochette, paroles synchronisées, file d'attente.
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, ChevronDown, ListMusic, Maximize2, MicVocal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useCompact } from "../lib/compact";
import { WEB } from "../lib/platform";
import { tintsFrom } from "../lib/color";
import { albumArtistOf, techLabel } from "../lib/library";
import { activeLine, parseLyrics, type Lyrics } from "../lib/lrc";
import { trackMenu } from "../lib/menus";
import { player } from "../lib/player";
import { useApp, useCurrentTrack } from "../lib/store";
import { SeekBar, Transport, VolumeControl } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";
import { Cover, cx, IconButton, LoveButton, softSpring, TrackQuality, usePosition } from "./ui";

// ------------------------------------------------------------------ paroles

function LyricsView({ trackId }: { trackId: number }) {
  const [lyrics, setLyrics] = useState<Lyrics | null | undefined>(undefined);
  const position = usePosition();
  const box = useRef<HTMLDivElement>(null);
  const hold = useRef(0);

  useEffect(() => {
    let alive = true;
    setLyrics(undefined);
    api
      .getLyrics(trackId)
      .then((raw) => alive && setLyrics(raw && raw.trim() ? parseLyrics(raw) : null))
      .catch(() => alive && setLyrics(null));
    return () => {
      alive = false;
    };
  }, [trackId]);

  // Léger décalage d'anticipation : la ligne s'allume juste avant d'être chantée.
  const active = lyrics?.synced ? activeLine(lyrics.lines, position + 250) : -1;

  useEffect(() => {
    if (active < 0 || performance.now() < hold.current) return;
    box.current?.querySelector(`[data-line="${active}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, lyrics]);

  if (lyrics === undefined) return null;
  if (lyrics === null)
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-ink-3">
        <MicVocal size={34} strokeWidth={1.4} />
        <p className="mt-3 text-[15px] font-medium text-ink-2">Pas de paroles pour ce morceau</p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed">Ajoutez-les dans les tags du fichier, ou déposez un fichier .lrc du même nom à côté du morceau.</p>
      </div>
    );

  return (
    <div
      ref={box}
      onWheel={() => (hold.current = performance.now() + 3500)}
      className="h-full overflow-y-auto px-2 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_82%,transparent)] [scrollbar-width:none]"
    >
      <div className="py-[38vh]">
        {lyrics.lines.map((l, i) => {
          const isActive = i === active;
          const past = lyrics.synced && i < active;
          return lyrics.synced ? (
            <button
              key={i}
              type="button"
              data-line={i}
              onClick={() => l.time !== null && player.seek(l.time)}
              style={{ opacity: isActive ? 1 : past ? 0.28 : 0.42, filter: isActive ? "none" : `blur(${Math.min(2.2, Math.abs(i - active) * 0.55)}px)`, transform: `scale(${isActive ? 1 : 0.94})` }}
              className={cx("lyric-line block w-full rounded-xl px-3 py-2.5 text-left text-[30px] font-bold leading-[1.22] tracking-tight hover:!opacity-80 hover:!blur-none", !l.text && "h-10")}
            >
              {l.text || "♪"}
            </button>
          ) : (
            <p key={i} className={cx("px-3 text-[22px] font-semibold leading-[1.5] text-ink/85", !l.text && "h-6")}>
              {l.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ visualiseur

export function Visualizer({ mode, height = 72 }: { mode: "bars" | "wave"; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let target: number[] = [];
    let level: number[] = [];
    let raf = 0;
    let lastData = 0;
    api.command("visualizer", 1);
    const un = listen<number[]>("player:spectrum", (e) => {
      target = e.payload;
      lastData = performance.now();
    });
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const n = target.length || 56;
      const stale = performance.now() - lastData > 300;
      // Montée rapide, retombée douce.
      for (let i = 0; i < n; i++) {
        const t = stale ? 0 : (target[i] ?? 0) / 255;
        const cur = level[i] ?? 0;
        level[i] = t > cur ? cur + (t - cur) * 0.55 : cur + (t - cur) * 0.12;
      }
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      if (mode === "bars") {
        const gap = 3;
        const bw = Math.max(2, (w - gap * (n - 1)) / n);
        for (let i = 0; i < n; i++) {
          const bh = Math.max(2, level[i] * h);
          ctx.beginPath();
          ctx.roundRect(i * (bw + gap), h - bh, bw, bh, Math.min(bw / 2, 3));
          ctx.fill();
        }
      } else {
        // Courbe lissée, en miroir autour du centre.
        const mid = h / 2;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * w;
          const px = i ? ((i - 1) / (n - 1)) * w : 0;
          const y = mid - level[i] * mid * 0.95;
          const py = i ? mid - level[i - 1] * mid * 0.95 : mid;
          ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
        }
        for (let i = n - 1; i >= 0; i--) {
          const x = (i / (n - 1)) * w;
          const nx = i < n - 1 ? ((i + 1) / (n - 1)) * w : w;
          const y = mid + level[i] * mid * 0.95;
          const ny = i < n - 1 ? mid + level[i + 1] * mid * 0.95 : mid;
          ctx.bezierCurveTo((nx + x) / 2, ny, (nx + x) / 2, y, x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      un.then((f) => f());
      api.command("visualizer", 0);
    };
  }, [mode]);
  return <canvas ref={ref} style={{ height }} className="w-full" aria-hidden />;
}

// ------------------------------------------------------------------ écran

export function NowPlaying() {
  const open = useApp((s) => s.nowPlaying);
  const track = useCurrentTrack();
  const covers = useApp((s) => s.covers);
  const visualizer = useApp((s) => s.settings.visualizer);
  const setSetting = useApp((s) => s.setSetting);
  const navigate = useApp((s) => s.navigate);
  const openMenu = useApp((s) => s.openMenu);
  const compact = useCompact();
  const [panel, setPanel] = useState<"lyrics" | "queue">("lyrics");
  // Téléphone : la pochette occupe l'écran, paroles et file d'attente la remplacent à la demande.
  const [side, setSide] = useState<"cover" | "lyrics" | "queue">("cover");
  const pick = (p: "lyrics" | "queue") => (compact ? setSide(side === p ? "cover" : p) : setPanel(p));
  const isOn = (p: "lyrics" | "queue") => (compact ? side === p : panel === p);
  const close = () => useApp.setState({ nowPlaying: false });

  const tints = useMemo(() => tintsFrom(track?.cover ? covers[track.cover] : undefined, true), [track?.cover, covers]);
  const deep = tints?.deep ?? ["#101014", "#2a1a22", "#1a2233"];

  return (
    <AnimatePresence>
      {open && track && (
        <motion.div
          data-theme="dark"
          role="dialog"
          aria-label="En cours de lecture"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden text-ink"
          style={{ background: deep[0], ["--accent" as string]: "#ffffff", ["--accent-fg" as string]: "#111113", ["--tint-1" as string]: deep[1], ["--tint-2" as string]: deep[2], ["--tint-opacity" as string]: 1 }}
        >
          <div className="ambient">
            <i />
            <i />
            <i />
          </div>

          <div className={compact ? "relative flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+8px)]" : "relative flex items-center justify-between px-5 pt-4"}>
            <IconButton label="Fermer (Échap)" size={36} onClick={close}>
              <ChevronDown size={22} />
            </IconButton>
            <div className="flex items-center gap-1">
              <IconButton label="Paroles" active={isOn("lyrics")} size={compact ? 42 : 36} onClick={() => pick("lyrics")}>
                <MicVocal size={18} />
              </IconButton>
              <IconButton label="File d'attente" active={isOn("queue")} size={compact ? 42 : 36} onClick={() => pick("queue")}>
                <ListMusic size={18} />
              </IconButton>
              <IconButton
                label="Visualiseur : désactivé, spectre ou onde"
                active={visualizer !== "off"}
                size={compact ? 42 : 36}
                onClick={() => setSetting("visualizer", visualizer === "off" ? "bars" : visualizer === "bars" ? "wave" : "off")}
              >
                <AudioLines size={18} />
              </IconButton>
              {!compact && !WEB && <IconButton label="Plein écran (F11)" size={36} onClick={async () => { const w = getCurrentWindow(); w.setFullscreen(!(await w.isFullscreen())); }}>
                <Maximize2 size={16} />
              </IconButton>}
            </div>
          </div>

          {compact ? (
            <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+18px)]">
              <div className="flex min-h-0 flex-1 items-center justify-center py-4">
                {side === "cover" ? (
                  <div className="aspect-square w-full max-w-[min(100%,46vh)]" onContextMenu={(e) => openMenu(e, trackMenu([track.id]))}>
                    <Cover id={track.cover} size={1000} layoutId="np-cover" rounded="rounded-[14px]" className="w-full shadow-[0_24px_60px_rgba(0,0,0,0.55)]" />
                  </div>
                ) : (
                  <div className="h-full w-full">{side === "lyrics" ? <LyricsView trackId={track.id} /> : <QueuePanel className="h-full" />}</div>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <motion.div key={track.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="min-w-0">
                  <h2 className="truncate text-[22px] font-bold tracking-tight">{track.title}</h2>
                  <button type="button" onClick={() => (close(), navigate({ name: "artist", param: albumArtistOf(track) }))} className="block max-w-full truncate text-left text-[16px] text-ink-2">
                    {track.artist || "Artiste inconnu"}
                  </button>
                </motion.div>
                <LoveButton track={track} size={42} />
              </div>
              <SeekBar big className="mt-3" />
              <div className="mt-2">
                <Transport big />
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-ink-3">
                <TrackQuality track={track} className="!bg-white/15 !text-white" />
                <span className="truncate">{techLabel(track)}</span>
              </div>
              {visualizer !== "off" && side === "cover" && (
                <div className="mt-3">
                  <Visualizer mode={visualizer} height={56} />
                </div>
              )}
            </div>
          ) : (
          <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-[5vw] px-[6vw] pb-8 pt-2">
            {/* Pochette et commandes */}
            <div className="flex min-h-0 flex-col items-center justify-center">
              <div className="w-full max-w-[min(46vh,520px)]" onContextMenu={(e) => openMenu(e, trackMenu([track.id]))}>
                <Cover id={track.cover} size={1000} layoutId="np-cover" rounded="rounded-[18px]" className="w-full shadow-[0_30px_80px_rgba(0,0,0,0.55)]" />
                <div className="mt-7 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <motion.div key={track.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[24px] font-bold tracking-tight">{track.title}</h2>
                        <TrackQuality track={track} className="!bg-white/15 !text-white" />
                      </div>
                      <button type="button" onClick={() => navigate({ name: "artist", param: albumArtistOf(track) })} className="block max-w-full truncate text-left text-[17px] text-ink-2 hover:underline">
                        {track.artist || "Artiste inconnu"}
                        {track.album && <span className="text-ink-3"> — {track.album}</span>}
                      </button>
                    </motion.div>
                  </div>
                  <LoveButton track={track} size={38} />
                </div>
                <SeekBar big className="mt-4" />
                <div className="mt-3">
                  <Transport big />
                </div>
                <div className="mt-4 flex items-center justify-between text-[11.5px] text-ink-3">
                  <span>
                    {[track.bpm ? `${Math.round(track.bpm)} BPM` : null, track.key, track.mood].filter(Boolean).join(" · ")}
                  </span>
                  <VolumeControl />
                </div>
                {visualizer !== "off" && (
                  <div className="mt-3">
                    <Visualizer mode={visualizer} />
                  </div>
                )}
              </div>
            </div>

            {/* Paroles ou file d'attente */}
            <div className="min-h-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={panel} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="h-full">
                  {panel === "lyrics" ? <LyricsView trackId={track.id} /> : <QueuePanel className="mx-auto h-full max-w-[560px] pt-6" />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
