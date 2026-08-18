import type {UeRotation, UeVector} from 'shared/lib/ueMath'
import type {HighlightModelConfig, SceneConfig, ShotCameraConfig, ShotConfig} from '../model/types'

/**
 * Проверка конфига при загрузке.
 *
 * Конфиг живёт в public/ и правится руками — в том числе ревьюером, который подставит
 * параметры третьего кадра. Пропущенное поле не должно превращаться в NaN и молча
 * сдвигать геометрию: ошибка обязана быть видимой и называть точный путь до поля.
 */
export class SceneConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneConfigError'
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SceneConfigError(`${path}: ожидался объект, получено ${JSON.stringify(value)}`)
  }

  return value as Record<string, unknown>
}

function asFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SceneConfigError(`${path}: ожидалось число, получено ${JSON.stringify(value)}`)
  }

  return value
}

function asPositiveNumber(value: unknown, path: string): number {
  const parsed = asFiniteNumber(value, path)

  if (parsed <= 0) {
    throw new SceneConfigError(`${path}: ожидалось положительное число, получено ${parsed}`)
  }

  return parsed
}

function asNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SceneConfigError(`${path}: ожидалась непустая строка, получено ${JSON.stringify(value)}`)
  }

  return value
}

function parseUeVector(value: unknown, path: string): UeVector {
  const raw = asRecord(value, path)

  return {
    x: asFiniteNumber(raw.x, `${path}.x`),
    y: asFiniteNumber(raw.y, `${path}.y`),
    z: asFiniteNumber(raw.z, `${path}.z`)
  }
}

function parseUeRotation(value: unknown, path: string): UeRotation {
  const raw = asRecord(value, path)

  return {
    pitch: asFiniteNumber(raw.pitch, `${path}.pitch`),
    yaw: asFiniteNumber(raw.yaw, `${path}.yaw`),
    roll: asFiniteNumber(raw.roll, `${path}.roll`)
  }
}

function parseCamera(value: unknown, path: string): ShotCameraConfig {
  const raw = asRecord(value, path)

  return {
    positionCmUe: parseUeVector(raw.positionCmUe, `${path}.positionCmUe`),
    rotationDegUe: parseUeRotation(raw.rotationDegUe, `${path}.rotationDegUe`),
    focalLengthMm: asPositiveNumber(raw.focalLengthMm, `${path}.focalLengthMm`)
  }
}

function parseShot(value: unknown, path: string): ShotConfig {
  const raw = asRecord(value, path)

  return {
    id: asNonEmptyString(raw.id, `${path}.id`),
    title: asNonEmptyString(raw.title, `${path}.title`),
    imageSrc: asNonEmptyString(raw.imageSrc, `${path}.imageSrc`),
    imageWidthPx: asPositiveNumber(raw.imageWidthPx, `${path}.imageWidthPx`),
    imageHeightPx: asPositiveNumber(raw.imageHeightPx, `${path}.imageHeightPx`),
    camera: parseCamera(raw.camera, `${path}.camera`)
  }
}

function parseModel(value: unknown, path: string): HighlightModelConfig {
  const raw = asRecord(value, path)

  return {
    src: asNonEmptyString(raw.src, `${path}.src`),
    label: asNonEmptyString(raw.label, `${path}.label`),
    positionCmUe: parseUeVector(raw.positionCmUe, `${path}.positionCmUe`),
    rotationDegUe: parseUeRotation(raw.rotationDegUe, `${path}.rotationDegUe`)
  }
}

export function parseSceneConfig(value: unknown): SceneConfig {
  const raw = asRecord(value, 'config')

  if (!Array.isArray(raw.shots) || raw.shots.length === 0) {
    throw new SceneConfigError('config.shots: ожидался непустой массив кадров')
  }

  const shots = raw.shots.map((shot, index) => parseShot(shot, `config.shots[${index}]`))
  const duplicate = shots.find((shot, index) => shots.findIndex((other) => other.id === shot.id) !== index)

  if (duplicate) {
    throw new SceneConfigError(`config.shots: идентификатор «${duplicate.id}» встречается больше одного раза`)
  }

  return {
    sensorHeightMm: asPositiveNumber(raw.sensorHeightMm, 'config.sensorHeightMm'),
    model: parseModel(raw.model, 'config.model'),
    shots
  }
}
