// Mini-lecteur flottant, toujours au premier plan. La fenêtre principale garde la main
// sur la file d'attente : celle-ci ne fait qu'afficher l'état et envoyer des commandes.
import { emit, listen } from "@tauri-apps/api/event";
import { Maximize2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, coverUrl, setCoversDir, type PlayerState, type Track } from "./lib/api";

const send = (action: string) => emit("remote", { action });

export default function Mini() {
  const [state, setState] = useState<PlayerState | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const tracks = useRef(new Map<number, Track>());
  const stamp = useRef(0);
  const bar = useRef<HTMLDivElement>(null);
  const latest = useRef<PlayerState | null>(null);

  useEffect(() => {
    const load = async () => {
      const lib = await api.getLibrary();
      setCoversDir(lib.covers_dir);
      tracks.current = new Map(lib.tracks.map((t) => [t.id, t]));
      const id = latest.current?.track_id;
      if (id != null) setTrack(tracks.current.get(id) ?? null);
    };
    load();
    api.getSettings().then((s) => {
      const theme = s.theme as string | undefined;
      const dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    });
    const un = [
      listen<PlayerState>("player:state", (e) => {
        latest.current = e.payload;
        stamp.current = performance.now();
        setState(e.payload);
        setTrack(e.payload.track_id !== null ? (tracks.current.get(e.payload.track_id) ?? null) : null);
      }),
      listen("library:changed", load),
    ];
    // Barre de progression fluide, sans redessiner tout le composant.
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = latest.current;
      if (!s || !bar.current || !s.duration_ms) return;
      const pos = s.position_ms + (s.status === "playing" ? performance.now() - stamp.current : 0);
      bar.current.style.width = `${Math.min(100, (pos / s.duration_ms) * 100)}%`;
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      un.forEach((u) => u.then((f) => f()));
    };
  }, []);

  const playing = state?.status === "playing";
  const cover = coverUrl(track?.cover, 320);
  const btn = "flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/15 active:scale-90 transition";

  return (
    <div data-theme="dark" data-tauri-drag-region className="relative flex h-full items-center gap-3 overflow-hidden bg-[#18181b] px-3 text-white">
      {cover && <img src={cover} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-55 blur-2xl" />}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className="pointer-events-none relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[12px] bg-white/10 shadow-lg">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
      </div>
      <div data-tauri-drag-region className="relative min-w-0 flex-1">
        <div data-tauri-drag-region className="truncate text-[14px] font-semibold">{track?.title ?? "Rien en lecture"}</div>
        <div data-tauri-drag-region className="truncate text-[12.5px] text-white/70">{track?.artist ?? "Sillon"}</div>
        <div className="mt-1.5 flex items-center gap-0.5">
          <button type="button" aria-label="Précédent" className={btn} onClick={() => send("previous")}>
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button type="button" aria-label={playing ? "Pause" : "Lecture"} className={btn} onClick={() => send("toggle")}>
            {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-[2px]" />}
          </button>
          <button type="button" aria-label="Suivant" className={btn} onClick={() => send("next")}>
            <SkipForward size={17} fill="currentColor" />
          </button>
          <span className="flex-1" data-tauri-drag-region />
          <button type="button" aria-label="Revenir à la fenêtre principale" title="Revenir à la fenêtre principale" className={btn} onClick={() => api.closeMini()}>
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <div ref={bar} className="h-full bg-white/85" style={{ width: 0 }} />
      </div>
    </div>
  );
}
