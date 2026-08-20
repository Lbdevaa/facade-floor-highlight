/** Снимок при заданном положении модели: node scripts/ai-view/try-position.mjs <x> <y> <z> <файл> [кадр] */
import {readFileSync, writeFileSync} from 'node:fs'
import {chromium} from 'playwright'

const [x, y, z, file, shot = 'pogod-01'] = process.argv.slice(2)
const configPath = 'public/scene.config.json'
const original = readFileSync(configPath, 'utf8')

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})

try {
  const config = JSON.parse(original)
  config.model.positionCmUe = {x: Number(x), y: Number(y), z: Number(z)}
  writeFileSync(configPath, JSON.stringify(config, null, 2))

  const page = await browser.newPage({viewport: {width: 1920, height: 900}})
  await page.goto(`http://localhost:5174/?debug&shot=${shot}`, {waitUntil: 'networkidle'})
  await page.waitForFunction(() => (window.__r3f?.gl.info.render.triangles ?? 0) > 0, null, {timeout: 15000})
  await page.waitForTimeout(400)

  const clip =
    shot === 'pogod-01' ? {x: 620, y: 250, width: 520, height: 600} : {x: 900, y: 220, width: 520, height: 600}
  await page.screenshot({path: file, clip})
  console.log(file)
} finally {
  writeFileSync(configPath, original)
  await browser.close()
}
