/**
 * Скриншот с координатной сеткой в пикселях ИСХОДНОГО кадра.
 * node scripts/ai-view/grid.mjs <url> <файл> [шаг] [x,y,w,h]
 */
import {chromium} from 'playwright'

const [url, file, step = '100', clip] = process.argv.slice(2)

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({
  viewport: {width: 1920, height: 900},
  deviceScaleFactor: Number(process.env.SCALE ?? 1)
})

await page.goto(url, {waitUntil: 'networkidle'})
await page.waitForFunction(() => (window.__r3f?.gl.info.render.triangles ?? 0) > 0, null, {timeout: 15000})
await page.waitForTimeout(300)

await page.evaluate((stepPx) => {
  const image = document.querySelector('img')
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight
  const scale = Math.max(window.innerWidth / imgW, window.innerHeight / imgH)
  const offsetX = (window.innerWidth - imgW * scale) / 2
  const offsetY = (window.innerHeight - imgH * scale) / 2

  const canvas = document.createElement('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  Object.assign(canvas.style, {position: 'fixed', inset: '0', zIndex: '50', pointerEvents: 'none'})
  document.body.append(canvas)

  const ctx = canvas.getContext('2d')
  ctx.font = '10px monospace'
  ctx.lineWidth = 1

  for (let x = 0; x <= imgW; x += stepPx) {
    const screenX = offsetX + x * scale
    ctx.strokeStyle = x % (stepPx * 5) === 0 ? 'rgba(0,255,255,0.85)' : 'rgba(0,255,255,0.3)'
    ctx.beginPath()
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, canvas.height)
    ctx.stroke()
    if (x % (stepPx * 2) === 0) {
      ctx.fillStyle = 'rgba(0,255,255,0.95)'
      ctx.fillText(String(x), screenX + 2, 12)
    }
  }

  // подписи в узлах: клип может не захватить края экрана
  for (let x = 0; x <= imgW; x += stepPx * 4) {
    for (let y = 0; y <= imgH; y += stepPx * 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText(`${x}/${y}`, offsetX + x * scale + 3, offsetY + y * scale + 12)
    }
  }

  for (let y = 0; y <= imgH; y += stepPx) {
    const screenY = offsetY + y * scale
    ctx.strokeStyle = y % (stepPx * 5) === 0 ? 'rgba(255,255,0,0.85)' : 'rgba(255,255,0,0.3)'
    ctx.beginPath()
    ctx.moveTo(0, screenY)
    ctx.lineTo(canvas.width, screenY)
    ctx.stroke()
    if (y % (stepPx * 2) === 0) {
      ctx.fillStyle = 'rgba(255,255,0,0.95)'
      ctx.fillText(String(y), 2, screenY - 2)
    }
  }
}, Number(step))

const [x, y, width, height] = (clip ?? '').split(',').map(Number)
await page.screenshot({path: file, ...(clip ? {clip: {x, y, width, height}} : {})})

console.log(file)
await browser.close()
