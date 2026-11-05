import { useState } from "react";
import { exportBackup, restoreBackup } from "./db";
import { parseBackup } from "./domain";
import { shareBackupFile } from "./native";
import { defaultRest, setDefaultRest } from "./ScreenSession";
import { Header } from "./ui";

const REST_OPTIONS = [60, 90, 120, 150, 180, 240, 300];

export function ScreenSettings() {
  const [rest, setRest] = useState(defaultRest);
  const [message, setMessage] = useState("");

  const doExport = async () => {
    setMessage("");
    try {
      const backup = await exportBackup();
      const day = new Date().toLocaleDateString("sv-SE");
      await shareBackupFile(`fonte-sauvegarde-${day}.json`, JSON.stringify(backup));
      setMessage(`Sauvegarde prête : ${backup.sessions.length} séance(s).`);
    } catch (error) {
      setMessage(`La sauvegarde a échoué : ${(error as Error).message}`);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    setMessage("");
    try {
      const backup = parseBackup(await file.text());
      const when = new Date(backup.exportedAt).toLocaleDateString("fr-FR");
      const ok = window.confirm(
        `Remplacer TOUTES les données de ce téléphone par cette sauvegarde du ${when} (${backup.sessions.length} séance(s)) ?`,
      );
      if (!ok) return;
      await restoreBackup(backup);
      setMessage("Sauvegarde restaurée.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <>
      <Header title="Réglages" back />
      <label className="field">
        Temps de repos par défaut
        <select
          value={rest}
          onChange={(e) => {
            const value = Number(e.target.value);
            setRest(value);
            setDefaultRest(value);
          }}
        >
          {REST_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {Math.floor(s / 60)} min {s % 60 ? `${s % 60} s` : ""}
            </option>
          ))}
        </select>
      </label>

      <section className="exercise">
        <h2>Mes données</h2>
        <p className="sub">
          Tout reste sur ce téléphone, sans compte ni serveur. Désinstaller l'app efface les données :
          fais une sauvegarde régulièrement et garde-la ailleurs.
        </p>
        <button className="btn primary" onClick={doExport}>
          Exporter une sauvegarde
        </button>
        <label className="btn">
          Restaurer une sauvegarde
          <input
            type="file"
            hidden
            accept="application/json,.json"
            onChange={(e) => {
              void doImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {message && <p className="hint" role="status">{message}</p>}
      </section>
      <p className="sub center">Fonte 0.1, créée par Léo Chartrain</p>
    </>
  );
}
