// Navigation de la version téléphone : mini-lecteur au-dessus d'une barre d'onglets, page « Bibliothèque ».
import { motion } from "motion/react";
import { BarChart3, ChevronRight, Disc3, FolderPlus, Home, Library, ListMusic, Music, Pause, Play, Search, Settings, SkipForward, Tags, Users } from "lucide-react";
import { player } from "../lib/player";
import { useApp, useCurrentTrack, useRoute, type Route } from "../lib/store";
import { pickFolders } from "../views/Library";
import { setSearch } from "./Sidebar";
import { Button, Cover, cx, Heading, IconButton, usePosition } from "./ui";

const TABS: { route: Route["name"]; label: string; icon: typeof Home; match: Route["name"][] }[] = [
  { route: "home", label: "Accueil", icon: Home, match: ["home", "mix"] },
  { route: "more", label: "Bibliothèque", icon: Library, match: ["more", "albums", "album", "artists", "artist", "tracks", "genres", "genre", "stats", "settings", "duplicates"] },
  { route: "search", label: "Rechercher", icon: Search, match: ["search"] },
  { route: "playlists", label: "Playlists", icon: ListMusic, match: ["playlists", "playlist"] },
];

function MiniPlayer() {
  const track = useCurrentTrack();
  const status = useApp((s) => s.player.status);
  const duration = useApp((s) => s.player.duration_ms);
  const position = usePosition();
  const set = useApp((s) => s.set);
  if (!track) return null;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      role="region"
      aria-label="Lecteur"
      className="glass-strong relative mx-2 mb-1.5 overflow-hidden rounded-[16px] border border-line shadow-[var(--shadow)]"
    >
      <button type="button" aria-label="Ouvrir l'écran « En cours de lecture »" onClick={() => set({ nowPlaying: true })} className="flex w-full items-center gap-3 py-2 pl-2 pr-[92px] text-left">
        <Cover id={track.cover} size={96} layoutId="np-cover" className="h-11 w-11" rounded="rounded-[9px]" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{track.title}</span>
          <span className="block truncate text-[12.5px] text-ink-2">{track.artist || "Artiste inconnu"}</span>
        </span>
      </button>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        <IconButton label={status === "playing" ? "Pause" : "Lecture"} size={42} onClick={() => player.toggle()} className="!text-ink">
          {status === "playing" ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-[2px]" />}
        </IconButton>
        <IconButton label="Suivant" size={42} onClick={() => player.next()} className="!text-ink">
          <SkipForward size={20} fill="currentColor" />
        </IconButton>
      </div>
      <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-fill-2">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </motion.div>
  );
}

export function MobileNav() {
  const route = useRoute();
  const navigate = useApp((s) => s.navigate);
  const scan = useApp((s) => s.scan);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto">
        {scan && (
          <div role="status" className="glass-strong mx-2 mb-1.5 rounded-[12px] border border-line px-3 py-2 text-[12px] text-ink-2">
            Import des morceaux… {scan.total > 0 && <span className="tabular-nums">{scan.done} / {scan.total}</span>}
          </div>
        )}
        <MiniPlayer />
        <nav aria-label="Navigation principale" className="glass-strong flex border-t border-line pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => {
            const active = t.match.includes(route.name);
            return (
              <button
                key={t.route}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => (t.route === "search" ? setSearch(route.name === "search" ? (route.param ?? "") : "") : navigate({ name: t.route }))}
                className={cx("flex h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium", active ? "text-accent" : "text-ink-2")}
              >
                <t.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Champ de recherche en haut de l'écran « Rechercher » (téléphone). */
export function MobileSearchField() {
  const route = useRoute();
  return (
    <label className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-2 bg-base/80 px-4 py-2 backdrop-blur-xl">
      <span className="flex h-10 flex-1 items-center gap-2 rounded-[12px] bg-fill px-3 text-ink-2 focus-within:ring-2 focus-within:ring-accent/50">
        <Search size={17} />
        <input
          id="search-input"
          type="search"
          enterKeyHint="search"
          placeholder="Artistes, morceaux, albums, paroles"
          aria-label="Rechercher dans la bibliothèque"
          value={route.param ?? ""}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
        />
      </span>
    </label>
  );
}

const LINKS: { route: Route["name"]; label: string; icon: typeof Home }[] = [
  { route: "albums", label: "Albums", icon: Disc3 },
  { route: "artists", label: "Artistes", icon: Users },
  { route: "tracks", label: "Morceaux", icon: Music },
  { route: "genres", label: "Genres", icon: Tags },
  { route: "stats", label: "Statistiques", icon: BarChart3 },
  { route: "settings", label: "Réglages", icon: Settings },
];

/** Page « Bibliothèque » du téléphone : accès aux écrans que la barre latérale offre sur ordinateur. */
export function MoreView() {
  const navigate = useApp((s) => s.navigate);
  const tracks = useApp((s) => s.tracks.length);
  const albums = useApp((s) => s.albums.length);
  const scan = useApp((s) => s.scan);
  return (
    <>
      <Heading title="Bibliothèque" subtitle={`${tracks} morceau${tracks > 1 ? "x" : ""} · ${albums} album${albums > 1 ? "s" : ""}`} />
      <ul className="overflow-hidden rounded-[16px] bg-fill">
        {LINKS.map((l) => (
          <li key={l.route} className="border-b border-line last:border-0">
            <button type="button" onClick={() => navigate({ name: l.route })} className="flex h-[52px] w-full items-center gap-3 px-4 text-left text-[16px] active:bg-fill-2">
              <l.icon size={20} strokeWidth={1.9} className="text-accent" />
              <span className="flex-1">{l.label}</span>
              <ChevronRight size={18} className="text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button primary onClick={pickFolders} disabled={!!scan}>
          <FolderPlus size={16} /> {scan ? "Import en cours…" : "Importer des morceaux"}
        </Button>
      </div>
    </>
  );
}
