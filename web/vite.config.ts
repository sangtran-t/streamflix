import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// These proxies apply when running `pnpm dev` directly on the host.
// In docker-compose the nginx proxy at :8080 handles the same routing,
// so the SPA behaves identically in both environments.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/hls': { target: 'http://localhost:8081', changeOrigin: true },
    },
  },
});
