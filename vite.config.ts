import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // `wrangler dev` serves the /api worker on 8787; run it alongside `vite` for AI import in dev.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { chunkSizeWarningLimit: 4000 },
})
