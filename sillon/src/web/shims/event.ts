// Remplace @tauri-apps/api/event dans la version téléphone.
import { emit as busEmit, on } from "../bus";

export type Event<T> = { event: string; payload: T };
export type UnlistenFn = () => void;

export async function listen<T>(event: string, handler: (e: Event<T>) => void): Promise<UnlistenFn> {
  return on(event, handler as (e: { event: string; payload: unknown }) => void);
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  busEmit(event, payload);
}
