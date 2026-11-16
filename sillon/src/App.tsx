import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { tintsFrom } from "./lib/color";
import { initPlayer, player } from "./lib/player";
import { useApp, useCurrentTrack, useRoute, type Route } from "./lib/store";
import { EqPanel, TagEditor } from "./components/Dialogs";
import { NowPlaying } from "./components/NowPlaying";
import { CommandPalette, ContextMenu, Toasts } from "./components/Overlays";
import { PlayerBar } from "./components/PlayerBar";
import { QueuePanel } from "./components/QueuePanel";
import { Sidebar } from "./components/Sidebar";
import { MobileNav, MoreView } from "./components/MobileNav";
import { useCompact } from "./lib/compact";
import { ScrollContext, spring } from "./components/ui";
import { AlbumDetail, Albums, ArtistDetail, Artists, GenreDetail, Genres, Home, MixView, Search, Tracks } from "./views/Library";
import { PlaylistDetail, Playlists } from "./views/Playlists";
import { Duplicates, Settings } from "./views/Settings";
import { Stats } from "./views/Stats";

function View({ route }: { route: Route }) {
  const p = route.param ?? "";
  switch (route.name) {
    case "home":
      return <Home />;
    case "albums":
      return <Albums />;
    case "album":
      return <AlbumDetail albumKey={p} />;
    case "artists":
      return <Artists />;
    case "artist":
      return <ArtistDetail name={p} />;
    case "tracks":
      return <Tracks />;
    case "genres":
      return <Genres />;
    case "genre":
      return <GenreDetail name={p} />;
    case "playlists":
      return <Playlists />;
    case "playlist":
      return <PlaylistDetail id={Number(p)} />;
    case "mix":
      return <MixView id={p} />;
    case "stats":
      return <Stats />;
    case "settings":
      return <Settings />;
    case "duplicates":
      return <Duplicates />;
    case "search":
      return <Search query={p} />;
    case "more":
      return <MoreView />;
  }
}

const SECTIONS: Route["name"][] = ["home", "albums", "artists", "tracks", "genres", "playlists", "stats", "settings"];

function useSystemDark(): boolean {
  const mq = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [dark, setDark] = useState(mq.matches);
  useEffect(() => {
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "k") {
        e.preventDefault();
        s.set({ paletteOpen: !s.paletteOpen });
        return;
      }
      if (e.key === "Escape") {
        if (s.menu) s.set({ menu: null });
        else if (s.paletteOpen || s.eqOpen || s.tagEditor) return; // géré par la fenêtre modale
        else if (s.nowPlaying) s.set({ nowPlaying: false });
        else if (s.queueOpen) s.set({ queueOpen: false });
        else if (typing) el.blur();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        const w = getCurrentWindow();
        w.isFullscreen().then((f) => w.setFullscreen(!f));
        return;
      }
      if (s.paletteOpen || s.tagEditor) return;
      if (mod && (key === "f" || key === "l")) {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
        return;
      }
      if (mod && key === "m") return void (e.preventDefault(), api.openMini());
      if (mod && e.key === ",") return void (e.preventDefault(), s.navigate({ name: "settings" }));
      if (mod && /^[1-8]$/.test(e.key)) return void (e.preventDefault(), s.navigate({ name: SECTIONS[Number(e.key) - 1] }));
      if (mod && e.key === "ArrowRight") return void (e.preventDefault(), player.next());
      if (mod && e.key === "ArrowLeft") return void (e.preventDefault(), player.previous());
      if (mod && e.key === "ArrowUp") return void (e.preventDefault(), player.setVolume(s.settings.volume + 0.05));
      if (mod && e.key === "ArrowDown") return void (e.preventDefault(), player.setVolume(s.settings.volume - 0.05));
      if (e.altKey && e.key === "ArrowLeft") return void (e.preventDefault(), s.back());
      if (e.altKey && e.key === "ArrowRight") return void (e.preventDefault(), s.forward());
      if (typing || mod || e.altKey) return;

      // Touches simples : seulement hors des champs de saisie.
      const focusedRow = el.getAttribute("role") === "row";
      const onControl = el.tagName === "BUTTON" || el.getAttribute("role") === "menuitem";
      switch (key) {
        case " ":
          if (onControl) return;
          e.preventDefault();
          player.toggle();
          break;
        case "arrowright":
          if (!focusedRow) player.seekBy(5000);
          break;
        case "arrowleft":
          if (!focusedRow) player.seekBy(-5000);
          break;
        case "m":
          player.toggleMute();
          break;
        case "s":
          player.toggleShuffle();
          break;
        case "r":
          player.cycleRepeat();
          break;
        case "l":
          if (s.player.track_id !== null) player.toggleLoved(s.player.track_id);
          break;
        case "f":
          if (s.player.track_id !== null) s.set({ nowPlaying: !s.nowPlaying });
          break;
        case "q":
          s.set({ queueOpen: !s.queueOpen });
          break;
        case "/":
          e.preventDefault();
          document.getElementById("search-input")?.focus();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const scrollMemory = new Map<string, number>();

export default function App() {
  const route = useRoute();
  const routeIndex = useApp((s) => s.routeIndex);
  const settings = useApp((s) => s.settings);
  const covers = useApp((s) => s.covers);
  const queueOpen = useApp((s) => s.queueOpen);
  const nowPlaying = useApp((s) => s.nowPlaying);
  const track = useCurrentTrack();
  const systemDark = useSystemDark();
  const compact = useCompact();
  const scroll = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initPlayer().catch((e) => useApp.getState().toast(`Démarrage : ${e}`, "error"));
  }, []);
  useShortcuts();

  const dark = settings.theme === "dark" || (settings.theme === "auto" && systemDark);
  const reduce = settings.reduceMotion;

  // Thème, option « réduire les animations » et teintes de la pochette en cours.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.reduceMotion = String(reduce);
    const tints = settings.dynamicColors ? tintsFrom(track?.cover ? covers[track.cover] : undefined, dark) : null;
    for (const [name, value] of [
      ["--accent", tints?.accent],
      ["--accent-fg", tints?.accentFg],
      ["--tint-1", tints?.tint1],
      ["--tint-2", tints?.tint2],
    ] as const) {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
  }, [dark, reduce, settings.dynamicColors, track?.cover, covers]);

  // Chaque page retrouve sa position de défilement quand on y revient.
  const routeKey = `${routeIndex}:${route.name}:${route.name === "search" ? "" : (route.param ?? "")}`;
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scrollMemory.get(routeKey) ?? 0;
  }, [routeKey]);

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <ScrollContext.Provider value={scroll}>
        <div className="relative flex h-full overflow-hidden bg-base" onContextMenu={(e) => e.preventDefault()}>
          <div className="ambient">
            <i />
            <i />
            <i />
          </div>
          {!compact && <Sidebar />}
          <main
            ref={scroll}
            onScroll={(e) => scrollMemory.set(routeKey, e.currentTarget.scrollTop)}
            className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
            inert={nowPlaying}
          >
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={compact ? "px-4 pb-[170px] pt-[calc(env(safe-area-inset-top)+20px)]" : "mx-auto max-w-[1500px] px-8 pb-[132px] pt-8"}
            >
              <View route={route} />
            </motion.div>
          </main>

          <AnimatePresence>
            {queueOpen && !nowPlaying && (
              <motion.aside
                aria-label="File d'attente"
                initial={{ x: 380, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 380, opacity: 0 }}
                transition={spring}
                className={compact ? "glass-strong absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+40px)] z-40 flex flex-col rounded-t-[22px] border border-line pt-3 shadow-[var(--shadow)]" : "glass-strong absolute bottom-[108px] right-4 top-4 z-20 flex w-[348px] flex-col rounded-[20px] border border-line pt-3 shadow-[var(--shadow)]"}
              >
                <QueuePanel className="h-full" />
              </motion.aside>
            )}
          </AnimatePresence>

          {compact ? <MobileNav /> : <PlayerBar />}
          <NowPlaying />
          <EqPanel />
          <TagEditor />
          <CommandPalette />
          <Toasts />
          <ContextMenu />
        </div>
      </ScrollContext.Provider>
    </MotionConfig>
  );
}
