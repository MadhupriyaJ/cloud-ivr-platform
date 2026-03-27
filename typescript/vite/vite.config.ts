import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from 'tailwindcss';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../backend-nestjs', '');
  // Use localhost for the dev proxy to ensure it works in any environment
  const backendUrl = 'http://localhost:8010';

  return {
    envDir: '../../backend-nestjs',
    plugins: [react()],
    server: {
      host: env.VITE_FRONTEND_HOST || '0.0.0.0',
      port: Number(env.VITE_FRONTEND_PORT || 5170),
      strictPort: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: backendUrl.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
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
