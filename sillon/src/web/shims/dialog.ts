// Remplace @tauri-apps/plugin-dialog dans la version téléphone : sélecteur de fichiers du navigateur.
// Les fichiers choisis sont mis de côté et désignés par un jeton, que le reste de l'appli
// manipule comme un chemin (add_folder, cover_path).
import { stashFiles } from "../backend";

interface OpenOptions {
  directory?: boolean;
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}

export function open(opts: OpenOptions = {}): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.directory) {
      // Morceaux de musique (+ paroles .lrc et pochettes du dossier quand le système les propose).
      input.multiple = true;
      input.accept = "audio/*,.flac,.mp3,.m4a,.aac,.ogg,.opus,.wav,.aif,.aiff,.lrc,image/*";
    } else {
      input.multiple = !!opts.multiple;
      const ext = opts.filters?.flatMap((f) => f.extensions.map((e) => `.${e}`)) ?? [];
      if (ext.length) input.accept = ext.join(",");
    }
    input.style.display = "none";
    document.body.appendChild(input);
    let settled = false;
    const finish = (v: string | string[] | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])];
      if (!files.length) return finish(null);
      const token = stashFiles(files);
      finish(opts.directory || opts.multiple ? [token] : token);
    });
    input.addEventListener("cancel", () => finish(null));
    input.click();
  });
}
