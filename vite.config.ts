import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaMeasurementId = (env.VITE_GA_MEASUREMENT_ID || env.GA_MEASUREMENT_ID || '').trim();
  const clarityProjectId = (env.VITE_CLARITY_PROJECT_ID || env.CLARITY_PROJECT_ID || '').trim();

  return {
    define: {
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(gaMeasurementId),
      'import.meta.env.VITE_CLARITY_PROJECT_ID': JSON.stringify(clarityProjectId),
      'process.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(gaMeasurementId),
      'process.env.VITE_CLARITY_PROJECT_ID': JSON.stringify(clarityProjectId),
      'process.env.GA_MEASUREMENT_ID': JSON.stringify(gaMeasurementId),
      'process.env.CLARITY_PROJECT_ID': JSON.stringify(clarityProjectId),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-pdf': ['jspdf'],
            'vendor-excel': ['xlsx'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
