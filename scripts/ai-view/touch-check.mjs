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

/** Заведомо мимо ленты: небо в левом верхнем углу. */
const OFF_VOLUME = {x: 120, y: 80}

/**
 * Точка на ленте ищется перебором, а не задаётся числом: подсветка — это стены этажа
 * высотой 4 м, узкая полоса, и её положение зависит от размера окна и выбранного кадра.
 */
/** Касание, при котором палец между нажатием и отрывом уезжает на несколько пикселей. */
const findVolumePoint = async (page) => {
  for (let y = 380; y <= 660; y += 15) {
    for (let x = 700; x <= 1300; x += 30) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(30)

      if (await highlighted(page)) {
        await page.mouse.move(OFF_VOLUME.x, OFF_VOLUME.y)
        await page.waitForTimeout(150)

        return {x, y}
      }
    }
  }

  throw new Error('Не нашёл подсветку ни в одной точке — geometry или камера сломаны')
}

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
  const context = await browser.newContext({viewport: {width: 1920, height: 900}, hasTouch: touch})
  const page = await context.newPage()
  await page.goto(url, {waitUntil: 'networkidle'})
  await page.waitForSelector('img[data-loaded]', {timeout: 20000})
  await page.waitForTimeout(600)

  const onVolume = await findVolumePoint(page)
  console.log(`\n--- ${touch ? 'касание' : 'мышь'}, точка на этаже (${onVolume.x}, ${onVolume.y}) ---`)

  if (touch) {
    await check(page, 'тап по этажу', true, () => page.touchscreen.tap(onVolume.x, onVolume.y))
    await check(page, 'тап мимо этажа', false, () => page.touchscreen.tap(OFF_VOLUME.x, OFF_VOLUME.y))
    await check(page, 'снова тап по этажу', true, () => page.touchscreen.tap(onVolume.x, onVolume.y))
  } else {
    await check(page, 'курсор на этаже', true, () => page.mouse.move(onVolume.x, onVolume.y))
    await check(page, 'курсор уведён', false, () => page.mouse.move(OFF_VOLUME.x, OFF_VOLUME.y))
    await check(page, 'клик мимо этажа', false, () => page.mouse.click(OFF_VOLUME.x, OFF_VOLUME.y))
  }

  await context.close()
}

await browser.close()
