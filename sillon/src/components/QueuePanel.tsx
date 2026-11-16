// File d'attente : morceau en cours, suite réorganisable par glisser-déposer, historique.
import { Reorder } from "motion/react";
import { GripVertical, Radio, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Track } from "../lib/api";
import { formatTime } from "../lib/library";
import { trackMenu } from "../lib/menus";
import { player } from "../lib/player";
import { useApp } from "../lib/store";
import { Cover, cx, Equalizer, IconButton, Segmented } from "./ui";

const MAX_SHOWN = 80;

function Item({ track, onPlay, onRemove, current, handle }: { track: Track; onPlay: () => void; onRemove?: () => void; current?: boolean; handle?: boolean }) {
  const playing = useApp((s) => s.player.status === "playing");
  const openMenu = useApp((s) => s.openMenu);
  return (
    <div
      onDoubleClick={onPlay}
      onContextMenu={(e) => openMenu(e, trackMenu([track.id]))}
      className={cx("group flex h-[54px] items-center gap-2.5 rounded-[10px] px-2", current ? "bg-fill" : "hover:bg-fill")}
    >
      {handle && <GripVertical size={14} className="shrink-0 cursor-grab text-ink-3 opacity-0 group-hover:opacity-100" aria-hidden />}
      <div className="relative">
        <Cover id={track.cover} size={96} className="h-10 w-10" rounded="rounded-[6px]" />
        {current && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/45">
            <Equalizer playing={playing} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cx("truncate text-[13px] font-medium", current && "text-accent")}>{track.title}</div>
        <div className="truncate text-[12px] text-ink-2">{track.artist}</div>
      </div>
      <span className={cx("text-[11.5px] tabular-nums text-ink-3", onRemove && "group-hover:hidden")}>{formatTime(track.duration_ms)}</span>
      {onRemove && (
        <span className="hidden group-hover:inline-flex">
          <IconButton label="Retirer de la file" size={26} onClick={onRemove}>
            <X size={14} />
          </IconButton>
        </span>
      )}
    </div>
  );
}

export function QueuePanel({ className }: { className?: string }) {
  const queue = useApp((s) => s.queue);
  const index = useApp((s) => s.index);
  const byId = useApp((s) => s.byId);
  const history = useApp((s) => s.history);
  const radioSeed = useApp((s) => s.radioSeed);
  const [tab, setTab] = useState<"next" | "history">("next");

  const current = byId.get(queue[index]);
  // Clés uniques : un même morceau peut figurer plusieurs fois dans la file.
  const upcoming = useMemo(() => {
    const seen = new Map<number, number>();
    return queue.slice(index + 1, index + 1 + MAX_SHOWN).map((id) => {
      const n = seen.get(id) ?? 0;
      seen.set(id, n + 1);
      return { uid: `${id}:${n}`, id };
    });
  }, [queue, index]);
  const hidden = Math.max(0, queue.length - index - 1 - MAX_SHOWN);

  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        <Segmented
          id="queue-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "next", label: "À suivre" },
            { value: "history", label: "Historique" },
          ]}
        />
        {tab === "next" && upcoming.length > 0 && (
          <button type="button" onClick={() => player.clearUpcoming()} className="rounded-md px-2 py-1 text-[12px] font-medium text-accent hover:bg-fill">
            Vider
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {tab === "next" ? (
          <>
            {current && (
              <>
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">En lecture</div>
                <Item track={current} current onPlay={() => player.seek(0)} />
              </>
            )}
            <div className="flex items-center gap-2 px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              À suivre
              {radioSeed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-[1px] normal-case tracking-normal text-accent">
                  <Radio size={11} /> Radio
                </span>
              )}
            </div>
            {upcoming.length === 0 && <div className="px-2 py-6 text-[13px] text-ink-3">La file d'attente est vide.</div>}
            <Reorder.Group axis="y" values={upcoming} onReorder={(items) => player.setUpcoming([...items.map((i) => i.id), ...queue.slice(index + 1 + MAX_SHOWN)])} className="list-none p-0">
              {upcoming.map((it, i) => {
                const t = byId.get(it.id);
                if (!t) return null;
                return (
                  <Reorder.Item key={it.uid} value={it} className="list-none" whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", borderRadius: 10 }}>
                    <Item track={t} handle onPlay={() => player.playIndex(index + 1 + i)} onRemove={() => player.removeFromQueue(index + 1 + i)} />
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
            {hidden > 0 && <div className="px-2 py-3 text-[12px] text-ink-3">… et {hidden} autres titres</div>}
          </>
        ) : (
          <>
            {history.length === 0 && <div className="px-2 py-6 text-[13px] text-ink-3">Rien n'a encore été écouté pendant cette session.</div>}
            {history.map((id, i) => {
              const t = byId.get(id);
              return t ? <Item key={`${id}-${i}`} track={t} onPlay={() => player.playNext([id])} /> : null;
            })}
          </>
        )}
      </div>
    </div>
  );
}
