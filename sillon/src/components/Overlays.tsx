// Menu contextuel, notifications et palette de commandes (Ctrl/Cmd+K).
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Disc3, Music, Search, User } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { searchTracks } from "../lib/library";
import { player } from "../lib/player";
import { useApp, type MenuItem, type Route } from "../lib/store";
import { Cover, cx, spring } from "./ui";

// ------------------------------------------------------------------ menu contextuel

function MenuList({ items, x, y, close, depth = 0 }: { items: MenuItem[]; x: number; y: number; close: () => void; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    // On garde le menu dans la fenêtre.
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: x + r.width > window.innerWidth - 8 ? Math.max(8, (depth ? x - r.width - 200 : window.innerWidth - r.width - 8)) : x,
      y: y + r.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - r.height - 8) : y,
    });
    if (!depth) el.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [x, y]);

  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(ref.current?.querySelectorAll<HTMLElement>(":scope > [role=menuitem]:not([disabled])") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") els[(i + 1) % els.length]?.focus();
    else if (e.key === "ArrowUp") els[(i - 1 + els.length) % els.length]?.focus();
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      onKeyDown={onKey}
      style={{ left: pos.x, top: pos.y, transformOrigin: "top left" }}
      className="glass-strong fixed z-[100] max-h-[70vh] min-w-[220px] overflow-y-auto rounded-[12px] border border-line p-1.5 shadow-[var(--shadow)]"
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="mx-2 my-1 h-px bg-line" />
        ) : (
          <button
            key={i}
            role="menuitem"
            type="button"
            disabled={it.disabled}
            onMouseEnter={(e) => {
              if (it.children) {
                const r = e.currentTarget.getBoundingClientRect();
                setSub({ index: i, x: r.right + 2, y: r.top - 6 });
              } else setSub(null);
            }}
            onClick={(e) => {
              if (it.children) {
                const r = e.currentTarget.getBoundingClientRect();
                setSub({ index: i, x: r.right + 2, y: r.top - 6 });
                return;
              }
              close();
              it.action?.();
            }}
            className={cx(
              "flex h-[30px] w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] outline-none hover:bg-accent hover:text-on-accent focus-visible:bg-accent focus-visible:text-on-accent disabled:opacity-40",
              it.danger && "text-red-500",
            )}
          >
            <span className="flex w-4 justify-center opacity-80">{it.checked ? <Check size={14} /> : it.icon}</span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.children && <ChevronRight size={14} className="opacity-60" />}
          </button>
        ),
      )}
      {sub && items[sub.index]?.children && <MenuList items={items[sub.index].children!} x={sub.x} y={sub.y} close={close} depth={depth + 1} />}
    </motion.div>
  );
}

export function ContextMenu() {
  const menu = useApp((s) => s.menu);
  const close = () => useApp.setState({ menu: null });
  return (
    <AnimatePresence>
      {menu && (
        <>
          <div className="fixed inset-0 z-[99]" onMouseDown={close} onContextMenu={(e) => (e.preventDefault(), close())} />
          <MenuList key={`${menu.x}-${menu.y}`} items={menu.items} x={menu.x} y={menu.y} close={close} />
        </>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ notifications

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[108px] z-[90] flex flex-col items-center gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={spring}
            className={cx("glass-strong max-w-[520px] rounded-full border border-line px-4 py-2 text-[13px] font-medium shadow-[var(--shadow)]", t.kind === "error" && "text-red-500")}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ fenêtre modale générique

export function Modal({ open, onClose, children, width = 560, label }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={spring}
            style={{ width, maxWidth: "100%" }}
            className="glass-strong rounded-[20px] border border-line shadow-[var(--shadow)]"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ palette de commandes

interface Command {
  key: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  cover?: string | null;
  run: () => void;
}

function staticCommands(): Command[] {
  const s = useApp.getState();
  const go = (label: string, route: Route): Command => ({ key: `go-${route.name}`, label: `Aller à : ${label}`, run: () => s.navigate(route) });
  return [
    { key: "toggle", label: "Lecture / pause", sub: "Espace", run: () => player.toggle() },
    { key: "next", label: "Morceau suivant", sub: "Ctrl+→", run: () => player.next() },
    { key: "prev", label: "Morceau précédent", sub: "Ctrl+←", run: () => player.previous() },
    { key: "shuffle", label: "Activer / désactiver la lecture aléatoire", sub: "S", run: () => player.toggleShuffle() },
    { key: "repeat", label: "Changer le mode de répétition", sub: "R", run: () => player.cycleRepeat() },
    { key: "shuffle-all", label: "Tout lire en aléatoire", run: () => player.playQueue(s.tracks.map((t) => t.id), 0, { shuffle: true }) },
    { key: "np", label: "Ouvrir « En cours de lecture »", sub: "F", run: () => s.set({ nowPlaying: true }) },
    { key: "queue", label: "Afficher la file d'attente", sub: "Q", run: () => s.set({ queueOpen: true }) },
    { key: "eq", label: "Ouvrir l'égaliseur", run: () => s.set({ eqOpen: true }) },
    { key: "mini", label: "Ouvrir le mini-lecteur", sub: "Ctrl+M", run: () => api.openMini() },
    { key: "sleep30", label: "Minuteur de veille : 30 minutes", run: () => api.sleep(1800, false) },
    { key: "sleep-end", label: "Minuteur de veille : à la fin du morceau", run: () => api.sleep(null, true) },
    { key: "sleep-off", label: "Désactiver le minuteur de veille", run: () => api.sleep(null, false) },
    { key: "rescan", label: "Rescanner la bibliothèque", run: () => (api.rescan(), s.toast("Scan lancé")) },
    { key: "theme-light", label: "Thème clair", run: () => s.setSetting("theme", "light") },
    { key: "theme-dark", label: "Thème sombre", run: () => s.setSetting("theme", "dark") },
    { key: "theme-auto", label: "Thème automatique", run: () => s.setSetting("theme", "auto") },
    go("Accueil", { name: "home" }),
    go("Albums", { name: "albums" }),
    go("Artistes", { name: "artists" }),
    go("Morceaux", { name: "tracks" }),
    go("Genres", { name: "genres" }),
    go("Playlists", { name: "playlists" }),
    go("Statistiques", { name: "stats" }),
    go("Réglages", { name: "settings" }),
    go("Doublons", { name: "duplicates" }),
  ];
}

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const close = () => useApp.setState({ paletteOpen: false });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
    }
  }, [open]);

  const results = useMemo<Command[]>(() => {
    if (!open) return [];
    const s = useApp.getState();
    const query = q.trim().toLowerCase();
    const cmds = staticCommands().filter((c) => !query || c.label.toLowerCase().includes(query));
    if (!query) return cmds.slice(0, 12);
    const out: Command[] = [];
    for (const a of s.artists) {
      if (out.length >= 3) break;
      if (a.name.toLowerCase().includes(query)) out.push({ key: `ar-${a.name}`, label: a.name, sub: "Artiste", icon: <User size={15} />, run: () => s.navigate({ name: "artist", param: a.name }) });
    }
    let n = 0;
    for (const al of s.albums) {
      if (n >= 4) break;
      if (al.title.toLowerCase().includes(query)) {
        n++;
        out.push({ key: `al-${al.key}`, label: al.title, sub: `Album · ${al.artist}`, cover: al.cover, icon: <Disc3 size={15} />, run: () => s.navigate({ name: "album", param: al.key }) });
      }
    }
    for (const hit of searchTracks(s.searchIndex, q, 7)) {
      const t = s.byId.get(hit.id)!;
      out.push({ key: `t-${t.id}`, label: t.title, sub: `Morceau · ${t.artist}`, cover: t.cover, icon: <Music size={15} />, run: () => player.playQueue([t.id], 0, { shuffle: false }) });
    }
    return [...cmds.slice(0, 5), ...out];
  }, [q, open]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (c?: Command) => {
    if (!c) return;
    close();
    c.run();
  };

  return (
    <Modal open={open} onClose={close} width={620} label="Palette de commandes">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={17} className="text-ink-3" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Une commande, un titre, un album, un artiste…"
          aria-label="Commande ou recherche"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(results.length - 1, s + 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
            else if (e.key === "Enter") run(results[sel]);
          }}
          className="h-[52px] flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
        />
      </div>
      <div ref={listRef} role="listbox" className="max-h-[420px] overflow-y-auto p-2">
        {results.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-ink-3">Aucun résultat</div>}
        {results.map((c, i) => (
          <button
            key={c.key}
            data-i={i}
            role="option"
            aria-selected={i === sel}
            type="button"
            onMouseMove={() => setSel(i)}
            onClick={() => run(c)}
            className={cx("flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13.5px]", i === sel && "bg-accent text-on-accent")}
          >
            {c.cover !== undefined ? (
              <Cover id={c.cover} size={96} className="h-7 w-7" rounded="rounded-[5px]" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center opacity-70">{c.icon ?? <ChevronRight size={15} />}</span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
            {c.sub && <span className={cx("shrink-0 text-[12px]", i === sel ? "opacity-75" : "text-ink-3")}>{c.sub}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
