/**
 * Анимированная заставка для README: node scripts/ai-view/readme-anim.mjs [url] [файл]
 *
 * Пишет цикл «навели — этаж загорелся — сменили кадр — навели снова»: по статичному снимку
 * не видно, что объём держится на здании при смене точки съёмки, а ради этого всё и делалось.
 *
 * Сначала разведка: ищутся точка, в которой объём принимает наведение на каждом кадре,
 * и положение кнопок переключателя. Потом чистая запись по известным координатам —
 * иначе перебор точек попал бы в кадры ролика.
 *
 * Курсора на снимках Playwright нет, поэтому он дорисовывается кружком поверх страницы.
 * Кадры складываются в PNG и склеиваются ffmpeg в анимированный webp.
 */
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {chromium} from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = process.argv[3] ?? 'docs/screenshots/switch.webp'

const VIEWPORT = {width: 960, height: 540}
const FPS = 10

/** Ширина готового файла: вес растёт как её квадрат, а в колонке README всё равно ужмётся. */
const OUT_WIDTH = 720

/** Точка, с которой начинается и которой заканчивается цикл: указатель в стороне от здания. */
const IDLE = {x: 850, y: 480}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})

const waitScene = async (page) => {
  await page.waitForSelector('img[data-loaded]', {timeout: 30000})
  await page.waitForTimeout(900)
}

/**
 * Точки поиска: сначала колонка по центру сверху вниз, потом соседние — лента стен этажа
 * узкая, редкая сетка мимо неё проскакивает.
 */
const searchPoints = (width, height) => {
  const points = []

  for (const fx of [0.5, 0.46, 0.54, 0.42, 0.58, 0.38, 0.62])
    for (let fy = 0.3; fy <= 0.7001; fy += 0.02) points.push({x: Math.round(width * fx), y: Math.round(height * fy)})

  return points
}

/** Ищем точку, в которой этаж принимает наведение. */
const findVolume = async (page) => {
  for (const point of searchPoints(VIEWPORT.width, VIEWPORT.height)) {
    await page.mouse.move(point.x, point.y)
    await page.waitForTimeout(90)
    if (await page.locator('[data-hovered]').count()) return point
  }

  throw new Error('Этаж не отзывается на наведение — писать нечего')
}

const buttonCenter = async (page, name) => {
  const box = await page.getByRole('button', {name}).boundingBox()
  return {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)}
}

// Разведка: координаты объёма на обоих кадрах и кнопок переключателя.
const scout = await browser.newPage({viewport: VIEWPORT})
await scout.goto(url, {waitUntil: 'networkidle'})
await waitScene(scout)

const volume1 = await findVolume(scout)
const buttons = {
  first: await buttonCenter(scout, 'Показать Кадр 1'),
  second: await buttonCenter(scout, 'Показать Кадр 2')
}

await scout.mouse.move(buttons.second.x, buttons.second.y)
await scout.getByRole('button', {name: 'Показать Кадр 2'}).click()
await scout.waitForTimeout(2500)

const volume2 = await findVolume(scout)
await scout.close()

console.log('объём: кадр 1', volume1, 'кадр 2', volume2)

// Запись.
const keep = process.env.FRAMES_DIR
const frames = keep ?? mkdtempSync(join(tmpdir(), 'facade-anim-'))

mkdirSync(frames, {recursive: true})
const page = await browser.newPage({viewport: VIEWPORT, deviceScaleFactor: 2})

await page.goto(url, {waitUntil: 'networkidle'})
await waitScene(page)

await page.addStyleTag({
  content: `
    #readme-cursor {
      position: fixed;
      z-index: 9999;
      width: 22px;
      height: 22px;
      margin: -11px 0 0 -11px;
      border: 2px solid rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      transition: transform 120ms ease-out;
    }
    #readme-cursor[data-press] {
      transform: scale(0.6);
      background: rgba(255, 255, 255, 0.7);
    }
  `
})

await page.evaluate((start) => {
  const dot = document.createElement('div')
  dot.id = 'readme-cursor'
  dot.style.left = `${start.x}px`
  dot.style.top = `${start.y}px`
  document.body.append(dot)
}, IDLE)

let cursor = {...IDLE}
let index = 0

const putCursor = async (point, press) => {
  await page.mouse.move(point.x, point.y)
  await page.evaluate(
    ({x, y, press}) => {
      const dot = document.querySelector('#readme-cursor')
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
      if (press) dot.setAttribute('data-press', '')
      else dot.removeAttribute('data-press')
    },
    {...point, press}
  )
  cursor = point
}

const shoot = async () => {
  await page.screenshot({path: join(frames, `f${String(index++).padStart(3, '0')}.png`)})
}

/** Держим кадр: съёмка сама по себе занимает время, поэтому пауз между снимками нет. */
const hold = async (count) => {
  for (let i = 0; i < count; i += 1) await shoot()
}

/** Указатель едет к цели по прямой, по кадру на шаг. */
const moveTo = async (target, steps) => {
  const from = cursor

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    // Плавный разгон и торможение — прямая линейная езда выглядит механической.
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

    await putCursor({
      x: Math.round(from.x + (target.x - from.x) * eased),
      y: Math.round(from.y + (target.y - from.y) * eased)
    })
    await shoot()
  }
}

const click = async (point, name) => {
  await putCursor(point, true)
  await shoot()
  await page.getByRole('button', {name}).click()
  await shoot()
  await putCursor(point, false)
}

// Каждый кадр — это вес файла, поэтому паузы держатся ровно столько, чтобы успеть прочитать.
await hold(3) // чистый фасад
await moveTo(volume1, 6) // подводим указатель
await hold(6) // этаж горит
await moveTo(buttons.second, 5)
await click(buttons.second, 'Показать Кадр 2')
await hold(9) // кадр проявляется, подсветка гаснет вместе со старым видом
await moveTo(volume2, 6)
await hold(8) // тот же этаж, другая точка съёмки
await moveTo(buttons.first, 5)
await click(buttons.first, 'Показать Кадр 1')
await hold(8) // возврат к началу — цикл замыкается
await moveTo(IDLE, 4)

await page.close()
await browser.close()

mkdirSync(dirname(out), {recursive: true})
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-framerate',
  String(FPS),
  '-i',
  join(frames, 'f%03d.png'),
  '-vf',
  `scale=${OUT_WIDTH}:-2`,
  '-c:v',
  'libwebp',
  '-quality',
  String(process.env.WEBP_QUALITY ?? 32),
  // Блоки, не изменившиеся с прошлого кадра, не перекодируются: половина ролика — статика.
  '-cr_threshold',
  '30',
  '-compression_level',
  '6',
  '-loop',
  '0',
  '-an',
  out
])

if (!keep) rmSync(frames, {recursive: true, force: true})
console.log(`${index} кадров → ${out}`)
