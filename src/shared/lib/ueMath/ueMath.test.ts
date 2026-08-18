import {Matrix4, PerspectiveCamera, Vector3} from 'three'
import {describe, expect, it} from 'vitest'
import {
  ueDirectionToThree,
  ueGeometryMatrix,
  uePositionToThree,
  ueRotationBasis,
  ueRotationToCameraQuaternion,
  ueRotationToObjectQuaternion
} from './index'

/** Углы, на которых проверяются инварианты. Последние два — с Roll: его даёт третий кадр. */
const ROTATIONS = [
  {pitch: 0, yaw: 0, roll: 0},
  {pitch: -16.484003, yaw: -90.03614, roll: 0},
  {pitch: -18.527453, yaw: -1.348379, roll: 0},
  {pitch: -30, yaw: 137, roll: 12.5},
  {pitch: 42, yaw: -200, roll: -73}
]

describe('приведение координат', () => {
  it('переводит сантиметры Unreal в метры сцены и переставляет Y с Z', () => {
    expect(uePositionToThree({x: -8219.125682, y: 17917.186677, z: 21877.937132}).toArray()).toEqual([
      -82.19125682, 218.77937132, 179.17186677
    ])
  })

  it('меняет хиральность: определитель отображения геометрии равен −1', () => {
    expect(ueGeometryMatrix().determinant()).toBeCloseTo(-1, 12)
  })

  it('отображает точки и направления одним и тем же оператором', () => {
    const vector = {x: 3, y: -5, z: 11}
    const asPoint = uePositionToThree(vector).divideScalar(0.01)

    expect(asPoint.toArray()).toEqual(ueDirectionToThree(vector).toArray())
  })
})

describe('базис FRotationMatrix', () => {
  it.each(ROTATIONS)('ортонормирован при pitch $pitch, yaw $yaw, roll $roll', (rotation) => {
    const {forward, right, up} = ueRotationBasis(rotation)
    const vectors = [forward, right, up].map((axis) => new Vector3(axis.x, axis.y, axis.z))

    for (const vector of vectors) {
      expect(vector.length()).toBeCloseTo(1, 12)
    }

    expect(vectors[0].dot(vectors[1])).toBeCloseTo(0, 12)
    expect(vectors[1].dot(vectors[2])).toBeCloseTo(0, 12)
    expect(vectors[0].dot(vectors[2])).toBeCloseTo(0, 12)
  })

  it.each(ROTATIONS)('даёт правую тройку в three при pitch $pitch, yaw $yaw, roll $roll', (rotation) => {
    const quaternion = ueRotationToCameraQuaternion(rotation)

    expect(new Matrix4().makeRotationFromQuaternion(quaternion).determinant()).toBeCloseTo(1, 12)
  })
})

describe('ориентация камеры', () => {
  it.each(ROTATIONS)('смотрит вдоль forward при pitch $pitch, yaw $yaw, roll $roll', (rotation) => {
    const camera = new PerspectiveCamera()
    camera.quaternion.copy(ueRotationToCameraQuaternion(rotation))
    camera.updateMatrixWorld(true)

    const expected = ueDirectionToThree(ueRotationBasis(rotation).forward)

    expect(camera.getWorldDirection(new Vector3()).angleTo(expected)).toBeCloseTo(0, 10)
  })

  it('сохраняет roll: наклон камеры с roll = 25° отличается от камеры без roll', () => {
    const withoutRoll = ueRotationToCameraQuaternion({pitch: -16, yaw: -90, roll: 0})
    const withRoll = ueRotationToCameraQuaternion({pitch: -16, yaw: -90, roll: 25})

    expect(withoutRoll.angleTo(withRoll)).toBeCloseTo((25 * Math.PI) / 180, 10)
  })

  it('при нулевом повороте смотрит в направление +X Unreal', () => {
    const camera = new PerspectiveCamera()
    camera.quaternion.copy(ueRotationToCameraQuaternion({pitch: 0, yaw: 0, roll: 0}))
    camera.updateMatrixWorld(true)

    const direction = camera.getWorldDirection(new Vector3())

    expect(direction.x).toBeCloseTo(1, 12)
    expect(direction.y).toBeCloseTo(0, 12)
    expect(direction.z).toBeCloseTo(0, 12)
  })
})

describe('ориентация объекта', () => {
  it('при нулевом повороте оставляет геометрию как есть', () => {
    const quaternion = ueRotationToObjectQuaternion({pitch: 0, yaw: 0, roll: 0})

    expect(quaternion.w).toBeCloseTo(1, 12)
    expect(new Vector3(1, 2, 3).applyQuaternion(quaternion).toArray()).toEqual([1, 2, 3])
  })

  it.each(ROTATIONS)('остаётся поворотом при pitch $pitch, yaw $yaw, roll $roll', (rotation) => {
    const quaternion = ueRotationToObjectQuaternion(rotation)

    expect(new Matrix4().makeRotationFromQuaternion(quaternion).determinant()).toBeCloseTo(1, 12)
    expect(new Vector3(4, -7, 2).applyQuaternion(quaternion).length()).toBeCloseTo(Math.sqrt(69), 12)
  })

  it('поворот по Yaw крутит объём вокруг вертикали сцены', () => {
    const rotated = new Vector3(1, 0, 0).applyQuaternion(ueRotationToObjectQuaternion({pitch: 0, yaw: 90, roll: 0}))

    // +X Unreal при Yaw = 90° уходит в +Y Unreal, а это ось Z сцены; высота не меняется
    expect(rotated.x).toBeCloseTo(0, 12)
    expect(rotated.y).toBeCloseTo(0, 12)
    expect(rotated.z).toBeCloseTo(1, 12)
  })
})
