import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Vite 8 bundles with Rolldown, so chunks are grouped with `codeSplitting` (not the old manualChunks).
// Vendor libraries get their own files: they rarely change, so returning visitors reuse them
// from the browser cache after every deploy, and the first page loads less code.
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            { name: 'chess', test: /node_modules[\\/]chess\.js[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})