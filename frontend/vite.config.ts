import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const envTag = frontendEnv['VITE_APP_ENV_TAG'] || ''

  let finalTitle = ''

  if (mode === 'development') {
    // 💻 LOCAL DEV: Read the root .env file directly for instant feedback
    const rootEnvPath = path.resolve(__dirname, '../.env')
    let baseTitle = 'OpexNOW'
    
    if (fs.existsSync(rootEnvPath)) {
      const parsedRoot = dotenv.parse(fs.readFileSync(rootEnvPath))
      baseTitle = parsedRoot['VITE_APP_TITLE'] || 'OpexNOW'
    }
    finalTitle = envTag ? `${envTag} ${baseTitle}` : baseTitle
  } else {
    // 🐳 DOCKER/PRODUCTION BUILD: Inject the string placeholder for Nginx to swap later
    // We append %VITE_APP_ENV_TAG% so Nginx can also swap the environment tag dynamically if needed!
    finalTitle = '__WINDOW_TITLE_PLACEHOLDER__'
  }

  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_TITLE%/g, finalTitle)
        }
      }
    ],
    define: {
      'import.meta.env.VITE_APP_TITLE': JSON.stringify(finalTitle)
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true
    }
  }
})