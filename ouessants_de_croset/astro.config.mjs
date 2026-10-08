import { defineConfig } from 'astro/config';

export default defineConfig({
  // À remplacer par le vrai nom de domaine une fois acheté (sert aux aperçus de partage).
  site: 'https://ouessants-de-croset.pages.dev',
  // Des adresses sans « .html » ni barre finale : /contact, /mentions-legales.
  build: { format: 'file' },
  trailingSlash: 'never',
});
