import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath, type Plugin } from 'vite';

const src = normalizePath(fileURLToPath(new URL('./src', import.meta.url)));

/**
 * Mode visite (`npm run demo`) : remplace la connexion et l'accès aux données par
 * les versions de src/demo/ (exemples en mémoire), sans toucher aux écrans.
 */
function demoMode(): Plugin {
  const swaps: Record<string, string> = {
    'features/auth/AuthProvider.tsx': 'demo/AuthProvider.tsx',
    'features/recipes/api.ts': 'demo/recipes-api.ts',
    'features/groups/api.ts': 'demo/groups-api.ts',
    'features/profile/api.ts': 'demo/profile-api.ts',
    'features/reviews/api.ts': 'demo/reviews-api.ts',
  };
  return {
    name: 'demo-mode',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      // Les fichiers de src/demo/ importent les vrais modules (types, fonctions utiles).
      if (!importer || normalizePath(importer).startsWith(`${src}/demo/`)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const swap = resolved && swaps[normalizePath(resolved.id).slice(src.length + 1)];
      return swap ? `${src}/${swap}` : null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), mode === 'demo' && demoMode()],
  resolve: { alias: { '@': src } },
  // Pour faire tester l'appli à distance avec un tunnel Cloudflare.
  preview: { allowedHosts: ['.trycloudflare.com'] },
}));
