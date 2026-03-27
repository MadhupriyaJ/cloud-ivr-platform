import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from 'tailwindcss';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../backend-nestjs', '');

  return {
    envDir: '../../backend-nestjs',
    plugins: [react()],
    server: {
      host: env.VITE_FRONTEND_HOST || '0.0.0.0',
      port: Number(env.VITE_FRONTEND_PORT || 5170),
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8010',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:8010',
          ws: true,
        },
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    },
    base: '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      chunkSizeWarningLimit: 3000
    }
  };
});
