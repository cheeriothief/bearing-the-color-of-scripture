/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages serves project sites from /<repo-name>/, not the domain
  // root. Setting `base` here means every asset path the built app
  // generates already accounts for that subpath.
  base: '/bearing-the-color-of-scripture/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bearing the Color of Scripture',
        short_name: 'BCoS',
        description: 'A tablet-first, local-first Bible reading companion.',
        theme_color: '#faf8f4',
        background_color: '#faf8f4',
        display: 'standalone',
        icons: [
          // Placeholder — real icon assets get added when the design pass happens.
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
