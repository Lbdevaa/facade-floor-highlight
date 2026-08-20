import {describe, expect, it} from 'vitest'
import {coverFovY, coverRegion, coverScale, focalLengthToFovY, fovYToFovX, regionToObjectPosition} from './index'

const SENSOR_HEIGHT_MM = 13.365
const FOCAL_LENGTH_MM = 25
const IMAGE = {width: 3439, height: 1379}

describe('угол обзора', () => {
  it('считает вертикальный угол из высоты матрицы, а не из ширины', () => {
    expect(focalLengthToFovY(FOCAL_LENGTH_MM, SENSOR_HEIGHT_MM)).toBeCloseTo(29.9306, 4)
  })

  it('горизонтальный угол следует из пропорций кадра', () => {
    const fovY = focalLengthToFovY(FOCAL_LENGTH_MM, SENSOR_HEIGHT_MM)

    expect(fovYToFovX(fovY, IMAGE.width / IMAGE.height)).toBeCloseTo(67.375, 3)
  })

  it('не путает высоту матрицы с шириной: 23.76 мм дали бы 50.83°', () => {
    expect(focalLengthToFovY(FOCAL_LENGTH_MM, 23.76)).toBeCloseTo(50.834, 3)
  })
})

describe('cover-кроп', () => {
  const fovY = focalLengthToFovY(FOCAL_LENGTH_MM, SENSOR_HEIGHT_MM)

  it('на окне с пропорциями кадра оставляет угол без изменений', () => {
    expect(coverFovY(fovY, IMAGE, {width: 3439, height: 1379})).toBeCloseTo(fovY, 10)
    expect(coverFovY(fovY, IMAGE, {width: 1719.5, height: 689.5})).toBeCloseTo(fovY, 10)
  })

  it('на окне уже кадра показывает кадр по высоте целиком и кропает ширину', () => {
    expect(coverFovY(fovY, IMAGE, {width: 390, height: 844})).toBeCloseTo(fovY, 10)
    expect(coverScale(IMAGE, {width: 390, height: 844})).toBeCloseTo(844 / IMAGE.height, 10)
  })

  it('на окне шире кадра сужает угол ровно на видимую долю высоты', () => {
    const viewport = {width: 3000, height: 800}
    const visibleFraction = viewport.height / coverScale(IMAGE, viewport) / IMAGE.height

    expect(visibleFraction).toBeLessThan(1)
    expect(coverFovY(fovY, IMAGE, viewport)).toBeLessThan(fovY)
    expect(Math.tan(coverFovY(fovY, IMAGE, viewport) / 2 / (180 / Math.PI))).toBeCloseTo(
      Math.tan(fovY / 2 / (180 / Math.PI)) * visibleFraction,
      10
    )
  })

  it('монотонен: чем шире окно при той же высоте, тем меньше угол', () => {
    const narrow = coverFovY(fovY, IMAGE, {width: 1200, height: 800})
    const wide = coverFovY(fovY, IMAGE, {width: 2400, height: 800})

    expect(wide).toBeLessThan(narrow)
  })
})

describe('область кропа', () => {
  const WIDE = {width: 1920, height: 900}
  const PORTRAIT = {width: 390, height: 844}

  it('без точки интереса кропает от центра', () => {
    const region = coverRegion(IMAGE, PORTRAIT)

    expect(region.left + region.width / 2).toBeCloseTo(IMAGE.width / 2, 6)
    expect(region.height).toBeCloseTo(IMAGE.height, 6)
  })

  it('на окне с пропорциями кадра показывает кадр целиком', () => {
    const region = coverRegion(IMAGE, {width: 3439, height: 1379})

    expect(region).toMatchObject({left: 0, top: 0, width: IMAGE.width, height: IMAGE.height})
  })

  it('сохраняет пропорции окна — иначе картинка и сцена разъедутся', () => {
    for (const viewport of [WIDE, PORTRAIT, {width: 844, height: 390}, {width: 1000, height: 900}]) {
      const region = coverRegion(IMAGE, viewport)

      expect(region.width / region.height).toBeCloseTo(viewport.width / viewport.height, 6)
    }
  })

  it('смещает кроп к точке интереса', () => {
    const focus = {x: 1519, y: 819}
    const region = coverRegion(IMAGE, PORTRAIT, focus)

    expect(region.left + region.width / 2).toBeCloseTo(focus.x, 6)
    expect(focus.x).toBeGreaterThan(region.left)
    expect(focus.x).toBeLessThan(region.left + region.width)
  })

  it('не выпускает кроп за края кадра — чёрных полей быть не должно', () => {
    for (const focus of [
      {x: 0, y: 0},
      {x: 3439, y: 1379},
      {x: -500, y: 5000}
    ]) {
      const region = coverRegion(IMAGE, PORTRAIT, focus)

      expect(region.left).toBeGreaterThanOrEqual(0)
      expect(region.top).toBeGreaterThanOrEqual(0)
      expect(region.left + region.width).toBeLessThanOrEqual(IMAGE.width + 1e-6)
      expect(region.top + region.height).toBeLessThanOrEqual(IMAGE.height + 1e-6)
    }
  })

  it('переводится в object-position той же долей свободного хода', () => {
    const region = coverRegion(IMAGE, PORTRAIT, {x: 1519, y: 819})
    const position = regionToObjectPosition(IMAGE, region)

    expect(position.x).toBeCloseTo((region.left / (IMAGE.width - region.width)) * 100, 6)
    expect(position.y).toBe(50)
  })

  it('согласован с прежним расчётом угла обзора при кропе от центра', () => {
    const fovY = focalLengthToFovY(FOCAL_LENGTH_MM, SENSOR_HEIGHT_MM)

    for (const viewport of [WIDE, PORTRAIT, {width: 3000, height: 800}]) {
      const region = coverRegion(IMAGE, viewport)
      const fromRegion = 2 * Math.atan((Math.tan(fovY / 2 / (180 / Math.PI)) * region.height) / IMAGE.height)

      expect((fromRegion * 180) / Math.PI).toBeCloseTo(coverFovY(fovY, IMAGE, viewport), 10)
    }
  })
})
