// Version téléphone de Sillon : la même interface, compilée en application web installable (PWA).
// Les modules Tauri sont remplacés par src/web/shims (moteur audio web + IndexedDB).
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const shim = (name: string) => fileURLToPath(new URL(`./src/web/shims/${name}.ts`, import.meta.url));
const outDir = fileURLToPath(new URL("./dist-mobile", import.meta.url));

function pwa(): Plugin {
  return {
    name: "sillon-pwa",
    transformIndexHtml(html) {
      return html
        .replace('content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
        .replace(
          "</head>",
          [
            '<meta name="theme-color" content="#151517" />',
            '<meta name="robots" content="noindex" />',
            '<meta name="apple-mobile-web-app-capable" content="yes" />',
            '<meta name="mobile-web-app-capable" content="yes" />',
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
            '<meta name="apple-mobile-web-app-title" content="Sillon" />',
            '<link rel="manifest" href="./manifest.webmanifest" />',
            '<link rel="icon" href="./favicon.svg" type="image/svg+xml" />',
            '<link rel="apple-touch-icon" href="./apple-touch-icon.png" />',
            "<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'))</script>",
            "</head>",
          ].join("\n    "),
        );
    },
    closeBundle() {
      // Nouveau nom de cache à chaque compilation : le téléphone reçoit la mise à jour.
      const sw = `${outDir}/sw.js`;
      const assets = readdirSync(`${outDir}/assets`).map((f) => `./assets/${f}`);
      writeFileSync(sw, readFileSync(sw, "utf8").replace("__BUILD__", Date.now().toString(36)).replace("__ASSETS__", JSON.stringify(assets)));
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: "mobile/public",
  plugins: [react(), tailwindcss(), pwa()],
  define: { "import.meta.env.VITE_TARGET": JSON.stringify("web") },
  resolve: {
    alias: {
      "@tauri-apps/api/core": shim("core"),
      "@tauri-apps/api/event": shim("event"),
      "@tauri-apps/api/window": shim("window"),
      "@tauri-apps/plugin-dialog": shim("dialog"),
      "@tauri-apps/plugin-opener": shim("opener"),
    },
  },
  server: { port: 5261, strictPort: true, host: true },
  preview: { port: 5261, strictPort: true, host: true },
  build: { outDir, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 1500 },
});
