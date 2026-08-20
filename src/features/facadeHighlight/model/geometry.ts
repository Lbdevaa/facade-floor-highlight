import {BufferAttribute, BufferGeometry, Vector3} from 'three'

/**
 * Возвращает порядок обхода вершин, потерянный при отражении.
 *
 * Перевод координат Unreal в three — отражение с определителем −1, оно выворачивает
 * треугольники наизнанку, и нормали начинают смотреть внутрь объёма. Пока грани рисуются
 * с двух сторон, это незаметно, но как только нужно показать только обращённые к камере —
 * важно, куда смотрит нормаль.
 */
export const flipWinding = (geometry: BufferGeometry): BufferGeometry => {
  const result = (geometry.index ? geometry.toNonIndexed() : geometry.clone()) as BufferGeometry
  const position = result.attributes.position as BufferAttribute

  for (let i = 0; i < position.count; i += 3) {
    for (const axis of [0, 1, 2] as const) {
      const second = position.array[(i + 1) * 3 + axis]
      position.array[(i + 1) * 3 + axis] = position.array[(i + 2) * 3 + axis]
      position.array[(i + 2) * 3 + axis] = second
    }
  }

  position.needsUpdate = true
  result.computeVertexNormals()

  return result
}

/** Грань считается горизонтальной, если её нормаль отклоняется от вертикали меньше чем на 60°. */
const HORIZONTAL_LIMIT = 0.5

/**
 * Оставляет от объёма только вертикальные грани — стены этажа.
 *
 * В fbx лежит замкнутая коробка: контур этажа плюс четыре метра высоты, то есть со крышкой
 * и дном. Камера смотрит на дом сверху под углом, поэтому крышка — горизонтальная плита
 * 38×38 м — проецируется огромным пятном и накрывает соседние этажи; её площадь втрое больше
 * площади стен. В настоящем здании её закрыли бы вышележащие этажи, но в сцене их нет.
 *
 * Без крышки подсветка ложится лентой по фасаду ровно между перекрытиями, а заодно
 * совпадают видимая область и зона попадания курсора: раньше луч попадал в крышку,
 * и наведение на соседний этаж срабатывало как попадание в седьмой.
 */
export const keepVerticalFaces = (geometry: BufferGeometry): BufferGeometry => {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const position = source.attributes.position

  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const normal = new Vector3()
  const kept: number[] = []

  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)

    normal.crossVectors(b.clone().sub(a), c.clone().sub(a))

    // Вырожденный треугольник не имеет ни площади, ни направления — он ничего не подсветит.
    if (normal.lengthSq() < 1e-12) continue

    if (Math.abs(normal.normalize().y) >= HORIZONTAL_LIMIT) continue

    for (const vertex of [a, b, c]) {
      kept.push(vertex.x, vertex.y, vertex.z)
    }
  }

  const result = new BufferGeometry()
  result.setAttribute('position', new BufferAttribute(new Float32Array(kept), 3))
  result.computeVertexNormals()

  return result
}

/**
 * Оставляет только ближнюю к камере половину стен.
 *
 * Контур этажа замкнут, поэтому у него есть и дальняя сторона. Её грани в нишах и изгибах
 * фасада бывают повёрнуты к камере — односторонний материал их не отсекает, — а находятся
 * дальше, и на кадре они всплывают отдельными кусками выше ленты. В настоящем здании их
 * закрывал бы сам дом, но в сцене, кроме объёма этажа, ничего нет.
 *
 * Разделение идёт по центру объёма: грань остаётся, если её середина ближе к камере,
 * чем центр этажа. Камера смены кадра меняется редко, так что фильтр считается заново
 * только при переключении.
 *
 * Координаты — локальные для модели, камеру нужно перевести в них заранее.
 */
export const keepNearFaces = (geometry: BufferGeometry, cameraLocal: Vector3): BufferGeometry => {
  const position = geometry.attributes.position
  const center = new Vector3()
  geometry.computeBoundingBox()
  geometry.boundingBox?.getCenter(center)

  const centerDistance = center.distanceTo(cameraLocal)
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const kept: number[] = []

  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)

    const middle = a.clone().add(b).add(c).divideScalar(3)

    if (middle.distanceTo(cameraLocal) >= centerDistance) continue

    for (const vertex of [a, b, c]) {
      kept.push(vertex.x, vertex.y, vertex.z)
    }
  }

  const result = new BufferGeometry()
  result.setAttribute('position', new BufferAttribute(new Float32Array(kept), 3))
  result.computeVertexNormals()

  return result
}
