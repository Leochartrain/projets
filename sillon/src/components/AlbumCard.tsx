// Carte d'album, grille de pochettes et en-tête des pages de détail.
import { motion } from "motion/react";
import { MoreHorizontal, Play, Radio, Shuffle } from "lucide-react";
import { memo, type ReactNode } from "react";
import type { Album } from "../lib/library";
import { albumMenu } from "../lib/menus";
import { player } from "../lib/player";
import { useApp, type MenuItem } from "../lib/store";
import { Button, Cover, cx, IconButton, QualityBadge, spring } from "./ui";

export const AlbumCard = memo(function AlbumCard({ album, subtitle, zoom = true }: { album: Album; subtitle?: string; zoom?: boolean }) {
  const navigate = useApp((s) => s.navigate);
  const openMenu = useApp((s) => s.openMenu);
  return (
    <div className="card-lazy group min-w-0" onContextMenu={(e) => openMenu(e, albumMenu(album))}>
      <div className="relative">
        <button type="button" aria-label={`Ouvrir l'album ${album.title}, ${album.artist}`} onClick={() => navigate({ name: "album", param: album.key })} className="block w-full rounded-[12px]">
          <Cover id={album.cover} layoutId={zoom ? `cover-${album.key}` : undefined} rounded="rounded-[12px]" className="cover-shadow w-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.025]" />
        </button>
        <motion.button
          type="button"
          aria-label={`Lire ${album.title}`}
          onClick={() => player.playQueue(album.trackIds, 0, { shuffle: false })}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          className="glass-strong absolute bottom-2.5 right-2.5 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full text-ink opacity-0 shadow-lg transition-all duration-200 hover:scale-105 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play size={17} fill="currentColor" className="ml-[2px]" />
        </motion.button>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="truncate text-[13.5px] font-semibold">{album.title}</span>
        {album.quality === "hires" && <QualityBadge quality="hires" />}
      </div>
      <div className="truncate text-[12.5px] text-ink-2">{subtitle ?? album.artist}</div>
    </div>
  );
});

export function AlbumGrid({ albums, subtitle }: { albums: Album[]; subtitle?: (a: Album) => string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-7">
      {albums.map((a) => (
        <AlbumCard key={a.key} album={a} subtitle={subtitle?.(a)} />
      ))}
    </div>
  );
}

/** Rangée horizontale défilante (accueil). */
export function Shelf({ children }: { children: ReactNode }) {
  return <div className="-mx-8 flex gap-5 overflow-x-auto px-8 pb-3 [scrollbar-width:none] [&>*]:w-[168px] [&>*]:shrink-0">{children}</div>;
}

export function DetailHeader({
  cover,
  coverNode,
  layoutId,
  round,
  kicker,
  title,
  subtitle,
  onSubtitle,
  meta,
  ids,
  menu,
  extra,
}: {
  cover?: string | null;
  coverNode?: ReactNode;
  layoutId?: string;
  round?: boolean;
  kicker: string;
  title: string;
  subtitle?: string;
  onSubtitle?: () => void;
  meta?: ReactNode;
  ids: number[];
  menu?: MenuItem[];
  extra?: ReactNode;
}) {
  const openMenu = useApp((s) => s.openMenu);
  return (
    <header className="mb-8 flex flex-wrap items-end gap-7 max-md:flex-col max-md:items-stretch max-md:gap-5">
      {coverNode ?? <Cover id={cover} size={1000} layoutId={layoutId} round={round} rounded="rounded-[16px]" className="w-[232px] shadow-[var(--shadow)] max-md:w-[min(64vw,260px)] max-md:self-center" />}
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-accent">{kicker}</div>
        <h1 className="mt-1 text-[36px] max-md:text-[26px] font-bold leading-[1.1] tracking-tight [overflow-wrap:anywhere]">{title}</h1>
        {subtitle && (
          <button type="button" disabled={!onSubtitle} onClick={onSubtitle} className={cx("mt-1 block text-left text-[20px] max-md:text-[17px] text-ink-2", onSubtitle && "hover:text-accent hover:underline")}>
            {subtitle}
          </button>
        )}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">{meta}</div>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button primary disabled={!ids.length} onClick={() => player.playQueue(ids, 0, { shuffle: false })}>
            <Play size={15} fill="currentColor" /> Lire
          </Button>
          <Button disabled={!ids.length} onClick={() => player.playQueue(ids, 0, { shuffle: true })}>
            <Shuffle size={15} /> Aléatoire
          </Button>
          <Button disabled={!ids.length} onClick={() => player.startRadio(ids, false)}>
            <Radio size={15} /> Radio
          </Button>
          {extra}
          {menu && (
            <IconButton label="Plus d'actions" onClick={(e) => openMenu(e, menu)}>
              <MoreHorizontal size={18} />
            </IconButton>
          )}
        </div>
      </div>
    </header>
  );
}
