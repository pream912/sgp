import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://sgp1-backend-719340208040.asia-south1.run.app',
        // target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/sites': {
        target: 'https://sgp1-backend-719340208040.asia-south1.run.app',
        // target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})