import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // DatoCMS serves the plugin from a nested path, so assets must be relative.
  base: './',
  build: {
    // Kept as `build` so `datoCmsPlugin.entryPoint` stays valid.
    outDir: 'build'
  },
  server: {
    port: 3000,
    open: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
})
