// Cible de la compilation : application de bureau (Tauri) ou version téléphone (web, PWA).
export const WEB = import.meta.env.VITE_TARGET === "web";
