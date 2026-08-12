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
      includeAssets: ['favicon.svg', 'icon-1024.png'],
      workbox: {
        // Default globPatterns don't include font files — without this,
        // the app would silently fall back to system fonts offline
        // instead of the bundled EB Garamond / Source Serif 4 / Atkinson
        // Hyperlegible, breaking the "local-first, offline-first" promise
        // for typography specifically.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Bearing the Color of Scripture',
        short_name: 'BCoS',
        description: 'A tablet-first, local-first Bible reading companion.',
        // Matches the Prayer Book theme's dark cover — this is what shows
        // as the splash-screen/status-bar background while the app loads,
        // so it should match the real app, not a stale placeholder.
        theme_color: '#241b16',
        background_color: '#241b16',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
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
