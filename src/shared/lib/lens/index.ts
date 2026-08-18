const DEG = 180 / Math.PI

/**
 * Вертикальный угол обзора по фокусному расстоянию и высоте матрицы.
 *
 * Кадры — не рендеры, а скриншоты вьюпорта Unreal с аспектом ~2.49 вместо 16:9,
 * поэтому ширина матрицы (23.76 мм) на них не действует: движок фиксирует вертикальный
 * угол, горизонтальный тянется за пропорциями картинки. При f = 25 мм и высоте
 * матрицы 13.365 мм это 29.9306°.
 */
export function focalLengthToFovY(focalLengthMm: number, sensorHeightMm: number): number {
  return 2 * Math.atan(sensorHeightMm / 2 / focalLengthMm) * DEG
}

/** Горизонтальный угол — следствие вертикального и пропорций кадра. Нужен для отладки. */
export function fovYToFovX(fovYDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(fovYDeg / DEG / 2) * aspect) * DEG
}

/** Во сколько раз кадр увеличен, чтобы закрыть окно целиком (режим cover). */
export function coverScale(image: {width: number; height: number}, viewport: {width: number; height: number}): number {
  return Math.max(viewport.width / image.width, viewport.height / image.height)
}

/**
 * Вертикальный угол обзора под окно, в котором кадр показан в режиме cover.
 *
 * Изображение кропается по длинной стороне — растягивать его нельзя, — значит виртуальная
 * камера обязана видеть ровно ту часть кадра, которая осталась на экране. Без этого
 * геометрия поедет при первом же изменении пропорций окна, а проверять будут именно этим.
 */
export function coverFovY(
  imageFovYDeg: number,
  image: {width: number; height: number},
  viewport: {width: number; height: number}
): number {
  const visibleFraction = viewport.height / coverScale(image, viewport) / image.height

  return 2 * Math.atan(Math.tan(imageFovYDeg / DEG / 2) * visibleFraction) * DEG
}
