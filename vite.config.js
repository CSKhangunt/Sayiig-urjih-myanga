import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  if (process.env.VERCEL) {
    if (!environment.VITE_CLERK_PUBLISHABLE_KEY) throw new Error('VITE_CLERK_PUBLISHABLE_KEY шаардлагатай.')
    for (const key of ['VITE_API_URL', 'VITE_SOCKET_URL']) {
      let url
      try { url = new URL(environment[key]) } catch { throw new Error(`${key} зөв HTTPS URL байх шаардлагатай.`) }
      if (url.protocol !== 'https:' || url.origin !== environment[key]) throw new Error(`${key} замгүй HTTPS origin байх шаардлагатай.`)
    }
  }
  return {
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  }
})
