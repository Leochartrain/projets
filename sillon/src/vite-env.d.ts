/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "web" pour la version téléphone (vite.mobile.config.ts), absent pour l'application de bureau. */
  readonly VITE_TARGET?: string;
}
