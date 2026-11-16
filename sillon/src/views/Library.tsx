// Écrans de la bibliothèque : Accueil, Albums, Artistes, Morceaux, Genres, Recherche.
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { motion } from "motion/react";
import { Disc3, FolderPlus, Play, Search as SearchIcon, SlidersHorizontal, Sparkles, Tags, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, coverUrl, type RuleSet, type Track } from "../lib/api";
import { formatDuration, normalize, plural, qualityOf, searchTracks, splitGenres, type Album } from "../lib/library";
import { albumMenu } from "../lib/menus";
import { player } from "../lib/player";
import { WEB } from "../lib/platform";
import { useCompact } from "../lib/compact";
import { MobileSearchField } from "../components/MobileNav";
import { buildMixes, evaluate, weekKey, type Mix } from "../lib/smart";
import { getApp, useApp } from "../lib/store";
import { AlbumCard, AlbumGrid, DetailHeader, Shelf } from "../components/AlbumCard";
import { RuleEditor } from "../components/RuleEditor";
import { TrackList } from "../components/TrackList";
import { Button, Cover, cx, Empty, Heading, QualityBadge, Section, Segmented, softSpring, useDebounced } from "../components/ui";

export async function pickFolders() {
  const picked = await openDialog({ directory: true, multiple: true, title: "Choisir un ou plusieurs dossiers de musique" });
  const list = Array.isArray(picked) ? picked : picked ? [picked] : [];
  for (const path of list) {
    try {
      await api.addFolder(path);
    } catch (e) {
      getApp().toast(String(e), "error");
    }
  }
  return list.length;
}

// ------------------------------------------------------------------ mix

/** Les mix sont régénérés une fois par semaine (et complétés quand l'analyse audio avance). */
export async function ensureMixes(force = false) {
  const s = getApp();
  if (!s.tracks.length) return;
  const week = weekKey();
  const stored = s.settings.mixes;
  const filled = stored ? stored.mixes.filter((m) => m.ids.length >= 5).length : 0;
  const analysed = s.tracks.some((t) => t.energy !== null);
  if (!force && stored && stored.week === week && (filled >= 4 || !analysed)) return;
  const now = Math.floor(Date.now() / 1000);
  const month = await api.getStats(now - 30 * 86400, now + 60).catch(() => null);
  const top = (month?.top_tracks ?? []).map((t) => t.track_id).filter((id): id is number => id !== null);
  s.setSetting("mixes", { week, mixes: buildMixes(s.tracks, top, week) });
}

const MIX_GRADIENT: Record<string, string> = {
  rediscover: "from-[#7b4bff] to-[#ff5fa2]",
  heavy: "from-[#ff3b5c] to-[#ff9a3c]",
  calm: "from-[#2bb3c0] to-[#3a6ff0]",
  energy: "from-[#ff7a1a] to-[#ffcc33]",
  focus: "from-[#3a4a6b] to-[#6f86b8]",
};

function MixCard({ mix }: { mix: Mix }) {
  const byId = useApp((s) => s.byId);
  const navigate = useApp((s) => s.navigate);
  const covers = useMemo(() => {
    const out: string[] = [];
    for (const id of mix.ids) {
      const c = byId.get(id)?.cover;
      if (c && !out.includes(c)) out.push(c);
      if (out.length === 4) break;
    }
    return out;
  }, [mix, byId]);
  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      transition={softSpring}
      onClick={() => navigate({ name: "mix", param: mix.id })}
      className={cx("group relative h-[190px] !w-[300px] overflow-hidden rounded-[18px] bg-gradient-to-br p-5 text-left text-white shadow-[var(--shadow-cover)]", MIX_GRADIENT[mix.id])}
    >
      <div className="absolute -right-6 -top-6 grid w-[170px] rotate-[10deg] grid-cols-2 gap-1.5 opacity-90">
        {covers.map((c) => (
          <img key={c} src={coverUrl(c, 320)} alt="" draggable={false} className="aspect-square w-full rounded-[10px] object-cover shadow-lg" />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <div className="relative flex h-full flex-col justify-end">
        <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Mix de la semaine</div>
        <div className="text-[24px] font-bold leading-tight tracking-tight">{mix.title}</div>
        <div className="text-[12.5px] opacity-85">{mix.subtitle}</div>
      </div>
    </motion.button>
  );
}

export function MixView({ id }: { id: string }) {
  const mix = useApp((s) => s.settings.mixes?.mixes.find((m) => m.id === id));
  const byId = useApp((s) => s.byId);
  if (!mix) return <Empty icon={<Sparkles />} title="Mix introuvable" />;
  const ids = mix.ids.filter((i) => byId.has(i));
  const duration = ids.reduce((n, i) => n + (byId.get(i)?.duration_ms ?? 0), 0);
  return (
    <>
      <DetailHeader
        coverNode={<div className={cx("flex h-[232px] w-[232px] items-end rounded-[16px] bg-gradient-to-br p-5 text-[26px] font-bold leading-tight text-white shadow-[var(--shadow)]", MIX_GRADIENT[mix.id])}>{mix.title}</div>}
        kicker="Mix généré automatiquement"
        title={mix.title}
        subtitle={mix.subtitle}
        meta={<span>{plural(ids.length, "titre", "titres")} · {formatDuration(duration)} · renouvelé chaque semaine</span>}
        ids={ids}
        extra={<Button onClick={() => ensureMixes(true)}>Régénérer</Button>}
      />
      {ids.length ? <TrackList ids={ids} /> : <Empty icon={<Sparkles />} title="Pas encore assez de matière" text="Ce mix se remplira quand l'analyse audio aura avancé et que vous aurez écouté quelques morceaux." />}
    </>
  );
}

// ------------------------------------------------------------------ accueil

export function Home() {
  const albums = useApp((s) => s.albums);
  const tracks = useApp((s) => s.tracks);
  const loaded = useApp((s) => s.loaded);
  const scan = useApp((s) => s.scan);
  const mixes = useApp((s) => s.settings.mixes);

  useEffect(() => {
    ensureMixes();
  }, [tracks.length]);

  const recent = useMemo(() => [...albums].filter((a) => a.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 14), [albums]);
  const added = useMemo(() => [...albums].sort((a, b) => b.addedAt - a.addedAt).slice(0, 18), [albums]);
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  if (loaded && !tracks.length) {
    return (
      <Empty
        icon={<Disc3 size={30} />}
        title={scan ? "Lecture de votre musique…" : "Bienvenue dans Sillon"}
        text={scan ? "Les morceaux apparaîtront ici au fur et à mesure." : WEB ? "Importez des morceaux depuis ce téléphone (FLAC, MP3, AAC…). Ils sont copiés dans l'application et lisibles sans réseau : aucun compte, aucun envoi." : "Choisissez le ou les dossiers qui contiennent votre musique. Tout reste sur cet ordinateur : aucun compte, aucun envoi."}
        action={
          !scan && (
            <Button primary onClick={pickFolders}>
              <FolderPlus size={16} /> {WEB ? "Importer des morceaux" : "Choisir un dossier de musique"}
            </Button>
          )
        }
      />
    );
  }

  const shown = (mixes?.mixes ?? []).filter((m) => m.ids.length >= 5);
  return (
    <>
      <Heading
        title={hello}
        subtitle={`${plural(tracks.length, "morceau", "morceaux")} · ${plural(albums.length, "album", "albums")}`}
        right={
          <Button primary onClick={() => player.playQueue(tracks.map((t) => t.id), 0, { shuffle: true })}>
            <Play size={15} fill="currentColor" /> Tout lire en aléatoire
          </Button>
        }
      />
      {recent.length > 0 && (
        <Section title="Écoutés récemment">
          <Shelf>
            {recent.map((a) => (
              <AlbumCard key={a.key} album={a} zoom={!added.includes(a)} />
            ))}
          </Shelf>
        </Section>
      )}
      {shown.length > 0 && (
        <Section title="Vos mix">
          <Shelf>
            {shown.map((m) => (
              <MixCard key={m.id} mix={m} />
            ))}
          </Shelf>
        </Section>
      )}
      <Section title="Ajouts récents">
        <AlbumGrid albums={added} />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ albums

const ALBUM_SORTS = {
  artist: { label: "Artiste", fn: (a: Album, b: Album) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0) },
  title: { label: "Titre", fn: (a: Album, b: Album) => a.title.localeCompare(b.title) },
  year: { label: "Année", fn: (a: Album, b: Album) => (b.year ?? 0) - (a.year ?? 0) },
  added: { label: "Ajout récent", fn: (a: Album, b: Album) => b.addedAt - a.addedAt },
  plays: { label: "Les plus écoutés", fn: (a: Album, b: Album) => b.plays - a.plays },
};

export function Albums() {
  const albums = useApp((s) => s.albums);
  const [sort, setSort] = useState<keyof typeof ALBUM_SORTS>("artist");
  const [quality, setQuality] = useState<"all" | "lossless" | "hires">("all");
  const list = useMemo(
    () => albums.filter((a) => quality === "all" || a.quality === "hires" || (quality === "lossless" && a.quality === "lossless")).sort(ALBUM_SORTS[sort].fn),
    [albums, sort, quality],
  );
  return (
    <>
      <Heading
        title="Albums"
        subtitle={plural(list.length, "album", "albums")}
        right={
          <>
            <Segmented id="album-quality" value={quality} onChange={setQuality} options={[{ value: "all", label: "Tous" }, { value: "lossless", label: "Lossless" }, { value: "hires", label: "Hi-Res" }]} />
            <select aria-label="Trier les albums" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof ALBUM_SORTS)} className="h-[34px] rounded-[10px] bg-fill px-3 text-[13px] font-medium outline-none">
              {Object.entries(ALBUM_SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </>
        }
      />
      {list.length ? <AlbumGrid albums={list} /> : <Empty icon={<Disc3 />} title="Aucun album" />}
    </>
  );
}

export function AlbumDetail({ albumKey }: { albumKey: string }) {
  const album = useApp((s) => s.albumByKey.get(albumKey));
  const byId = useApp((s) => s.byId);
  const artist = useApp((s) => (album ? s.artistByName.get(album.artist) : undefined));
  const albumByKey = useApp((s) => s.albumByKey);
  const navigate = useApp((s) => s.navigate);
  if (!album) return <Empty icon={<Disc3 />} title="Album introuvable" text="Il a peut-être été renommé ou retiré de la bibliothèque." />;

  const discs = new Map<number, number[]>();
  for (const id of album.trackIds) {
    const d = byId.get(id)?.disc_no ?? 1;
    discs.set(d, [...(discs.get(d) ?? []), id]);
  }
  const first = byId.get(album.trackIds[0]);
  const others = (artist?.albumKeys ?? []).filter((k) => k !== album.key).map((k) => albumByKey.get(k)!).filter(Boolean);

  return (
    <>
      <DetailHeader
        cover={album.cover}
        layoutId={`cover-${album.key}`}
        kicker="Album"
        title={album.title}
        subtitle={album.artist}
        onSubtitle={() => navigate({ name: "artist", param: album.artist })}
        meta={
          <>
            <span>{[album.genre, album.year, plural(album.trackIds.length, "titre", "titres"), formatDuration(album.duration)].filter(Boolean).join(" · ")}</span>
            <QualityBadge quality={album.quality} />
            {first && album.quality !== "lossy" && <span className="text-ink-3">{first.format} {first.bit_depth} bits / {first.sample_rate / 1000} kHz</span>}
          </>
        }
        ids={album.trackIds}
        menu={albumMenu(album)}
      />
      {[...discs.entries()].sort((a, b) => a[0] - b[0]).map(([disc, ids]) => (
        <div key={disc} className="mb-6">
          {discs.size > 1 && <div className="mb-2 px-3 text-[13px] font-semibold text-ink-2">Disque {disc}</div>}
          <TrackList ids={ids} variant="album" albumArtist={album.artist} />
        </div>
      ))}
      {others.length > 0 && (
        <div className="mt-12">
          <Section title={`Autres albums de ${album.artist}`}>
            <AlbumGrid albums={others} subtitle={(a) => String(a.year ?? "")} />
          </Section>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ artistes

export function Artists() {
  const artists = useApp((s) => s.artists);
  const navigate = useApp((s) => s.navigate);
  return (
    <>
      <Heading title="Artistes" subtitle={plural(artists.length, "artiste", "artistes")} />
      {!artists.length && <Empty icon={<Users />} title="Aucun artiste" />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">
        {artists.map((a) => (
          <button key={a.name} type="button" onClick={() => navigate({ name: "artist", param: a.name })} className="card-lazy group flex min-w-0 flex-col items-center rounded-[14px] text-center">
            <Cover id={a.cover} round layoutId={`artist-${a.name}`} className="cover-shadow w-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]" />
            <div className="mt-2.5 w-full truncate text-[13.5px] font-semibold">{a.name}</div>
            <div className="text-[12px] text-ink-2">{a.albumKeys.length ? plural(a.albumKeys.length, "album", "albums") : plural(a.trackIds.length, "titre", "titres")}</div>
          </button>
        ))}
      </div>
    </>
  );
}

export function ArtistDetail({ name }: { name: string }) {
  const artist = useApp((s) => s.artistByName.get(name));
  const byId = useApp((s) => s.byId);
  const albumByKey = useApp((s) => s.albumByKey);
  const [all, setAll] = useState(false);
  if (!artist) return <Empty icon={<Users />} title="Artiste introuvable" />;
  const tracks = artist.trackIds.map((id) => byId.get(id)!).filter(Boolean);
  const popular = [...tracks].sort((a, b) => b.play_count - a.play_count || Number(b.loved) - Number(a.loved) || b.rating - a.rating).slice(0, 5).map((t) => t.id);
  const albums = artist.albumKeys.map((k) => albumByKey.get(k)!).filter(Boolean).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const duration = tracks.reduce((n, t) => n + t.duration_ms, 0);
  return (
    <>
      <DetailHeader
        cover={artist.cover}
        layoutId={`artist-${artist.name}`}
        round
        kicker="Artiste"
        title={artist.name}
        meta={<span>{plural(albums.length, "album", "albums")} · {plural(tracks.length, "titre", "titres")} · {formatDuration(duration)}{artist.plays ? ` · ${plural(artist.plays, "écoute", "écoutes")}` : ""}</span>}
        ids={artist.trackIds}
      />
      <Section title="Morceaux populaires" right={<button type="button" onClick={() => setAll(!all)} className="text-[13px] font-medium text-accent hover:underline">{all ? "Réduire" : "Tout afficher"}</button>}>
        <TrackList ids={all ? artist.trackIds : popular} sortable={all} />
      </Section>
      {albums.length > 0 && (
        <Section title="Albums">
          <AlbumGrid albums={albums} subtitle={(a) => String(a.year ?? "")} />
        </Section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ morceaux

type TrackFilter = "all" | "loved" | "hires" | "lossless" | "lyrics";

export function Tracks() {
  const tracks = useApp((s) => s.tracks);
  const [filter, setFilter] = useState<TrackFilter>("all");
  const ids = useMemo(() => {
    const keep = (t: Track) =>
      filter === "all" || (filter === "loved" && t.loved) || (filter === "hires" && qualityOf(t) === "hires") || (filter === "lossless" && qualityOf(t) !== "lossy") || (filter === "lyrics" && t.has_lyrics);
    return tracks.filter(keep).sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.disc_no ?? 1) - (b.disc_no ?? 1) || (a.track_no ?? 0) - (b.track_no ?? 0)).map((t) => t.id);
  }, [tracks, filter]);
  const duration = useMemo(() => tracks.reduce((n, t) => n + t.duration_ms, 0), [tracks]);
  return (
    <>
      <Heading
        title="Morceaux"
        subtitle={`${plural(ids.length, "morceau", "morceaux")}${filter === "all" ? ` · ${formatDuration(duration)}` : ""}`}
        right={
          <Segmented
            id="track-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tous" },
              { value: "loved", label: "Aimés" },
              { value: "lossless", label: "Lossless" },
              { value: "hires", label: "Hi-Res" },
              { value: "lyrics", label: "Avec paroles" },
            ]}
          />
        }
      />
      {ids.length ? <TrackList ids={ids} sortable /> : <Empty icon={<Disc3 />} title="Aucun morceau" />}
    </>
  );
}

// ------------------------------------------------------------------ genres

export function Genres() {
  const genres = useApp((s) => s.genres);
  const navigate = useApp((s) => s.navigate);
  return (
    <>
      <Heading title="Genres" subtitle={plural(genres.length, "genre", "genres")} />
      {!genres.length && <Empty icon={<Tags />} title="Aucun genre" text="Les genres viennent des tags de vos fichiers." />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {genres.map((g) => (
          <motion.button key={g.name} type="button" whileHover={{ y: -3 }} transition={softSpring} onClick={() => navigate({ name: "genre", param: g.name })} className="card-lazy relative h-[120px] overflow-hidden rounded-[16px] bg-fill p-4 text-left">
            <div className="absolute -right-3 -top-3 grid w-[120px] rotate-[8deg] grid-cols-2 gap-1 opacity-90">
              {g.covers.map((c) => (
                <img key={c} src={coverUrl(c, 96)} alt="" draggable={false} loading="lazy" className="aspect-square w-full rounded-[7px] object-cover" />
              ))}
            </div>
            <div className="relative flex h-full flex-col justify-end">
              <div className="text-[18px] font-bold tracking-tight">{g.name}</div>
              <div className="text-[12px] text-ink-2">{plural(g.trackIds.length, "titre", "titres")}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </>
  );
}

export function GenreDetail({ name }: { name: string }) {
  const genre = useApp((s) => s.genres.find((g) => g.name === name));
  const albums = useApp((s) => s.albums);
  const byId = useApp((s) => s.byId);
  if (!genre) return <Empty icon={<Tags />} title="Genre introuvable" />;
  const list = albums.filter((a) => a.trackIds.some((id) => splitGenres(byId.get(id)?.genre ?? "").includes(name)));
  return (
    <>
      <DetailHeader
        coverNode={<div className="flex h-[180px] w-[180px] items-center justify-center rounded-[16px] bg-[var(--accent-soft)] text-accent"><Tags size={64} strokeWidth={1.3} /></div>}
        kicker="Genre"
        title={genre.name}
        meta={<span>{plural(list.length, "album", "albums")} · {plural(genre.trackIds.length, "titre", "titres")}</span>}
        ids={genre.trackIds}
      />
      {list.length > 0 && (
        <Section title="Albums">
          <AlbumGrid albums={list} />
        </Section>
      )}
      <Section title="Morceaux">
        <TrackList ids={genre.trackIds} sortable />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ recherche

export function Search({ query }: { query: string }) {
  const index = useApp((s) => s.searchIndex);
  const tracks = useApp((s) => s.tracks);
  const byId = useApp((s) => s.byId);
  const albumsAll = useApp((s) => s.albums);
  const artistsAll = useApp((s) => s.artists);
  const navigate = useApp((s) => s.navigate);
  const [filters, setFilters] = useState<RuleSet | null>(null);
  const [lyricIds, setLyricIds] = useState<number[]>([]);
  const q = useDebounced(query, 90);
  const nq = normalize(q);

  useEffect(() => {
    let alive = true;
    if (nq.length < 3) return setLyricIds([]);
    const t = setTimeout(() => api.searchLyrics(q).then((ids) => alive && setLyricIds(ids)).catch(() => {}), 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const ids = useMemo(() => {
    let list: Track[];
    if (nq) list = searchTracks(index, q, 400).map((h) => byId.get(h.id)!).filter(Boolean);
    else if (filters) list = tracks;
    else return [];
    if (filters) {
      const allowed = new Set(evaluate({ ...filters, limit: 0, sort: nq ? "none" : "default" }, list).map((t) => t.id));
      if (nq) list = list.filter((t) => allowed.has(t.id));
      else list = evaluate({ ...filters, limit: 0, sort: "default" }, list);
    }
    return list.map((t) => t.id);
  }, [q, index, filters, tracks]);

  const albums = useMemo(() => (nq ? albumsAll.filter((a) => nq.split(" ").every((w) => normalize(`${a.title} ${a.artist}`).includes(w))).slice(0, 12) : []), [nq, albumsAll]);
  const artists = useMemo(() => (nq ? artistsAll.filter((a) => nq.split(" ").every((w) => normalize(a.name).includes(w))).slice(0, 8) : []), [nq, artistsAll]);
  const idSet = new Set(ids);
  const onlyLyrics = lyricIds.filter((id) => !idSet.has(id) && byId.has(id));
  const nothing = !ids.length && !albums.length && !artists.length && !onlyLyrics.length;
  const compact = useCompact();

  return (
    <>
      {compact && <MobileSearchField />}
      <Heading
        title={nq ? `« ${query.trim()} »` : "Recherche"}
        subtitle={nq || filters ? plural(ids.length, "morceau trouvé", "morceaux trouvés") : "Titres, artistes, albums, paroles — les fautes de frappe sont tolérées."}
        right={
          <Button onClick={() => setFilters(filters ? null : { match: "all", rules: [{ field: "quality", op: "is", value: "" }], limit: 0, sort: "default" })} className={filters ? "!bg-[var(--accent-soft)] !text-accent" : ""}>
            <SlidersHorizontal size={14} /> Filtres
          </Button>
        }
      />
      {filters && (
        <div className="mb-7 rounded-[16px] bg-fill p-4">
          <RuleEditor value={filters} onChange={setFilters} compact />
        </div>
      )}
      {nothing && <Empty icon={<SearchIcon />} title={nq || filters ? "Aucun résultat" : "Que voulez-vous écouter ?"} text={nq || filters ? "Essayez un autre mot, ou retirez un filtre." : compact ? "Tapez dans le champ ci-dessus, ou ouvrez les filtres." : "Tapez dans le champ de recherche (Ctrl+F), ou ouvrez les filtres."} />}
      {artists.length > 0 && (
        <Section title="Artistes">
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => (
              <button key={a.name} type="button" onClick={() => navigate({ name: "artist", param: a.name })} className="flex items-center gap-2.5 rounded-full bg-fill py-1.5 pl-1.5 pr-4 text-[13.5px] font-medium hover:bg-fill-2">
                <Cover id={a.cover} size={96} round className="h-8 w-8" />
                {a.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      {albums.length > 0 && (
        <Section title="Albums">
          <Shelf>
            {albums.map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </Shelf>
        </Section>
      )}
      {ids.length > 0 && (
        <Section title="Morceaux">
          <TrackList ids={ids} sortable />
        </Section>
      )}
      {onlyLyrics.length > 0 && (
        <Section title="Dans les paroles">
          <TrackList ids={onlyLyrics} />
        </Section>
      )}
    </>
  );
}
