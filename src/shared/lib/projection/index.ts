import {PerspectiveCamera, Vector3} from 'three'
import {focalLengthToFovY} from '../lens'
import {uePositionToThree, ueRotationToCameraQuaternion, type UeRotation, type UeVector} from '../ueMath'

/** Всё, что нужно, чтобы построить камеру кадра: сырые параметры плюс размер изображения. */
export interface ShotView {
  imageWidthPx: number
  imageHeightPx: number
  camera: {
    positionCmUe: UeVector
    rotationDegUe: UeRotation
    focalLengthMm: number
  }
}

/**
 * Камера кадра целиком: позиция, поворот и угол обзора из сырых параметров Unreal.
 * Аспект — пропорции самого кадра, без учёта окна: кроп под окно накладывается отдельно
 * через setViewOffset, см. coverRegion.
 */
export const createShotCamera = (shot: ShotView, sensorHeightMm: number): PerspectiveCamera => {
  const camera = new PerspectiveCamera(
    focalLengthToFovY(shot.camera.focalLengthMm, sensorHeightMm),
    shot.imageWidthPx / shot.imageHeightPx,
    0.1,
    20000
  )
  camera.position.copy(uePositionToThree(shot.camera.positionCmUe))
  camera.quaternion.copy(ueRotationToCameraQuaternion(shot.camera.rotationDegUe))
  camera.updateMatrixWorld(true)

  return camera
}

/** Точка мира в пикселях кадра. `depth` вне отрезка [−1, 1] означает, что точка не в кадре. */
export interface ProjectedPoint {
  x: number
  y: number
  depth: number
}

/** Проекция точки сцены на кадр. */
export const projectPoint = (point: Vector3, shot: ShotView, camera: PerspectiveCamera): ProjectedPoint => {
  const ndc = point.clone().project(camera)

  return {
    x: ((ndc.x + 1) / 2) * shot.imageWidthPx,
    y: ((1 - ndc.y) / 2) * shot.imageHeightPx,
    depth: ndc.z
  }
}

/** То же для точки в координатах Unreal (сантиметры). */
export const projectUePoint = (point: UeVector, shot: ShotView, camera: PerspectiveCamera): ProjectedPoint => {
  return projectPoint(uePositionToThree(point), shot, camera)
}
