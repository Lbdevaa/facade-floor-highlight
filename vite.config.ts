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
  resolve: {alias: layerAliases},
  test: {environment: 'node', include: ['src/**/*.test.ts']}
})
