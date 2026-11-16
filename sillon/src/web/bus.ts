// Bus d'événements de la version web : remplace les événements Tauri (listen / emit).
type Handler = (e: { event: string; payload: unknown }) => void;

const handlers = new Map<string, Set<Handler>>();

export function on(event: string, handler: Handler): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(handler);
  return () => set!.delete(handler);
}

export function emit(event: string, payload?: unknown) {
  for (const h of handlers.get(event) ?? []) {
    try {
      h({ event, payload });
    } catch (e) {
      console.error(e);
    }
  }
}
