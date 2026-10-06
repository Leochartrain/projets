import { defineConfig } from 'vite';

export default defineConfig({
  // Sous-dossier du site si on le publie un jour (comme FPS1) ; « / » en local.
  base: process.env.VITE_BASE ?? '/',
});
