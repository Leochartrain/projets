// Mise en page « téléphone » : écran étroit (la fenêtre de bureau ne descend jamais aussi bas).
import { useSyncExternalStore } from "react";

const mq = window.matchMedia("(max-width: 760px)");
const subscribe = (cb: () => void) => {
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export const isCompact = () => mq.matches;
export const useCompact = () => useSyncExternalStore(subscribe, isCompact);
