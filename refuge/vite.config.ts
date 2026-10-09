import { defineConfig } from 'vite';

export default defineConfig({
  // Sous-dossier du site si on le publie un jour ; « / » en local.
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5190 },
  // Phaser seul pèse ~1,2 Mo minifié : ce n'est pas une erreur.
  build: { chunkSizeWarningLimit: 2000 },
});
