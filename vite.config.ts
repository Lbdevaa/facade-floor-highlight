import {fileURLToPath, URL} from 'node:url'
import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

const LAYERS = ['app', 'features', 'entities', 'shared']

// Алиасы зеркалят paths из tsconfig.app.json: импорт `entities/sceneConfig`
// должен одинаково резолвиться и компилятором, и сборщиком.
const layerAliases = Object.fromEntries(
  LAYERS.map((layer) => [layer, fileURLToPath(new URL(`./src/${layer}`, import.meta.url))])
)

export default defineConfig({
  plugins: [react()],
  // Относительные пути в сборке: страница одинаково работает и на GitHub Pages
  // (подкаталог репозитория), и на Vercel/Netlify (корень домена).
  base: './',
  // По умолчанию Vite слушает только [::1] (IPv6), а BrowserStack Local
  // резолвит localhost в 127.0.0.1 и получает ECONNREFUSED. host: true
  // поднимает сервер и на IPv4; bs-local.com — хост туннеля BrowserStack.
  server: {host: true, allowedHosts: ['bs-local.com']},
  resolve: {alias: layerAliases},
  test: {environment: 'node', include: ['src/**/*.test.ts']}
})
