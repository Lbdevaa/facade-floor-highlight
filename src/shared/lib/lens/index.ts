const DEG = 180 / Math.PI

/**
 * Вертикальный угол обзора по фокусному расстоянию и высоте матрицы.
 *
 * Кадры — не рендеры, а скриншоты вьюпорта Unreal с аспектом ~2.49 вместо 16:9,
 * поэтому ширина матрицы (23.76 мм) на них не действует: движок фиксирует вертикальный
 * угол, горизонтальный тянется за пропорциями картинки. При f = 25 мм и высоте
 * матрицы 13.365 мм это 29.9306°.
 */
export const focalLengthToFovY = (focalLengthMm: number, sensorHeightMm: number): number => {
  return 2 * Math.atan(sensorHeightMm / 2 / focalLengthMm) * DEG
}

/** Горизонтальный угол — следствие вертикального и пропорций кадра. Нужен для отладки. */
export const fovYToFovX = (fovYDeg: number, aspect: number): number => {
  return 2 * Math.atan(Math.tan(fovYDeg / DEG / 2) * aspect) * DEG
}

/** Во сколько раз кадр увеличен, чтобы закрыть окно целиком (режим cover). */
export const coverScale = (
  image: {width: number; height: number},
  viewport: {width: number; height: number}
): number => {
  return Math.max(viewport.width / image.width, viewport.height / image.height)
}

/**
 * Вертикальный угол обзора под окно, в котором кадр показан в режиме cover.
 *
 * Изображение кропается по длинной стороне — растягивать его нельзя, — значит виртуальная
 * камера обязана видеть ровно ту часть кадра, которая осталась на экране. Без этого
 * геометрия поедет при первом же изменении пропорций окна, а проверять будут именно этим.
 */
export const coverFovY = (
  imageFovYDeg: number,
  image: {width: number; height: number},
  viewport: {width: number; height: number}
): number => {
  const visibleFraction = viewport.height / coverScale(image, viewport) / image.height

  return 2 * Math.atan(Math.tan(imageFovYDeg / DEG / 2) * visibleFraction) * DEG
}

/** Прямоугольник кадра, который остаётся видимым после кропа, в пикселях изображения. */
export interface CoverRegion {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Какая часть кадра видна в окне и где именно.
 *
 * Кадр показывается в режиме cover: он масштабируется до заполнения окна и кропается
 * по длинной стороне. По умолчанию кроп идёт от центра, но центр кадра и то, ради чего
 * кадр показывают, — разные точки. На узком экране телефона от кадра 3439×1379 остаётся
 * полоса шириной около 640 px, и здание в неё может не попасть.
 *
 * Поэтому кроп смещается к точке интереса — проекции подсвечиваемого объёма, — но не дальше
 * краёв изображения: чёрных полей быть не должно.
 */
export const coverRegion = (
  image: {width: number; height: number},
  viewport: {width: number; height: number},
  focus?: {x: number; y: number}
): CoverRegion => {
  const scale = coverScale(image, viewport)
  const width = Math.min(viewport.width / scale, image.width)
  const height = Math.min(viewport.height / scale, image.height)

  const centerX = focus?.x ?? image.width / 2
  const centerY = focus?.y ?? image.height / 2

  return {
    left: clamp(centerX - width / 2, 0, image.width - width),
    top: clamp(centerY - height / 2, 0, image.height - height),
    width,
    height
  }
}

/**
 * Тот же кроп в терминах object-position для картинки: доля свободного хода по каждой оси.
 * Если кропать нечего, браузеру всё равно, какое значение он получит — отдаём центр.
 */
export const regionToObjectPosition = (image: {width: number; height: number}, region: CoverRegion) => {
  const freeX = image.width - region.width
  const freeY = image.height - region.height

  return {
    x: freeX > 0 ? (region.left / freeX) * 100 : 50,
    y: freeY > 0 ? (region.top / freeY) * 100 : 50
  }
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}
