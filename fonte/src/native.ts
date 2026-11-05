import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";

const REST_NOTIFICATION_ID = 1;
const native = Capacitor.isNativePlatform();

/** Programme l'alerte de fin de repos, pour qu'elle sonne même écran éteint. */
export async function scheduleRestAlert(endAt: number): Promise<void> {
  if (!native) return;
  const { display } = await LocalNotifications.requestPermissions();
  if (display !== "granted") return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REST_NOTIFICATION_ID,
        title: "Repos terminé",
        body: "Série suivante !",
        schedule: { at: new Date(endAt), allowWhileIdle: true },
      },
    ],
  });
}

export async function cancelRestAlert(): Promise<void> {
  if (!native) return;
  await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
}

export async function vibrate(): Promise<void> {
  if (native) await Haptics.notification({ type: NotificationType.Success });
  else navigator.vibrate?.(300);
}

/** Propose d'envoyer la sauvegarde (Drive, mail…) ou la télécharge dans le navigateur. */
export async function shareBackupFile(name: string, json: string): Promise<void> {
  if (!native) {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: "Sauvegarde Fonte", url: uri });
}
