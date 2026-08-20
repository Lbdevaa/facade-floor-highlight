/**
 * Снимки для README: node scripts/ai-view/readme-shots.mjs [url] [папка] [имена через запятую]
 *
 * Третьим аргументом — какие снимки переснять: после правки вёрстки обычно нужен один,
 * а не весь набор.
 */
import {mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {chromium} from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const outDir = process.argv[3] ?? 'docs/screenshots'

mkdirSync(outDir, {recursive: true})

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})

/**
 * Ждём готовности: data-loaded на кадре появляется, когда загружены и картинка, и геометрия,
 * то есть когда кроп уже смещён к зданию и больше не дёрнется.
 */
const waitScene = async (page) => {
  await page.waitForSelector('img[data-loaded]', {timeout: 30000})
  await page.waitForTimeout(900)
}

/**
 * Ищем точку, в которой объём принимает наведение: перебираем сетку вокруг центра, пока
 * на контейнере не появится data-hovered. Так снимок не зависит от того, куда встал кроп.
 */
const hoverVolume = async (page, width, height) => {
  const spots = []

  for (const fy of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65])
    for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65])
      spots.push([Math.round(width * fx), Math.round(height * fy)])

  for (const [x, y] of spots) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(120)
    if (await page.locator('[data-hovered]').count()) return [x, y]
  }

  return null
}

const SHOTS = [
  {name: 'frame-1', width: 1440, height: 810},
  {name: 'frame-2', width: 1440, height: 810, frame: 'Кадр 2'},
  {name: 'phone-portrait', width: 390, height: 780},
  {name: 'phone-landscape', width: 780, height: 390}
]

const only = (process.argv[4] ?? '').split(',').filter(Boolean)

for (const shot of SHOTS.filter((item) => only.length === 0 || only.includes(item.name))) {
  const page = await browser.newPage({
    viewport: {width: shot.width, height: shot.height},
    deviceScaleFactor: 2
  })

  await page.goto(url, {waitUntil: 'networkidle'})
  await waitScene(page)

  if (shot.frame) {
    await page.getByRole('button', {name: `Показать ${shot.frame}`}).click()
    await page.waitForTimeout(2000)
  }

  const spot = await hoverVolume(page, shot.width, shot.height)
  await page.waitForTimeout(600)

  const file = join(outDir, `${shot.name}.png`)
  await page.screenshot({path: file})
  console.log(`${shot.name.padEnd(16)} → ${file} наведение: ${spot ?? 'НЕ НАЙДЕНО'}`)

  await page.close()
}

await browser.close()
