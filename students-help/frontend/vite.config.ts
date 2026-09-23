import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/help-seeker/account': { target: 'http://localhost:3001', changeOrigin: true },
      '/student/account': { target: 'http://localhost:3001', changeOrigin: true },
      '/students': { target: 'http://localhost:3001', changeOrigin: true },
      '/skills': { target: 'http://localhost:3001', changeOrigin: true },
      '/tasks': { target: 'http://localhost:3001', changeOrigin: true },
      '/bookings': { target: 'http://localhost:3001', changeOrigin: true },
      '/admin': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
