/**
 * Проверка подсветки мышью и касанием: node scripts/ai-view/touch-check.mjs [url]
 *
 * Подсветка отражается атрибутом data-hovered на контейнере, по нему и проверяем.
 */
import {chromium} from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})

/** Точка внутри объёма и точка заведомо мимо него — определены по скриншоту этой геометрии. */
const ON_VOLUME = {x: 500, y: 520}
const OFF_VOLUME = {x: 120, y: 80}

const highlighted = async (page) => {
  return (await page.locator('[data-hovered]').count()) > 0
}

const check = async (page, name, expected, action) => {
  await action()
  await page.waitForTimeout(300)
  const actual = await highlighted(page)
  console.log(`${actual === expected ? 'OK  ' : 'ПЛОХО'} ${name}: подсветка ${actual ? 'есть' : 'нет'}`)
}

for (const touch of [false, true]) {
  const context = await browser.newContext({viewport: {width: 1000, height: 900}, hasTouch: touch})
  const page = await context.newPage()
  await page.goto(url, {waitUntil: 'networkidle'})
  await page.waitForSelector('img[data-loaded]', {timeout: 20000})
  await page.waitForTimeout(600)

  console.log(`\n--- ${touch ? 'касание' : 'мышь'} ---`)

  if (touch) {
    await check(page, 'тап по этажу', true, () => page.touchscreen.tap(ON_VOLUME.x, ON_VOLUME.y))
    await check(page, 'тап мимо этажа', false, () => page.touchscreen.tap(OFF_VOLUME.x, OFF_VOLUME.y))
    await check(page, 'снова тап по этажу', true, () => page.touchscreen.tap(ON_VOLUME.x, ON_VOLUME.y))
  } else {
    await check(page, 'курсор на этаже', true, () => page.mouse.move(ON_VOLUME.x, ON_VOLUME.y))
    await check(page, 'курсор уведён', false, () => page.mouse.move(OFF_VOLUME.x, OFF_VOLUME.y))
    await check(page, 'клик мимо этажа', false, () => page.mouse.click(OFF_VOLUME.x, OFF_VOLUME.y))
  }

  await context.close()
}

await browser.close()
