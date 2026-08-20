import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import {parseSceneConfig, SceneConfigError} from './parse'

const REAL_CONFIG = JSON.parse(readFileSync('public/scene.config.json', 'utf8'))

/* eslint-disable @typescript-eslint/no-explicit-any -- конфиг в тестах ломается намеренно, типы тут мешают */

/** Копия конфига с изменённым полем: мутировать общий объект между тестами нельзя. */
const withPatch = (patch: (config: Record<string, any>) => void): unknown => {
  const copy = structuredClone(REAL_CONFIG)
  patch(copy)

  return copy
}

describe('конфиг сцены', () => {
  it('реальный public/scene.config.json проходит проверку', () => {
    const config = parseSceneConfig(REAL_CONFIG)

    expect(config.sensorHeightMm).toBe(13.365)
    expect(config.shots).toHaveLength(2)
    expect(config.shots[0].camera.focalLengthMm).toBe(25)
    expect(config.shots[0].camera.rotationDegUe.yaw).toBeCloseTo(-90.03614, 5)
  })

  it('хранит параметры камеры ровно как в Transform_cameras.txt, без пересчёта', () => {
    const [first, second] = parseSceneConfig(REAL_CONFIG).shots

    expect(first.camera.positionCmUe).toEqual({x: -8219.125682, y: 17917.186677, z: 21877.937132})
    expect(second.camera.positionCmUe).toEqual({x: -26815.163848, y: -299.492574, z: 22587.838344})
  })
})

describe('ошибки конфига', () => {
  it('называет путь до пропущенного поля', () => {
    const broken = withPatch((config) => delete config.shots[1].camera.focalLengthMm)

    expect(() => parseSceneConfig(broken)).toThrow(SceneConfigError)
    expect(() => parseSceneConfig(broken)).toThrow('config.shots[1].camera.focalLengthMm')
  })

  it('не пропускает строку вместо числа — иначе в матрицу уедет NaN', () => {
    const broken = withPatch((config) => {
      config.shots[0].camera.rotationDegUe.pitch = '-16.484003'
    })

    expect(() => parseSceneConfig(broken)).toThrow('config.shots[0].camera.rotationDegUe.pitch')
  })

  it('не пропускает null в позиции модели', () => {
    const broken = withPatch((config) => {
      config.model.positionCmUe.z = null
    })

    expect(() => parseSceneConfig(broken)).toThrow('config.model.positionCmUe.z')
  })

  it('требует положительное фокусное расстояние', () => {
    const broken = withPatch((config) => {
      config.shots[0].camera.focalLengthMm = 0
    })

    expect(() => parseSceneConfig(broken)).toThrow('положительное число')
  })

  it('ловит повторяющийся идентификатор кадра', () => {
    const broken = withPatch((config) => {
      config.shots[1].id = config.shots[0].id
    })

    expect(() => parseSceneConfig(broken)).toThrow('больше одного раза')
  })

  it('требует хотя бы один кадр', () => {
    expect(() => parseSceneConfig(withPatch((config) => (config.shots = [])))).toThrow('непустой массив')
  })

  it('переживает мусор вместо конфига', () => {
    expect(() => parseSceneConfig(null)).toThrow(SceneConfigError)
    expect(() => parseSceneConfig('строка')).toThrow(SceneConfigError)
    expect(() => parseSceneConfig([])).toThrow(SceneConfigError)
  })
})
