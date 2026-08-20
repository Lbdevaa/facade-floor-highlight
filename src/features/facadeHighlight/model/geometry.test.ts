import {BoxGeometry, BufferGeometry, Vector3} from 'three'
import {describe, expect, it} from 'vitest'
import {keepNearFaces, keepVerticalFaces} from './geometry'

const triangleCount = (geometry: BufferGeometry) => geometry.attributes.position.count / 3

const normalsOf = (geometry: BufferGeometry) => {
  const position = geometry.attributes.position
  const normals: Vector3[] = []

  for (let i = 0; i < position.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(position, i)
    const b = new Vector3().fromBufferAttribute(position, i + 1)
    const c = new Vector3().fromBufferAttribute(position, i + 2)

    normals.push(new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize())
  }

  return normals
}

describe('стены объёма', () => {
  it('у коробки остаются четыре стены из шести граней', () => {
    const box = keepVerticalFaces(new BoxGeometry(10, 4, 10).toNonIndexed())

    // 12 треугольников у куба, крышка и дно — четыре из них
    expect(triangleCount(box)).toBe(8)
  })

  it('ни одна оставшаяся грань не смотрит вверх или вниз', () => {
    const box = keepVerticalFaces(new BoxGeometry(10, 4, 10).toNonIndexed())

    for (const normal of normalsOf(box)) {
      expect(Math.abs(normal.y)).toBeLessThan(0.5)
    }
  })

  it('высота ленты сохраняется — это высота этажа', () => {
    const box = keepVerticalFaces(new BoxGeometry(10, 4, 10).toNonIndexed())
    box.computeBoundingBox()

    expect(box.boundingBox!.max.y - box.boundingBox!.min.y).toBeCloseTo(4, 6)
  })

  it('плоскую горизонтальную геометрию выбрасывает целиком', () => {
    const floor = keepVerticalFaces(new BoxGeometry(10, 0, 10).toNonIndexed())

    expect(triangleCount(floor)).toBe(0)
  })
})

describe('ближняя сторона объёма', () => {
  const walls = () => keepVerticalFaces(new BoxGeometry(10, 4, 10).toNonIndexed())

  /** Середины треугольников — по ним функция и решает, оставлять грань или нет. */
  const middles = (geometry: BufferGeometry) => {
    const position = geometry.attributes.position
    const result: Vector3[] = []

    for (let i = 0; i < position.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(position, i)
      const b = new Vector3().fromBufferAttribute(position, i + 1)
      const c = new Vector3().fromBufferAttribute(position, i + 2)

      result.push(a.add(b).add(c).divideScalar(3))
    }

    return result
  }

  it('оставляет половину стен — ту, что смотрит на камеру', () => {
    const near = keepNearFaces(walls(), new Vector3(0, 0, 100))

    expect(triangleCount(near)).toBe(triangleCount(walls()) / 2)
  })

  it('каждая оставленная грань ближе к камере, чем центр этажа', () => {
    const camera = new Vector3(0, 0, 100)
    const near = keepNearFaces(walls(), camera)

    for (const middle of middles(near)) {
      expect(middle.distanceTo(camera)).toBeLessThan(camera.length())
    }
  })

  it('поворот камеры поворачивает и отобранную сторону', () => {
    const camera = new Vector3(100, 0, 0)
    const near = keepNearFaces(walls(), camera)

    for (const middle of middles(near)) {
      expect(middle.x).toBeGreaterThan(0)
    }
  })
})
