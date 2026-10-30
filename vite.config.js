import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = String(
    env.VITE_SUPABASE_URL || 'https://rzsgdfpwnxhseyxtrrlx.supabase.co'
  ).trim().replace(/\/$/, '');

  return {
    // Set the base path per hosting target: Cloudflare uses /, GitHub Pages uses /Analytics/.
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/functions/v1': {
          target: supabaseUrl,
          changeOrigin: true,
          headers: {
            // Preserve the origin currently allowed by the Supabase function.
            origin: 'https://analytics.vigneshw-5416.workers.dev'
          }
        }
      }
    },
    build: { outDir: 'dist', sourcemap: false }
  };
});
