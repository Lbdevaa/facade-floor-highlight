/**
 * Скриншоты страницы в нескольких геометриях окна — проверка совмещения без участия человека.
 *
 * Запуск: node scripts/claude-view/screenshot.mjs [url] [папка]
 * По умолчанию снимает отладочный режим первого кадра на dev-сервере.
 */
import {mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {chromium} from 'playwright'

/**
 * Ждём готовности страницы: data-loaded на кадре появляется, когда загружены и картинка,
 * и геометрия — то есть когда кроп уже смещён к зданию и больше не дёрнется.
 */
const waitForScene = async (page) => {
  await page.waitForSelector('img[data-loaded]', {timeout: 20000})
  await page.waitForTimeout(400)
}

const url = process.argv[2] ?? 'http://localhost:5173/?debug'
const outDir = process.argv[3] ?? 'screenshots'

const VIEWPORTS = [
  {name: 'desktop-wide', width: 1920, height: 900},
  {name: 'desktop-narrow', width: 1000, height: 900},
  {name: 'phone-portrait', width: 390, height: 844},
  {name: 'phone-landscape', width: 844, height: 390}
]

mkdirSync(outDir, {recursive: true})

// SwiftShader: у headless-браузера нет GPU, без этого WebGL-контекст не создаётся.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({viewport: {width: viewport.width, height: viewport.height}})
  const problems = []

  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(error.message))

  await page.goto(url, {waitUntil: 'networkidle'})
  await waitForScene(page)

  const file = join(outDir, `${viewport.name}.png`)
  await page.screenshot({path: file})
  console.log(`${viewport.name.padEnd(16)} → ${file}${problems.length ? `\n  ошибки: ${problems.join('; ')}` : ''}`)

  await page.close()
}

await browser.close()
