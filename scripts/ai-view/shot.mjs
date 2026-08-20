/** Прицельный скриншот: node scripts/ai-view/shot.mjs <url> <файл> [x,y,w,h] */
import {chromium} from 'playwright'

/**
 * Ждём готовности страницы: data-loaded на кадре появляется, когда загружены и картинка,
 * и геометрия — то есть когда кроп уже смещён к зданию и больше не дёрнется.
 */
const waitForScene = async (page) => {
  await page.waitForSelector('img[data-loaded]', {timeout: 20000})
  await page.waitForTimeout(400)
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
