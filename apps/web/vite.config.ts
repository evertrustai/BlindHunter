import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BlindHunter web UI. Binds to localhost by default — see README security note.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 7331,
    proxy: {
      // Forward API calls to the BlindHunter server in dev.
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
