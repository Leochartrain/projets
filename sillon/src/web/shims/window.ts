// Remplace @tauri-apps/api/window dans la version téléphone (plein écran du navigateur).
export function getCurrentWindow() {
  return {
    isFullscreen: async () => !!document.fullscreenElement,
    setFullscreen: async (on: boolean) => {
      try {
        if (on) await document.documentElement.requestFullscreen();
        else if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* refusé par le navigateur */
      }
    },
  };
}
