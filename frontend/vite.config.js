import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // react-dom and @react-three/fiber's internal reconciler each pull in the
    // 'scheduler' package; without deduping, Vite's dep pre-bundling can give
    // them two separate module instances that fight over shared scheduler
    // state, surfacing as an intermittent "Should not already be working"
    // crash that kills the R3F canvas while the DOM tree keeps rendering.
    dedupe: ['react', 'react-dom', 'scheduler', 'three'],
  },
})
