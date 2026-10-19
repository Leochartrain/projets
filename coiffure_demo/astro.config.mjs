import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://coiffure-demo.pages.dev',
  build: { format: 'file' },
  trailingSlash: 'never',
});
