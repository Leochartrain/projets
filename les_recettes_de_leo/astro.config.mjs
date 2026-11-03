import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // À changer si le site passe sur un vrai nom de domaine (sert au référencement et aux aperçus de partage).
  site: 'https://les-recettes-de-leo.pages.dev',
  // Des adresses sans « .html » ni barre finale : /recettes/tarte-marbree-pomme-caramel.
  build: { format: 'file' },
  trailingSlash: 'never',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
});
