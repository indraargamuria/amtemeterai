import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 1. Load standard internal frontend environment files
  const frontendEnv = loadEnv(mode, process.cwd(), 'VITE_')

  // 2. Read your title from the root .env file sitting one level up
  const rootEnvPath = path.resolve(__dirname, '../.env')
  let appTitle = 'Amt eMeterai' // Fallback title just in case

  if (fs.existsSync(rootEnvPath)) {
    const parsedRoot = dotenv.parse(fs.readFileSync(rootEnvPath))
    if (parsedRoot['VITE_APP_TITLE']) {
      appTitle = parsedRoot['VITE_APP_TITLE']
    }
  }

  return {
    plugins: [
      react(),
      // 🚀 THE FIX: This custom plugin swaps the HTML placeholder text at build/dev time
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_TITLE%/g, appTitle)
        }
      }
    ],

    // Exposes it to your React code if you ever need import.meta.env.VITE_APP_TITLE
    define: {
      'import.meta.env.VITE_APP_TITLE': JSON.stringify(appTitle)
    },

    // 2026-05-05 18:38:06 - Arga - Set Port (Preserved exactly)
    server: {
      host: true,
      port: 5173,
      strictPort: true
    }
  }
})