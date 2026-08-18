import {describe, expect, it} from 'vitest'
import {coverFovY, coverScale, focalLengthToFovY, fovYToFovX} from './index'

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
