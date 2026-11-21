import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'Tutor Ledger',
        short_name: 'Tutor Ledger',
        display: 'standalone',
        start_url: '/',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        icons: [],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  build: { sourcemap: false, target: 'es2022' },
});
