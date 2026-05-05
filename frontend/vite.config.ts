import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  //2026-05-05 18:38:06 - Arga - Set Port
  server: {
    host: true,
    port: 5173,
    strictPort: true // 🔥 IMPORTANT
  }
})
