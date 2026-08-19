/** Прицельный скриншот: node scripts/shot.mjs <url> <файл> [x,y,w,h] */
import {chromium} from 'playwright'

/** Ждём, пока сцена реально отрисует геометрию: headless-браузер стартует медленно. */
async function waitForScene(page) {
  await page.waitForFunction(() => (window.__r3f?.gl.info.render.triangles ?? 0) > 0, null, {timeout: 15000})
  await page.waitForTimeout(300)
}

const [url, file, clip] = process.argv.slice(2)
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({
  viewport: {width: 1920, height: 900},
  deviceScaleFactor: Number(process.env.SCALE ?? 1)
})

await page.goto(url, {waitUntil: 'networkidle'})
await waitForScene(page)

const [x, y, width, height] = (clip ?? '').split(',').map(Number)
await page.screenshot({path: file, ...(clip ? {clip: {x, y, width, height}} : {})})

console.log(file)
await browser.close()
