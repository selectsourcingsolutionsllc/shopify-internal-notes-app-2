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
      serverModuleFormat: 'cjs',
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
    supported: {
      'import-assertions': true,
    },
  },
  ssr: {
    noExternal: ['@shopify/polaris', '@shopify/shopify-app-remix'],
  },
});