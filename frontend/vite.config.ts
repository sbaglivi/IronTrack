import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': 'http://localhost:8000',
          '/auth': 'http://localhost:8000',
          '/exercises': 'http://localhost:8000',
          '/templates': 'http://localhost:8000',
          '/instances': 'http://localhost:8000',
        },
      },
      plugins: [preact()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
