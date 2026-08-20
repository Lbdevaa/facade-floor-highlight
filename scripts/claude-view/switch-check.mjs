/** Проверка переключателя кадров: node scripts/claude-view/switch-check.mjs */
import {chromium} from 'playwright'

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({viewport: {width: 1200, height: 800}})

await page.goto('http://localhost:5173/', {waitUntil: 'networkidle'})
await page.waitForSelector('img[data-loaded]', {timeout: 20000})
await page.waitForTimeout(600)

const url = () => new URL(page.url()).search
console.log('адрес после загрузки:', url())
console.log('кнопок кадров:', await page.getByRole('button', {name: /Показать/}).count())

await page.getByRole('button', {name: 'Показать Кадр 2'}).click()
await page.waitForTimeout(1200)
console.log('после переключения:', url())
await page.screenshot({path: 'screenshots/switch-2.png'})

await page.goBack()
await page.waitForTimeout(1200)
console.log('после кнопки «назад»:', url())

await page.keyboard.press('ArrowRight')
await page.waitForTimeout(1200)
console.log('после стрелки вправо:', url())
await page.screenshot({path: 'screenshots/switch-keyboard.png'})

await browser.close()
