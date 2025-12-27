import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  // Load all environment variables, including .env.local
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      env.ANALYZE === 'true' &&
        visualizer({
          filename: 'dist/bundle-report.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
    ].filter(Boolean),
    define: {
      // Ensure all environment variables are available
      'process.env': JSON.stringify(env),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx')) return 'xlsx';
              if (id.includes('pdfjs-dist')) return 'pdfjs';
              if (id.includes('tesseract.js')) return 'tesseract';
              if (id.includes('@emoji-mart/data')) return 'emoji-data';
              if (id.includes('@emoji-mart')) return 'emoji-mart';
              if (id.includes('emoji-mart')) return 'emoji-mart';
              if (id.includes('react-dom')) return 'react-dom';
              if (id.includes('react')) return 'react';
              if (id.includes('lucide-react')) return 'icons';
              if (id.includes('axios')) return 'axios';
              if (id.includes('uuid')) return 'uuid';
              if (id.includes('memu-js')) return 'memu';
              if (id.includes('pdfjs-dist')) return 'pdfjs';
              if (id.includes('tesseract.js')) return 'tesseract';
              if (id.includes('mammoth')) return 'mammoth';
              if (id.includes('exceljs')) return 'exceljs';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
