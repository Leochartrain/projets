// Réglages et détection des doublons.
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Copy, FolderOpen, FolderPlus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Folder } from "../lib/api";
import { formatTime, plural, techLabel } from "../lib/library";
import { applyEngineSettings, player } from "../lib/player";
import { findDuplicates } from "../lib/smart";
import { useApp } from "../lib/store";
import { Button, Cover, Empty, Heading, IconButton, Range, Section, Segmented, Toggle, TrackQuality } from "../components/ui";
import { pickFolders } from "./Library";

function Row({ title, text, children }: { title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-3.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        {text && <div className="mt-0.5 max-w-[560px] text-[12.5px] leading-relaxed text-ink-2">{text}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

const Card = ({ children }: { children: ReactNode }) => <div className="rounded-[18px] bg-fill px-5 py-1.5">{children}</div>;

const SHORTCUTS: [string, string][] = [
  ["Espace", "Lecture / pause"],
  ["Ctrl + → / ←", "Morceau suivant / précédent"],
  ["→ / ←", "Avancer / reculer de 5 secondes"],
  ["Ctrl + ↑ / ↓", "Monter / baisser le volume"],
  ["M", "Couper le son"],
  ["S", "Lecture aléatoire"],
  ["R", "Mode de répétition"],
  ["L", "Aimer le morceau en cours"],
  ["F", "Écran « En cours de lecture »"],
  ["Q", "File d'attente"],
  ["Ctrl + K", "Palette de commandes"],
  ["Ctrl + F ou /", "Rechercher"],
  ["Ctrl + M", "Mini-lecteur"],
  ["Ctrl + 1 … 8", "Accueil, Albums, Artistes, Morceaux, Genres, Playlists, Statistiques, Réglages"],
  ["Alt + ← / →", "Page précédente / suivante"],
  ["Entrée", "Lire le morceau sélectionné"],
  ["Ctrl + A", "Tout sélectionner dans une liste"],
  ["F11", "Plein écran"],
  ["Échap", "Fermer le panneau ouvert"],
];

export function Settings() {
  const settings = useApp((s) => s.settings);
  const setSetting = useApp((s) => s.setSetting);
  const set = useApp((s) => s.set);
  const navigate = useApp((s) => s.navigate);
  const toast = useApp((s) => s.toast);
  const scan = useApp((s) => s.scan);
  const analysis = useApp((s) => s.analysis);
  const trackCount = useApp((s) => s.tracks.length);
  const analysed = useApp((s) => s.tracks.filter((t) => t.energy !== null).length);
  const device = useApp((s) => s.player.device);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [devices, setDevices] = useState<string[]>([]);

  const loadFolders = () => api.getFolders().then(setFolders);
  useEffect(() => {
    loadFolders();
    api.devices().then(setDevices);
  }, [trackCount]);

  const engine = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSetting(key, value);
    applyEngineSettings();
  };

  return (
    <div className="max-w-[860px]">
      <Heading title="Réglages" />

      <Section title="Bibliothèque">
        <Card>
          {folders.map((f) => (
            <Row key={f.id} title={f.path} text={plural(f.tracks, "morceau", "morceaux")}>
              <IconButton label="Ouvrir le dossier" onClick={() => revealItemInDir(f.path).catch(() => {})}>
                <FolderOpen size={16} />
              </IconButton>
              <IconButton
                label="Retirer ce dossier de la bibliothèque (les fichiers ne sont pas supprimés)"
                onClick={async () => {
                  await api.removeFolder(f.id);
                  await loadFolders();
                  toast("Dossier retiré de la bibliothèque (fichiers conservés)");
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Row>
          ))}
          <Row title="Dossiers de musique" text="Scannés en profondeur et surveillés : les ajouts, suppressions et renommages sont détectés automatiquement.">
            <Button onClick={() => api.rescan()} disabled={!!scan}>
              <RefreshCw size={14} className={scan ? "animate-spin" : ""} /> {scan ? "Scan en cours…" : "Rescanner"}
            </Button>
            <Button primary onClick={() => pickFolders().then(loadFolders)}>
              <FolderPlus size={15} /> Ajouter un dossier
            </Button>
          </Row>
          <Row
            title="Analyse audio en arrière-plan"
            text={
              <>
                Tempo, tonalité, énergie, dansabilité, humeur et volume perçu (ReplayGain), calculés sur cet ordinateur. Sert à la radio, aux mix et aux playlists intelligentes.
                <br />
                {analysed.toLocaleString("fr-FR")} / {trackCount.toLocaleString("fr-FR")} morceaux analysés{analysis ? ` — ${analysis.remaining} restants` : ""}.
              </>
            }
          >
            <Toggle checked={settings.analysis} onChange={(v) => setSetting("analysis", v)} label="Analyse audio en arrière-plan" />
          </Row>
          <Row title="Compléter les infos manquantes en ligne" text="Désactivé par défaut. Cherche la pochette et l'année des albums qui n'en ont pas sur MusicBrainz et Cover Art Archive : seuls le nom de l'artiste et celui de l'album sont envoyés. Les fichiers ne sont pas modifiés.">
            <Toggle
              checked={settings.online}
              onChange={(v) => {
                setSetting("online", v);
                if (v) api.onlineComplete();
              }}
              label="Compléter les infos manquantes en ligne"
            />
          </Row>
          <Row title="Doublons" text="Repère un même morceau présent en plusieurs versions ou qualités, et indique la meilleure.">
            <Button onClick={() => navigate({ name: "duplicates" })}>
              <Copy size={14} /> Chercher les doublons
            </Button>
          </Row>
        </Card>
      </Section>

      <Section title="Lecture">
        <Card>
          <Row title="Sortie audio" text={device ? `En cours : ${device}` : undefined}>
            <select aria-label="Sortie audio" value={settings.device ?? ""} onChange={(e) => engine("device", e.target.value || null)} className="h-9 max-w-[300px] rounded-[9px] bg-elev px-3 text-[13px] outline-none ring-1 ring-line">
              <option value="">Sortie par défaut du système</option>
              {devices.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Row>
          <Row title="Suivre la fréquence du fichier" text="Quand la carte son l'accepte, la sortie s'ouvre à la fréquence d'origine du morceau : aucun rééchantillonnage. Sinon, le morceau est converti proprement à la fréquence de la sortie.">
            <Toggle checked={settings.matchRate} onChange={(v) => engine("matchRate", v)} label="Suivre la fréquence du fichier" />
          </Row>
          <Row title="Mode exclusif" text="Pas encore disponible : la bibliothèque de sortie audio utilisée (cpal) n'ouvre la carte son qu'en mode partagé. Sous Windows, le mélangeur du système reste donc dans la chaîne.">
            <span className="text-[12.5px] text-ink-3">Indisponible</span>
          </Row>
          <Row title="Fondu enchaîné" text="Désactivé automatiquement entre deux pistes qui se suivent sur un même album (lecture sans blanc).">
            <span className="w-[72px] text-right text-[13px] tabular-nums text-ink-2">{settings.crossfade === 0 ? "Désactivé" : `${settings.crossfade} s`}</span>
            <Range label="Durée du fondu enchaîné en secondes" className="thumb w-[180px]" min={0} max={12} step={1} value={settings.crossfade} onChange={(v) => engine("crossfade", v)} accent />
          </Row>
          <Row title="ReplayGain" text="Égalise le volume d'un morceau à l'autre (piste) ou d'un album à l'autre (album). Utilise les valeurs des fichiers, sinon celles calculées par l'analyse.">
            <Segmented id="rg" value={settings.replayGain} onChange={(v) => engine("replayGain", v)} options={[{ value: "off", label: "Désactivé" }, { value: "track", label: "Piste" }, { value: "album", label: "Album" }]} />
          </Row>
          <Row title="Égaliseur" text={`${settings.eq.enabled ? "Activé" : "Désactivé"} — préréglage « ${settings.eq.preset} »`}>
            <Button onClick={() => set({ eqOpen: true })}>
              <SlidersHorizontal size={14} /> Ouvrir l'égaliseur
            </Button>
          </Row>
        </Card>
      </Section>

      <Section title="Apparence">
        <Card>
          <Row title="Thème">
            <Segmented id="theme" value={settings.theme} onChange={(v) => setSetting("theme", v)} options={[{ value: "auto", label: "Automatique" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }]} />
          </Row>
          <Row title="Couleurs dynamiques" text="L'interface prend les teintes de la pochette en cours.">
            <Toggle checked={settings.dynamicColors} onChange={(v) => setSetting("dynamicColors", v)} label="Couleurs dynamiques" />
          </Row>
          <Row title="Visualiseur" text="Affiché dans l'écran « En cours de lecture ».">
            <Segmented id="vis" value={settings.visualizer} onChange={(v) => setSetting("visualizer", v)} options={[{ value: "off", label: "Désactivé" }, { value: "bars", label: "Spectre" }, { value: "wave", label: "Onde" }]} />
          </Row>
          <Row title="Réduire les animations" text="Remplace les transitions par des changements instantanés. La préférence du système est aussi respectée.">
            <Toggle checked={settings.reduceMotion} onChange={(v) => setSetting("reduceMotion", v)} label="Réduire les animations" />
          </Row>
        </Card>
      </Section>

      <Section title="Raccourcis clavier">
        <Card>
          <div className="grid grid-cols-1 gap-x-10 py-2 md:grid-cols-2">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
                <span className="text-ink-2">{label}</span>
                <kbd className="shrink-0 rounded-[6px] bg-elev px-2 py-0.5 font-sans text-[12px] font-medium ring-1 ring-line">{keys}</kbd>
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ doublons

export function Duplicates() {
  const tracks = useApp((s) => s.tracks);
  const groups = useMemo(() => findDuplicates(tracks), [tracks]);
  const extra = groups.reduce((n, g) => n + g.tracks.length - 1, 0);
  const wasted = groups.reduce((n, g) => n + g.tracks.slice(1).reduce((m, t) => m + t.file_size, 0), 0);
  return (
    <>
      <Heading
        title="Doublons"
        subtitle={groups.length ? `${plural(groups.length, "morceau", "morceaux")} en plusieurs versions · ${plural(extra, "fichier en trop", "fichiers en trop")} · ${(wasted / 1e9).toFixed(2)} Go récupérables` : undefined}
      />
      {!groups.length && <Empty icon={<CheckCircle2 />} title="Aucun doublon" text="Chaque morceau n'existe qu'en une seule version dans votre bibliothèque." />}
      <p className="mb-5 max-w-[640px] text-[13px] leading-relaxed text-ink-2">
        {groups.length > 0 && "La meilleure version (format sans perte, puis profondeur et fréquence les plus élevées) est indiquée. Sillon ne supprime rien : ouvrez le dossier pour retirer vous-même les fichiers en trop."}
      </p>
      <div className="space-y-4">
        {groups.slice(0, 300).map((g) => (
          <div key={g.key} className="rounded-[16px] bg-fill p-2">
            {g.tracks.map((t) => (
              <div key={t.id} onDoubleClick={() => player.playQueue([t.id], 0, { shuffle: false })} className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-fill">
                <Cover id={t.cover} size={96} className="h-10 w-10" rounded="rounded-[6px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium">
                    <span className="truncate">{t.title}</span>
                    <TrackQuality track={t} />
                    {t.id === g.best && <span className="shrink-0 text-[11.5px] font-semibold text-emerald-600">À garder</span>}
                  </div>
                  <div className="truncate text-[12px] text-ink-2">
                    {t.artist} — {t.album || "sans album"} · {techLabel(t)} · {formatTime(t.duration_ms)} · {(t.file_size / 1e6).toFixed(1)} Mo
                  </div>
                  <div className="truncate text-[11px] text-ink-3">{t.path}</div>
                </div>
                <IconButton label="Afficher dans le dossier" onClick={() => revealItemInDir(t.path).catch(() => {})}>
                  <FolderOpen size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
