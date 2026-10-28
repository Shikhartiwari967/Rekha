import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend so there are no CORS/URL headaches.
    // Set REKHA_API to point at a backend on another port (e.g. if 8000 is busy).
    proxy: {
      '/api': process.env.REKHA_API ?? 'http://localhost:8000',
    },
  },
})
