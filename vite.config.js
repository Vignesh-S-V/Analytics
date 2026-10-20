import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = String(
    env.VITE_SUPABASE_URL || 'https://rzsgdfpwnxhseyxtrrlx.supabase.co'
  ).trim().replace(/\/$/, '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/functions/v1': {
          target: supabaseUrl,
          changeOrigin: true,
          headers: {
            // Supabase Edge Function currently allows the deployed app origin.
            origin: 'https://analytics.vigneshw-5416.workers.dev'
          }
        }
      }
    },
    build: { outDir: 'dist', sourcemap: false }
  };
});
