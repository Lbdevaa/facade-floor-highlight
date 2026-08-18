import type {UeRotation, UeVector} from 'shared/lib/ueMath'

/**
 * Разбор scene.config.json. Единицы измерения зашиты в имена полей: комментариев
 * в JSON нет, а перепутать сантиметры с метрами или градусы с радианами — самый
 * дорогой способ ошибиться в этой задаче.
 */

/** Параметры камеры ровно в том виде, в каком они лежат в Transform_cameras.txt. */
export interface ShotCameraConfig {
  positionCmUe: UeVector
  rotationDegUe: UeRotation
  focalLengthMm: number
}

/** Кадр: изображение и камера, с которой оно снято. */
export interface ShotConfig {
  id: string
  title: string
  imageSrc: string
  imageWidthPx: number
  imageHeightPx: number
  camera: ShotCameraConfig
}

/** Подсвечиваемый объём. Положение подобрано один раз и от кадра не зависит. */
export interface HighlightModelConfig {
  src: string
  label: string
  positionCmUe: UeVector
  rotationDegUe: UeRotation
}

export interface SceneConfig {
  /**
   * Высота матрицы, миллиметры. Filmback «16:9 Digital Film» — 23.76 × 13.365 мм.
   * Ширина не используется: кадры сняты как скриншоты вьюпорта, см. shared/lib/lens.
   */
  sensorHeightMm: number
  model: HighlightModelConfig
  shots: ShotConfig[]
}
