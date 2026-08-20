/**
 * Юстировка через отладочную панель: node scripts/claude-view/adjust.mjs <url> <файл> [действия]
 * Действия через запятую: flipY | z-3 (три шага вниз) | x+2 | шаг500
 */
import {chromium} from 'playwright'

/**
 * Ждём готовности страницы: data-loaded на кадре появляется, когда загружены и картинка,
 * и геометрия — то есть когда кроп уже смещён к зданию и больше не дёрнется.
 */
const waitForScene = async (page) => {
  await page.waitForSelector('img[data-loaded]', {timeout: 20000})
  await page.waitForTimeout(400)
}

const [url, file, actions = ''] = process.argv.slice(2)
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({viewport: {width: 1920, height: 900}})

await page.goto(url, {waitUntil: 'networkidle'})
await waitForScene(page)

for (const action of actions.split(',').filter(Boolean)) {
  if (action === 'flipY') {
    await page.getByRole('button', {name: 'Отразить Y'}).click()
    continue
  }

  const step = action.match(/^шаг(\d+)$/)
  if (step) {
    await page.getByRole('button', {name: `${step[1]} см`}).click()
    continue
  }

  const [, axis, sign, times] = action.match(/^([xyz])([+-])(\d+)$/) ?? []
  if (!axis) throw new Error(`Непонятное действие: ${action}`)

  const label = `${axis.toUpperCase()} ${sign === '+' ? 'больше' : 'меньше'}`
  for (let i = 0; i < Number(times); i += 1) {
    await page.getByRole('button', {name: label, exact: true}).click()
  }
}

await page.waitForTimeout(400)
await page.screenshot({path: file})
console.log(file, '|', (await page.locator('pre').first().innerText()).replace(/\s+/g, ' '))

await browser.close()
