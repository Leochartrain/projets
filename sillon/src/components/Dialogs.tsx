// Égaliseur paramétrique et éditeur de tags.
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ImagePlus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, coverUrl, type TagPatch, type Track } from "../lib/api";
import { applyEngineSettings } from "../lib/player";
import { EQ_FREQS, flatBands, useApp, type EqSettings } from "../lib/store";
import { Modal } from "./Overlays";
import { Button, cx, IconButton, Toggle } from "./ui";

// ------------------------------------------------------------------ égaliseur

const PRESETS: Record<string, number[]> = {
  Plat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Basses renforcées": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Aigus renforcés": [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  Voix: [-2, -2, -1, 1, 3, 4, 3, 2, 0, -1],
  Rock: [5, 4, 2, 0, -1, -1, 1, 3, 4, 5],
  Pop: [-1, 0, 2, 3, 4, 3, 1, 0, -1, -1],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classique: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Électro: [5, 4, 1, 0, -2, 1, 0, 2, 4, 5],
  Acoustique: [4, 4, 3, 1, 2, 2, 3, 3, 3, 2],
  "Faible volume": [6, 4, 1, 0, -1, -1, 0, 1, 4, 5],
};

const freqLabel = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));

export function EqPanel() {
  const open = useApp((s) => s.eqOpen);
  const eq = useApp((s) => s.settings.eq);
  const custom = useApp((s) => s.settings.eqPresets);
  const setSetting = useApp((s) => s.setSetting);
  const toast = useApp((s) => s.toast);
  const [advanced, setAdvanced] = useState(false);
  const close = () => useApp.setState({ eqOpen: false });

  const update = (patch: Partial<EqSettings>) => {
    setSetting("eq", { ...eq, ...patch });
    applyEngineSettings();
  };
  const applyPreset = (name: string) => {
    const gains = PRESETS[name] ?? custom[name]?.gains;
    if (!gains) return;
    update({ preset: name, preamp: custom[name]?.preamp ?? 0, bands: EQ_FREQS.map((freq, i) => ({ freq, gain: gains[i] ?? 0, q: 1.41 })), enabled: true });
  };
  const setBand = (i: number, patch: Partial<EqSettings["bands"][number]>) => {
    update({ bands: eq.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)), preset: "Personnalisé", enabled: true });
  };
  const savePreset = () => {
    let n = 1;
    while (custom[`Mon réglage ${n}`]) n++;
    const name = `Mon réglage ${n}`;
    setSetting("eqPresets", { ...custom, [name]: { preamp: eq.preamp, gains: eq.bands.map((b) => b.gain) } });
    update({ preset: name });
    toast(`Préréglage « ${name} » enregistré`);
  };
  const deletePreset = () => {
    const rest = { ...custom };
    delete rest[eq.preset];
    setSetting("eqPresets", rest);
    update({ preset: "Personnalisé" });
  };
  const names = [...Object.keys(PRESETS), ...Object.keys(custom)];

  return (
    <Modal open={open} onClose={close} width={720} label="Égaliseur">
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">Égaliseur</h2>
            <p className="text-[12.5px] text-ink-2">10 bandes paramétriques, préampli et limiteur anti-saturation.</p>
          </div>
          <Toggle checked={eq.enabled} onChange={(v) => update({ enabled: v })} label="Activer l'égaliseur" />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <select
            aria-label="Préréglage"
            value={names.includes(eq.preset) ? eq.preset : "__custom"}
            onChange={(e) => applyPreset(e.target.value)}
            className="h-9 rounded-[9px] bg-fill px-3 text-[13px] font-medium outline-none"
          >
            {!names.includes(eq.preset) && <option value="__custom">Personnalisé</option>}
            <optgroup label="Préréglages">
              {Object.keys(PRESETS).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </optgroup>
            {Object.keys(custom).length > 0 && (
              <optgroup label="Mes préréglages">
                {Object.keys(custom).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </optgroup>
            )}
          </select>
          <Button onClick={savePreset}>
            <Save size={14} /> Enregistrer comme préréglage
          </Button>
          {custom[eq.preset] && (
            <IconButton label="Supprimer ce préréglage" onClick={deletePreset}>
              <Trash2 size={15} />
            </IconButton>
          )}
          <IconButton label="Remettre à plat" onClick={() => update({ bands: flatBands(), preamp: 0, preset: "Plat" })}>
            <RotateCcw size={15} />
          </IconButton>
        </div>

        <div className={cx("flex items-stretch justify-between gap-1 rounded-[16px] bg-fill px-4 py-4 transition-opacity", !eq.enabled && "opacity-50")}>
          <div className="flex flex-col items-center gap-2 border-r border-line pr-4">
            <span className="text-[11px] tabular-nums text-ink-2">{eq.preamp > 0 ? "+" : ""}{eq.preamp.toFixed(1)}</span>
            <input type="range" aria-label="Préampli en décibels" className="eq-slider" min={-12} max={12} step={0.5} value={eq.preamp} onChange={(e) => update({ preamp: Number(e.target.value), enabled: true })} />
            <span className="text-[11px] font-semibold text-ink-2">Préampli</span>
          </div>
          {eq.bands.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] tabular-nums text-ink-2">{b.gain > 0 ? "+" : ""}{b.gain.toFixed(1)}</span>
              <input type="range" aria-label={`Bande ${freqLabel(b.freq)} Hz, gain en décibels`} className="eq-slider" min={-12} max={12} step={0.5} value={b.gain} onChange={(e) => setBand(i, { gain: Number(e.target.value) })} />
              <span className="text-[11px] font-semibold text-ink-2">{freqLabel(b.freq)}</span>
              {advanced && (
                <div className="flex flex-col gap-1">
                  <input aria-label="Fréquence centrale en hertz" type="number" min={20} max={20000} value={b.freq} onChange={(e) => setBand(i, { freq: Math.max(20, Math.min(20000, Number(e.target.value) || b.freq)) })} className="h-6 w-[52px] rounded-md bg-elev px-1 text-center text-[11px] tabular-nums ring-1 ring-line" />
                  <input aria-label="Facteur Q (largeur de la bande)" type="number" min={0.2} max={10} step={0.1} value={b.q} onChange={(e) => setBand(i, { q: Math.max(0.2, Math.min(10, Number(e.target.value) || b.q)) })} className="h-6 w-[52px] rounded-md bg-elev px-1 text-center text-[11px] tabular-nums ring-1 ring-line" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <label className="flex items-center gap-3">
            <Toggle checked={advanced} onChange={setAdvanced} label="Réglage fin des bandes" />
            Réglage fin (fréquence et largeur Q de chaque bande)
          </label>
          <label className="flex items-center gap-3">
            <Toggle checked={eq.limiter} onChange={(v) => update({ limiter: v })} label="Limiteur anti-saturation" />
            Limiteur anti-saturation
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ éditeur de tags

const FIELDS: { key: keyof Track & keyof TagPatch; label: string; wide?: boolean; numeric?: boolean }[] = [
  { key: "title", label: "Titre", wide: true },
  { key: "artist", label: "Artiste" },
  { key: "album_artist", label: "Artiste de l'album" },
  { key: "album", label: "Album", wide: true },
  { key: "genre", label: "Genre" },
  { key: "composer", label: "Compositeur" },
  { key: "year", label: "Année", numeric: true },
  { key: "track_no", label: "Piste n°", numeric: true },
  { key: "disc_no", label: "Disque n°", numeric: true },
];

const MIXED = "\u0000mixed";

export function TagEditor() {
  const ids = useApp((s) => s.tagEditor);
  const byId = useApp((s) => s.byId);
  const toast = useApp((s) => s.toast);
  const close = () => useApp.setState({ tagEditor: null });
  const tracks = useMemo(() => (ids ?? []).map((id) => byId.get(id)).filter((t): t is Track => !!t), [ids]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsDirty, setLyricsDirty] = useState(false);
  const [cover, setCover] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const single = tracks.length === 1;

  useEffect(() => {
    if (!tracks.length) return;
    const v: Record<string, string> = {};
    for (const f of FIELDS) {
      const all = new Set(tracks.map((t) => String(t[f.key] ?? "")));
      v[f.key] = all.size === 1 ? [...all][0] : MIXED;
    }
    setValues(v);
    setInitial(v);
    setCover(null);
    setRemoveCover(false);
    setLyrics(null);
    setLyricsDirty(false);
    if (tracks.length === 1) api.getLyrics(tracks[0].id).then((l) => setLyrics(l ?? ""));
  }, [ids]);

  if (!ids) return <Modal open={false} onClose={close} label="Modifier les informations">{null}</Modal>;

  const save = async () => {
    const patch: TagPatch = {};
    for (const f of FIELDS) {
      if (values[f.key] !== initial[f.key] && values[f.key] !== MIXED) (patch as Record<string, string>)[f.key] = values[f.key];
    }
    if (single && lyricsDirty && lyrics !== null) patch.lyrics = lyrics;
    if (cover) patch.cover_path = cover;
    if (removeCover && !cover) patch.remove_cover = true;
    if (!Object.keys(patch).length) return close();
    setBusy(true);
    try {
      const errors = await api.writeTags(ids, patch);
      if (errors.length) toast(`${errors.length} fichier(s) non modifié(s) : ${errors[0]}`, "error");
      else toast(ids.length > 1 ? `${ids.length} fichiers mis à jour` : "Fichier mis à jour");
      close();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const pickCover = async () => {
    const file = await openDialog({ multiple: false, filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }] });
    if (typeof file === "string") {
      setCover(file);
      setRemoveCover(false);
    }
  };

  const currentCover = tracks.find((t) => t.cover)?.cover;
  const preview = cover || removeCover ? undefined : coverUrl(currentCover, 320);

  return (
    <Modal open onClose={close} width={640} label="Modifier les informations">
      <div className="p-6">
        <h2 className="text-[20px] font-bold tracking-tight">Modifier les informations</h2>
        <p className="mb-5 text-[12.5px] text-ink-2">
          {single ? tracks[0]?.path : `${tracks.length} morceaux sélectionnés — seuls les champs modifiés seront écrits.`}
        </p>
        <div className="flex gap-5">
          <div className="w-[150px] shrink-0">
            <div className="aspect-square overflow-hidden rounded-[12px] bg-fill ring-1 ring-line">
              {preview ? <img src={preview} alt="Pochette" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center break-all p-3 text-center text-[12px] text-ink-3">{cover ? `Nouvelle image : ${cover.split(/[\/]/).pop()}` : "Pas de pochette"}</div>}
            </div>
            <Button onClick={pickCover} className="mt-2 w-full !px-2 text-[12px]">
              <ImagePlus size={14} /> Choisir une image
            </Button>
            {(currentCover || cover) && (
              <button type="button" onClick={() => (setCover(null), setRemoveCover(true))} className="mt-1.5 w-full text-center text-[12px] text-ink-2 hover:text-red-500">
                Retirer la pochette
              </button>
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-6 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className={cx("flex flex-col gap-1", f.wide ? "col-span-6" : f.numeric ? "col-span-2" : "col-span-3")}>
                <span className="text-[11.5px] font-semibold text-ink-2">{f.label}</span>
                <input
                  value={values[f.key] === MIXED ? "" : (values[f.key] ?? "")}
                  placeholder={values[f.key] === MIXED ? "Plusieurs valeurs" : ""}
                  inputMode={f.numeric ? "numeric" : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="h-9 rounded-[9px] bg-fill px-3 text-[13px] outline-none focus:ring-2 focus:ring-accent/60"
                />
              </label>
            ))}
          </div>
        </div>
        {single && (
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-ink-2">Paroles (texte simple ou format LRC synchronisé)</span>
            <textarea
              value={lyrics ?? ""}
              onChange={(e) => (setLyrics(e.target.value), setLyricsDirty(true))}
              rows={5}
              className="resize-y rounded-[9px] bg-fill px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:ring-2 focus:ring-accent/60"
            />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={close}>Annuler</Button>
          <Button primary onClick={save} disabled={busy}>
            {busy ? "Écriture…" : "Enregistrer dans les fichiers"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
