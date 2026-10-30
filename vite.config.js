import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = String(
    env.VITE_SUPABASE_URL || 'https://rzsgdfpwnxhseyxtrrlx.supabase.co'
  ).trim().replace(/\/$/, '');

  return {
    // GitHub Pages serves this project at /Analytics/. Keep root paths for
    // local development and the existing Cloudflare Workers deployment.
    base: process.env.GITHUB_ACTIONS === 'true' ? '/Analytics/' : '/',
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
