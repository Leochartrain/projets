// Remplace @tauri-apps/api/core dans la version téléphone.
import { coverUrlFor, invoke as webInvoke } from "../backend";

export const invoke = <T>(cmd: string, args?: Record<string, unknown>) => webInvoke<T>(cmd, args);
export const convertFileSrc = (path: string) => coverUrlFor(path);
