import { defineConfig } from 'vite';
import { vitePlugin as remix } from '@remix-run/dev';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: process.env.NODE_ENV === 'development' ? {
      protocol: 'ws',
      host: 'localhost',
    } : false,
    fs: {
      allow: ['app', 'node_modules'],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/.*'],
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
});