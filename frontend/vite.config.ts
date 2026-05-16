import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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
          '/sync': 'http://localhost:8000',
        },
      },
      plugins: [
        tailwindcss(),
        preact(),
        VitePWA({
          registerType: 'prompt',
          injectRegister: 'auto',
          includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
          manifest: {
            id: "/",
            name: 'IronTrack',
            short_name: 'IronTrack',
            description: 'Personal workout tracker',
            theme_color: '#18181b',
            background_color: '#09090b',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            icons: [
              { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
            screenshots: [
              { src: 'screenshot-mobile.png', sizes: '390x843', type: 'image/png', label: 'IronTrack mobile' },
              { src: 'screenshot-desktop.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'IronTrack desktop' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
            navigateFallback: 'index.html',
            navigateFallbackDenylist: [
              /^\/api/,
              /^\/auth/,
              /^\/exercises/,
              /^\/templates/,
              /^\/instances/,
              /^\/sync/,
            ],
          },
          devOptions: {
            enabled: false,
          },
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
