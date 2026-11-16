// Barre de lecture flottante, en verre dépoli, en bas de la fenêtre.
import { motion } from "motion/react";
import { ListMusic, MicVocal, Moon, Pause, PictureInPicture2, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Volume1, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { albumArtistOf, formatRate, formatTime, techLabel } from "../lib/library";
import { trackMenu } from "../lib/menus";
import { player } from "../lib/player";
import { useApp, useCurrentTrack } from "../lib/store";
import { Cover, cx, IconButton, LoveButton, Range, spring, TrackQuality, usePosition } from "./ui";

export function SeekBar({ className, big }: { className?: string; big?: boolean }) {
  const duration = useApp((s) => s.player.duration_ms);
  const position = usePosition();
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? position;
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <span className={cx("w-10 text-right tabular-nums text-ink-3", big ? "text-[12px]" : "text-[11px]")}>{formatTime(value)}</span>
      <Range
        label="Position dans le morceau"
        className="min-w-0 flex-1"
        value={Math.min(value, duration || 1)}
        max={duration || 1}
        step={250}
        onChange={setDrag}
        onCommit={(v) => {
          player.seek(v);
          setDrag(null);
        }}
      />
      <span className={cx("w-10 tabular-nums text-ink-3", big ? "text-[12px]" : "text-[11px]")}>{formatTime(duration)}</span>
    </div>
  );
}

export function Transport({ big }: { big?: boolean }) {
  const status = useApp((s) => s.player.status);
  const shuffle = useApp((s) => s.shuffle);
  const repeat = useApp((s) => s.repeat);
  const k = big ? 1.25 : 1;
  return (
    <div className={cx("flex items-center justify-center", big ? "gap-4" : "gap-1.5")}>
      <IconButton label="Lecture aléatoire (S)" active={shuffle} size={30 * k} onClick={() => player.toggleShuffle()}>
        <Shuffle size={15 * k} />
      </IconButton>
      <IconButton label="Précédent" size={34 * k} onClick={() => player.previous()} className="!text-ink">
        <SkipBack size={18 * k} fill="currentColor" />
      </IconButton>
      <motion.button
        type="button"
        aria-label={status === "playing" ? "Pause (Espace)" : "Lecture (Espace)"}
        onClick={() => player.toggle()}
        whileTap={{ scale: 0.9 }}
        transition={spring}
        style={{ width: 40 * k, height: 40 * k }}
        className="flex items-center justify-center rounded-full bg-ink text-on-ink hover:scale-[1.04]"
      >
        {status === "playing" ? <Pause size={18 * k} fill="currentColor" /> : <Play size={18 * k} fill="currentColor" className="ml-[2px]" />}
      </motion.button>
      <IconButton label="Suivant" size={34 * k} onClick={() => player.next()} className="!text-ink">
        <SkipForward size={18 * k} fill="currentColor" />
      </IconButton>
      <IconButton label={repeat === "one" ? "Répéter le titre (R)" : repeat === "all" ? "Répéter tout (R)" : "Répétition désactivée (R)"} active={repeat !== "off"} size={30 * k} onClick={() => player.cycleRepeat()}>
        {repeat === "one" ? <Repeat1 size={15 * k} /> : <Repeat size={15 * k} />}
      </IconButton>
    </div>
  );
}

export function VolumeControl({ className }: { className?: string }) {
  const volume = useApp((s) => s.settings.volume);
  const muted = useApp((s) => s.settings.muted);
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className={cx("flex items-center gap-1", className)}>
      <IconButton label={muted ? "Rétablir le son (M)" : "Couper le son (M)"} size={30} onClick={() => player.toggleMute()}>
        <Icon size={16} />
      </IconButton>
      <Range label="Volume" className="w-[88px]" value={muted ? 0 : volume} onChange={(v) => player.setVolume(v)} />
    </div>
  );
}

const SLEEP = [
  { label: "15 minutes", s: 15 * 60 },
  { label: "30 minutes", s: 30 * 60 },
  { label: "45 minutes", s: 45 * 60 },
  { label: "1 heure", s: 3600 },
  { label: "2 heures", s: 7200 },
];

export function sleepMenu() {
  const p = useApp.getState().player;
  return [
    ...SLEEP.map((o) => ({ label: o.label, action: () => api.sleep(o.s, false) })),
    { label: "À la fin du morceau", checked: p.sleep_end_of_track, action: () => api.sleep(null, true) },
    { separator: true },
    { label: "Désactiver le minuteur", disabled: p.sleep_remaining === null && !p.sleep_end_of_track, action: () => api.sleep(null, false) },
  ];
}

export function PlayerBar() {
  const track = useCurrentTrack();
  const p = useApp((s) => s.player);
  const queueOpen = useApp((s) => s.queueOpen);
  const nowPlaying = useApp((s) => s.nowPlaying);
  const set = useApp((s) => s.set);
  const openMenu = useApp((s) => s.openMenu);
  const navigate = useApp((s) => s.navigate);
  const sleeping = p.sleep_remaining !== null || p.sleep_end_of_track;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-4">
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring}
        role="region"
        aria-label="Lecteur"
        className="glass-strong pointer-events-auto mx-auto grid h-[76px] max-w-[1500px] grid-cols-[minmax(0,1fr)_minmax(320px,1.4fr)_minmax(0,1fr)] items-center gap-4 rounded-[22px] border border-line px-3 shadow-[var(--shadow)]"
      >
        {/* Morceau en cours */}
        <div className="flex min-w-0 items-center gap-3" onContextMenu={(e) => track && openMenu(e, trackMenu([track.id]))}>
          <button type="button" aria-label="Ouvrir l'écran « En cours de lecture »" onClick={() => track && set({ nowPlaying: true })} className="rounded-[10px]">
            {!nowPlaying && <Cover id={track?.cover} size={96} layoutId="np-cover" className="h-[52px] w-[52px]" rounded="rounded-[10px]" />}
            {nowPlaying && <div className="h-[52px] w-[52px]" />}
          </button>
          {track ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => track.album && navigate({ name: "album", param: `${albumArtistOf(track)}\u001f${track.album}` })} className="truncate text-[13.5px] font-semibold hover:underline">
                  {track.title}
                </button>
                <TrackQuality track={track} />
              </div>
              <button type="button" onClick={() => navigate({ name: "artist", param: albumArtistOf(track) })} className="block max-w-full truncate text-left text-[12.5px] text-ink-2 hover:underline">
                {track.artist || "Artiste inconnu"}
              </button>
              <div className="truncate text-[10.5px] text-ink-3" title={p.device ? `Sortie : ${p.device}` : undefined}>
                {techLabel(track)}
                {p.out_rate > 0 && (p.resampled ? ` → ${formatRate(p.out_rate)}` : p.dsp_active ? " · égaliseur" : " · fréquence native")}
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-ink-3">Rien en lecture</div>
          )}
          {track && <LoveButton track={track} />}
        </div>

        {/* Commandes */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <Transport />
          <SeekBar />
        </div>

        {/* Outils */}
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label="Minuteur de mise en veille" active={sleeping} onClick={(e) => openMenu(e, sleepMenu())}>
            <Moon size={16} />
          </IconButton>
          {sleeping && <span className="mr-1 text-[11px] tabular-nums text-accent">{p.sleep_end_of_track ? "fin du titre" : `${Math.ceil((p.sleep_remaining ?? 0) / 60)} min`}</span>}
          <IconButton label="Égaliseur" active={p.dsp_active} onClick={() => set({ eqOpen: true })}>
            <SlidersHorizontal size={16} />
          </IconButton>
          <IconButton label="Paroles (F)" onClick={() => track && set({ nowPlaying: true })} disabled={!track}>
            <MicVocal size={16} />
          </IconButton>
          <IconButton label="File d'attente (Q)" active={queueOpen} onClick={() => set({ queueOpen: !queueOpen })}>
            <ListMusic size={16} />
          </IconButton>
          <IconButton label="Mini-lecteur (Ctrl+M)" onClick={() => api.openMini()}>
            <PictureInPicture2 size={16} />
          </IconButton>
          <VolumeControl className="ml-1 hidden lg:flex" />
        </div>
      </motion.div>
    </div>
  );
}
