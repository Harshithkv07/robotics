import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  // version 2: in development the live solver (python server.py, port 4175) answers /api
  server: { proxy: { '/api': 'http://127.0.0.1:4175' } },
})
