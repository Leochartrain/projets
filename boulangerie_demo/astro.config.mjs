import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://boulangerie-demo.pages.dev',
  build: { format: 'file' },
  trailingSlash: 'never',
});
