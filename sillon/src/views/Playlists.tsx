// Playlists manuelles et playlists intelligentes à règles.
import { ArrowDown, ArrowUp, ListMusic, ListPlus, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, coverUrl, type Playlist, type RuleSet } from "../lib/api";
import { formatDuration, plural } from "../lib/library";
import { emptyRules, evaluate } from "../lib/smart";
import { useApp } from "../lib/store";
import { DetailHeader } from "../components/AlbumCard";
import { RuleEditor } from "../components/RuleEditor";
import { TrackList } from "../components/TrackList";
import { Button, cx, Empty, Heading } from "../components/ui";

function usePlaylistIds(p: Playlist | undefined): number[] {
  const tracks = useApp((s) => s.tracks);
  const byId = useApp((s) => s.byId);
  return useMemo(() => {
    if (!p) return [];
    if (p.kind === "smart" && p.rules) return evaluate(p.rules, tracks).map((t) => t.id);
    return p.track_ids.filter((id) => byId.has(id));
  }, [p, tracks]);
}

function Mosaic({ ids, smart, className }: { ids: number[]; smart: boolean; className?: string }) {
  const byId = useApp((s) => s.byId);
  const covers = useMemo(() => {
    const out: string[] = [];
    for (const id of ids) {
      const c = byId.get(id)?.cover;
      if (c && !out.includes(c)) out.push(c);
      if (out.length === 4) break;
    }
    return out;
  }, [ids, byId]);
  return (
    <div className={cx("grid aspect-square shrink-0 overflow-hidden rounded-[14px] bg-fill", covers.length >= 4 ? "grid-cols-2" : "grid-cols-1", className)}>
      {covers.length === 0 ? (
        <div className="flex items-center justify-center text-ink-3">{smart ? <Sparkles size="34%" strokeWidth={1.3} /> : <ListMusic size="34%" strokeWidth={1.3} />}</div>
      ) : (
        (covers.length >= 4 ? covers : covers.slice(0, 1)).map((c) => <img key={c} src={coverUrl(c, 320)} alt="" draggable={false} loading="lazy" className="h-full w-full object-cover" />)
      )}
    </div>
  );
}

function Card({ p }: { p: Playlist }) {
  const ids = usePlaylistIds(p);
  const navigate = useApp((s) => s.navigate);
  return (
    <button type="button" onClick={() => navigate({ name: "playlist", param: String(p.id) })} className="group min-w-0 rounded-[14px] text-left">
      <Mosaic ids={ids} smart={p.kind === "smart"} className="cover-shadow w-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.025]" />
      <div className="mt-2.5 truncate text-[13.5px] font-semibold">{p.name}</div>
      <div className="text-[12.5px] text-ink-2">
        {p.kind === "smart" ? "Intelligente · " : ""}
        {plural(ids.length, "titre", "titres")}
      </div>
    </button>
  );
}

export async function createPlaylist(kind: "manual" | "smart") {
  const s = useApp.getState();
  const n = s.playlists.filter((p) => p.kind === kind).length + 1;
  const name = kind === "smart" ? `Playlist intelligente ${n}` : `Nouvelle playlist ${n}`;
  const id = await api.savePlaylist(null, name, kind, kind === "smart" ? emptyRules() : null);
  await s.refreshPlaylists();
  s.navigate({ name: "playlist", param: String(id) });
}

export function Playlists() {
  const playlists = useApp((s) => s.playlists);
  return (
    <>
      <Heading
        title="Playlists"
        subtitle={plural(playlists.length, "playlist", "playlists")}
        right={
          <>
            <Button onClick={() => createPlaylist("smart")}>
              <Sparkles size={15} /> Playlist intelligente
            </Button>
            <Button primary onClick={() => createPlaylist("manual")}>
              <ListPlus size={15} /> Nouvelle playlist
            </Button>
          </>
        }
      />
      {playlists.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-7">
          {playlists.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty icon={<ListMusic />} title="Aucune playlist" text="Créez une playlist à la main, ou une playlist intelligente qui se remplit toute seule selon vos règles (genre, année, note, tempo, format…)." />
      )}
    </>
  );
}

export function PlaylistDetail({ id }: { id: number }) {
  const playlist = useApp((s) => s.playlists.find((p) => p.id === id));
  const byId = useApp((s) => s.byId);
  const refresh = useApp((s) => s.refreshPlaylists);
  const back = useApp((s) => s.back);
  const toast = useApp((s) => s.toast);
  const ids = usePlaylistIds(playlist);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<RuleSet>(emptyRules());

  useEffect(() => {
    if (!playlist) return;
    setName(playlist.name);
    setRules(playlist.rules ?? emptyRules());
    // Une playlist intelligente toute neuve s'ouvre directement en édition.
    setEditing(playlist.kind === "smart" && playlist.created_at === playlist.updated_at);
  }, [playlist?.id]);

  if (!playlist) return <Empty icon={<ListMusic />} title="Playlist introuvable" />;
  const smart = playlist.kind === "smart";
  const duration = ids.reduce((n, i) => n + (byId.get(i)?.duration_ms ?? 0), 0);
  const preview = smart && editing ? evaluate(rules, useApp.getState().tracks).length : ids.length;

  const save = async () => {
    await api.savePlaylist(playlist.id, name.trim() || playlist.name, playlist.kind, smart ? rules : null);
    await refresh();
    setEditing(false);
  };
  const remove = async () => {
    await api.deletePlaylist(playlist.id);
    await refresh();
    toast(`« ${playlist.name} » supprimée`);
    back();
  };
  const reorder = async (next: number[]) => {
    await api.setPlaylistTracks(playlist.id, next);
    await refresh();
  };
  const move = (index: number, delta: number) => {
    const next = [...ids];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    reorder(next);
  };

  return (
    <>
      <DetailHeader
        coverNode={<Mosaic ids={ids} smart={smart} className="w-[232px] shadow-[var(--shadow)]" />}
        kicker={smart ? "Playlist intelligente" : "Playlist"}
        title={playlist.name}
        meta={<span>{plural(ids.length, "titre", "titres")} · {formatDuration(duration)}{smart ? " · mise à jour automatiquement" : ""}</span>}
        ids={ids}
        extra={
          <Button onClick={() => setEditing(!editing)}>
            <Pencil size={14} /> {smart ? "Modifier les règles" : "Renommer"}
          </Button>
        }
        menu={[{ label: "Supprimer la playlist", icon: <Trash2 size={15} />, danger: true, action: remove }]}
      />

      {editing && (
        <div className="mb-8 rounded-[18px] bg-fill p-5">
          <label className="mb-4 flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-ink-2">Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className="h-9 max-w-md rounded-[9px] bg-elev px-3 text-[14px] outline-none ring-1 ring-line focus:ring-2 focus:ring-accent/60" />
          </label>
          {smart && <RuleEditor value={rules} onChange={setRules} />}
          <div className="mt-4 flex items-center gap-3">
            <Button primary onClick={save}>
              Enregistrer
            </Button>
            <Button onClick={() => setEditing(false)}>Annuler</Button>
            {smart && <span className="text-[12.5px] text-ink-2">{plural(preview, "morceau correspond", "morceaux correspondent")} à ces règles</span>}
          </div>
        </div>
      )}

      {ids.length ? (
        <TrackList
          ids={ids}
          sortable={smart}
          extraMenu={
            smart
              ? undefined
              : (tid, index) => [
                  { label: "Monter", icon: <ArrowUp size={15} />, disabled: index === 0, action: () => move(index, -1) },
                  { label: "Descendre", icon: <ArrowDown size={15} />, disabled: index === ids.length - 1, action: () => move(index, 1) },
                  { label: "Retirer de la playlist", icon: <X size={15} />, danger: true, action: () => reorder(ids.filter((x, i) => !(x === tid && i === index))) },
                ]
          }
        />
      ) : (
        <Empty
          icon={smart ? <Sparkles /> : <ListMusic />}
          title={smart ? "Aucun morceau ne correspond" : "Playlist vide"}
          text={smart ? "Assouplissez les règles pour voir apparaître des morceaux." : "Clic droit sur un morceau ou un album, puis « Ajouter à une playlist »."}
        />
      )}
    </>
  );
}
