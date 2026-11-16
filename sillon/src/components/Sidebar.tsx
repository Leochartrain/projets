import { motion } from "motion/react";
import { BarChart3, ChevronLeft, ChevronRight, Disc3, Home, ListMusic, Music, Search, Settings, Sparkles, Tags, Users } from "lucide-react";
import { useRef } from "react";
import { useApp, useRoute, type Route } from "../lib/store";
import { cx, IconButton, spring } from "./ui";

const NAV: { route: Route["name"]; label: string; icon: typeof Home; match: Route["name"][] }[] = [
  { route: "home", label: "Accueil", icon: Home, match: ["home", "mix"] },
  { route: "albums", label: "Albums", icon: Disc3, match: ["albums", "album"] },
  { route: "artists", label: "Artistes", icon: Users, match: ["artists", "artist"] },
  { route: "tracks", label: "Morceaux", icon: Music, match: ["tracks"] },
  { route: "genres", label: "Genres", icon: Tags, match: ["genres", "genre"] },
  { route: "playlists", label: "Playlists", icon: ListMusic, match: ["playlists"] },
  { route: "stats", label: "Statistiques", icon: BarChart3, match: ["stats"] },
  { route: "settings", label: "Réglages", icon: Settings, match: ["settings", "duplicates"] },
];

export function setSearch(q: string) {
  const s = useApp.getState();
  const cur = s.routes[s.routeIndex];
  if (cur.name === "search") {
    const routes = [...s.routes];
    routes[s.routeIndex] = { name: "search", param: q };
    useApp.setState({ routes });
  } else {
    s.navigate({ name: "search", param: q });
  }
}

export function Sidebar() {
  const route = useRoute();
  const navigate = useApp((s) => s.navigate);
  const playlists = useApp((s) => s.playlists);
  const scan = useApp((s) => s.scan);
  const analysis = useApp((s) => s.analysis);
  const canBack = useApp((s) => s.routeIndex > 0);
  const canForward = useApp((s) => s.routeIndex < s.routes.length - 1);
  const input = useRef<HTMLInputElement>(null);

  return (
    <nav aria-label="Navigation principale" className="glass relative z-10 flex w-[236px] shrink-0 flex-col border-r border-line pb-[100px]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-on-accent shadow-sm">
            <Disc3 size={17} strokeWidth={2.2} />
          </div>
          <span className="text-[17px] font-bold tracking-tight">Sillon</span>
        </div>
        <div className="flex">
          <IconButton label="Précédent (Alt+←)" size={26} disabled={!canBack} onClick={() => useApp.getState().back()}>
            <ChevronLeft size={17} />
          </IconButton>
          <IconButton label="Suivant (Alt+→)" size={26} disabled={!canForward} onClick={() => useApp.getState().forward()}>
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </div>

      <div className="px-3 pb-2 pt-1">
        <label className="flex h-8 items-center gap-2 rounded-[9px] bg-fill px-2.5 text-ink-2 focus-within:ring-2 focus-within:ring-accent/50">
          <Search size={14} />
          <input
            ref={input}
            id="search-input"
            type="search"
            placeholder="Rechercher"
            aria-label="Rechercher dans la bibliothèque"
            value={route.name === "search" ? (route.param ?? "") : ""}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => route.name !== "search" && setSearch("")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-[2px]">
          {NAV.map((n) => {
            const active = n.match.includes(route.name);
            return (
              <li key={n.route}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate({ name: n.route })}
                  className={cx("relative flex h-[34px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] font-medium", active ? "text-ink" : "text-ink-2 hover:bg-fill hover:text-ink")}
                >
                  {active && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-[9px] bg-fill-2" />}
                  <n.icon size={17} strokeWidth={1.9} className={cx("relative", active && "text-accent")} />
                  <span className="relative">{n.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {playlists.length > 0 && (
          <>
            <div className="mb-1 mt-5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Playlists</div>
            <ul className="space-y-[2px]">
              {playlists.map((p) => {
                const active = route.name === "playlist" && route.param === String(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ name: "playlist", param: String(p.id) })}
                      className={cx("flex h-[32px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px]", active ? "bg-fill-2 text-ink" : "text-ink-2 hover:bg-fill hover:text-ink")}
                    >
                      {p.kind === "smart" ? <Sparkles size={15} className="shrink-0" /> : <ListMusic size={15} className="shrink-0" />}
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {(scan || analysis) && (
        <div className="border-t border-line px-4 py-3 text-[11.5px] text-ink-2" role="status">
          {scan ? (
            <>
              <div className="mb-1.5 flex justify-between">
                <span>{scan.phase === "walk" ? "Recherche des fichiers…" : "Lecture des morceaux…"}</span>
                {scan.total > 0 && <span className="tabular-nums">{scan.done} / {scan.total}</span>}
              </div>
              <Bar value={scan.total ? scan.done / scan.total : 0} />
            </>
          ) : (
            analysis && (
              <>
                <div className="mb-1.5 flex justify-between">
                  <span>Analyse audio…</span>
                  <span className="tabular-nums">{analysis.remaining} restants</span>
                </div>
                <Bar value={analysis.done / Math.max(1, analysis.done + analysis.remaining)} />
              </>
            )
          )}
        </div>
      )}
    </nav>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-fill-2">
      <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.3 }} />
    </div>
  );
}
