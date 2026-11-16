// Menus contextuels des morceaux et des albums.
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Disc3, FolderOpen, Heart, ListEnd, ListPlus, ListStart, Pencil, Play, Radio, Shuffle, Star, User } from "lucide-react";
import { api } from "./api";
import { albumArtistOf, albumKeyOf, type Album } from "./library";
import { player } from "./player";
import { WEB } from "./platform";
import { getApp, type MenuItem } from "./store";

const ic = (I: typeof Play) => <I size={15} strokeWidth={1.8} />;

export async function addToPlaylist(playlistId: number, ids: number[]) {
  const app = getApp();
  const pl = app.playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  const existing = new Set(pl.track_ids);
  const fresh = ids.filter((id) => !existing.has(id));
  await api.setPlaylistTracks(playlistId, [...pl.track_ids, ...fresh]);
  await app.refreshPlaylists();
  app.toast(fresh.length ? `Ajouté à « ${pl.name} »` : `Déjà dans « ${pl.name} »`);
}

export async function createPlaylistWith(ids: number[]) {
  const app = getApp();
  const n = app.playlists.filter((p) => p.kind === "manual").length + 1;
  const id = await api.savePlaylist(null, `Nouvelle playlist ${n}`, "manual", null);
  await api.setPlaylistTracks(id, ids);
  await app.refreshPlaylists();
  app.navigate({ name: "playlist", param: String(id) });
}

function playlistItems(ids: number[]): MenuItem[] {
  const manual = getApp().playlists.filter((p) => p.kind === "manual");
  return [
    { label: "Nouvelle playlist…", action: () => createPlaylistWith(ids) },
    ...(manual.length ? [{ separator: true } as MenuItem] : []),
    ...manual.map((p) => ({ label: p.name, action: () => addToPlaylist(p.id, ids) })),
  ];
}

export function trackMenu(ids: number[], extra: MenuItem[] = []): MenuItem[] {
  const app = getApp();
  const first = app.byId.get(ids[0]);
  if (!first) return [];
  const many = ids.length > 1;
  const items: MenuItem[] = [
    { label: many ? `Lire ${ids.length} titres` : "Lire", icon: ic(Play), action: () => player.playQueue(ids, 0, { shuffle: false }) },
    { label: "Lire ensuite", icon: ic(ListStart), action: () => player.playNext(ids) },
    { label: "Ajouter à la file d'attente", icon: ic(ListEnd), action: () => player.addToQueue(ids) },
    { label: "Lancer la radio", icon: ic(Radio), action: () => player.startRadio(ids, !many) },
    { separator: true },
    { label: "Ajouter à une playlist", icon: ic(ListPlus), children: playlistItems(ids) },
    {
      label: first.loved ? "Ne plus aimer" : "Aimer",
      icon: ic(Heart),
      action: () => ids.forEach((id) => (app.byId.get(id)?.loved === first.loved ? player.toggleLoved(id) : null)),
    },
    {
      label: "Note",
      icon: ic(Star),
      children: [5, 4, 3, 2, 1, 0].map((n) => ({
        label: n ? "★".repeat(n) : "Aucune note",
        checked: !many && first.rating === n,
        action: () => ids.forEach((id) => player.setRating(id, n)),
      })),
    },
    { separator: true },
  ];
  if (!many) {
    if (first.album) items.push({ label: "Aller à l'album", icon: ic(Disc3), action: () => app.navigate({ name: "album", param: albumKeyOf(first) }) });
    items.push({ label: "Aller à l'artiste", icon: ic(User), action: () => app.navigate({ name: "artist", param: albumArtistOf(first) }) });
  }
  items.push({ label: many ? "Modifier les informations…" : "Modifier les informations…", icon: ic(Pencil), action: () => app.set({ tagEditor: ids }) });
  if (!many && !WEB) items.push({ label: "Afficher dans le dossier", icon: ic(FolderOpen), action: () => revealItemInDir(first.path).catch(() => {}) });
  if (extra.length) items.push({ separator: true }, ...extra);
  return items;
}

export function albumMenu(album: Album): MenuItem[] {
  const app = getApp();
  const ids = album.trackIds;
  return [
    { label: "Lire", icon: ic(Play), action: () => player.playQueue(ids, 0, { shuffle: false }) },
    { label: "Lecture aléatoire", icon: ic(Shuffle), action: () => player.playQueue(ids, 0, { shuffle: true }) },
    { label: "Lire ensuite", icon: ic(ListStart), action: () => player.playNext(ids) },
    { label: "Ajouter à la file d'attente", icon: ic(ListEnd), action: () => player.addToQueue(ids) },
    { label: "Lancer la radio de l'album", icon: ic(Radio), action: () => player.startRadio(ids, false) },
    { separator: true },
    { label: "Ajouter à une playlist", icon: ic(ListPlus), children: playlistItems(ids) },
    { label: "Aller à l'artiste", icon: ic(User), action: () => app.navigate({ name: "artist", param: album.artist }) },
    { label: "Modifier les informations…", icon: ic(Pencil), action: () => app.set({ tagEditor: ids }) },
  ];
}
