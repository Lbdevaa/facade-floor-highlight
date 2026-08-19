import {readFileSync} from 'node:fs'
import {PerspectiveCamera, Vector3} from 'three'
import {describe, expect, it} from 'vitest'
import {focalLengthToFovY} from 'shared/lib/lens'
import {uePositionToThree, ueRotationToCameraQuaternion} from 'shared/lib/ueMath'
import {parseSceneConfig} from './parse'
import type {ShotConfig} from '../model/types'

/**
 * Задание требует: положение модели одно, при переходе на другой кадр меняются только
 * параметры камеры. Подгонка модели под каждый кадр решением не считается — а проверять
 * будут третьим кадром, которого мы не видели.
 *
 * Эти тесты фиксируют требование структурно, чтобы его нельзя было нарушить незаметно.
 */
const config = parseSceneConfig(JSON.parse(readFileSync('public/scene.config.json', 'utf8')))

/** Куда попадает начало координат модели на кадре, в пикселях исходного изображения. */
function projectModelOrigin(shot: ShotConfig) {
  const camera = new PerspectiveCamera(
    focalLengthToFovY(shot.camera.focalLengthMm, config.sensorHeightMm),
    shot.imageWidthPx / shot.imageHeightPx,
    0.1,
    20000
  )
  camera.position.copy(uePositionToThree(shot.camera.positionCmUe))
  camera.quaternion.copy(ueRotationToCameraQuaternion(shot.camera.rotationDegUe))
  camera.updateMatrixWorld(true)

  const ndc = uePositionToThree(config.model.positionCmUe).project(camera)

  return {
    x: ((ndc.x + 1) / 2) * shot.imageWidthPx,
    y: ((1 - ndc.y) / 2) * shot.imageHeightPx,
    depth: ndc.z
  }
}

describe('положение модели общее для всех кадров', () => {
  it('живёт в одном месте конфига', () => {
    expect(config.model.positionCmUe).toEqual({x: -7393.3, y: 2847, z: 16458.3})
    expect(config.model.rotationDegUe.yaw).toBe(12.5)
  })

  it('кадр не может переопределить положение модели', () => {
    const raw = JSON.parse(readFileSync('public/scene.config.json', 'utf8'))

    for (const shot of raw.shots) {
      // Кадр описывает только изображение и камеру. Положение камеры у него своё —
      // а вот полей модели быть не должно ни на верхнем уровне, ни внутри camera.
      expect(Object.keys(shot).sort()).toEqual(
        ['camera', 'id', 'imageHeightPx', 'imageSrc', 'imageWidthPx', 'title'].sort()
      )
      expect(Object.keys(shot.camera).sort()).toEqual(['focalLengthMm', 'positionCmUe', 'rotationDegUe'].sort())
      expect(shot.model).toBeUndefined()
    }
  })

  it('одно и то же положение видно на каждом кадре', () => {
    for (const shot of config.shots) {
      const point = projectModelOrigin(shot)

      expect(point.depth).toBeGreaterThan(-1)
      expect(point.depth).toBeLessThan(1)
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(shot.imageWidthPx)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(shot.imageHeightPx)
    }
  })
})

describe('кадр, которого мы не видели', () => {
  /**
   * Камера с другой точки съёмки и ненулевым Roll — так решение будут проверять.
   * Модель не трогаем: она обязана встать на место сама.
   */
  const unseenShot: ShotConfig = {
    id: 'unseen',
    title: 'Третий кадр',
    imageSrc: 'assets/unseen.jpg',
    imageWidthPx: 2560,
    imageHeightPx: 1440,
    camera: {
      positionCmUe: {x: -20000, y: 12000, z: 20000},
      rotationDegUe: {pitch: -14, yaw: -50, roll: 7},
      focalLengthMm: 25
    }
  }

  it('модель попадает в кадр без правки её положения', () => {
    const point = projectModelOrigin(unseenShot)

    expect(point.depth).toBeGreaterThan(-1)
    expect(point.depth).toBeLessThan(1)
    expect(point.x).toBeGreaterThan(0)
    expect(point.x).toBeLessThan(unseenShot.imageWidthPx)
    expect(point.y).toBeGreaterThan(0)
    expect(point.y).toBeLessThan(unseenShot.imageHeightPx)
  })

  it('ненулевой Roll разворачивает камеру, а не ломает её', () => {
    const upright = ueRotationToCameraQuaternion({pitch: -14, yaw: -50, roll: 0})
    const rolled = ueRotationToCameraQuaternion({pitch: -14, yaw: -50, roll: 7})
    const up = new Vector3(0, 1, 0)

    expect(up.clone().applyQuaternion(upright).angleTo(up.clone().applyQuaternion(rolled))).toBeCloseTo(
      (7 * Math.PI) / 180,
      6
    )
  })
})
