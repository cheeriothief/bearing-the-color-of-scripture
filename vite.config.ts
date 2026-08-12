/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
