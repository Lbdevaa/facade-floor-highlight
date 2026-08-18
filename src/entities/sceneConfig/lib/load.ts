import {parseSceneConfig} from './parse'
import type {SceneConfig} from '../model/types'

/** Путь к файлу из public/ с учётом base сборки: на GitHub Pages страница живёт в подкаталоге. */
export function publicUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`
}

const CONFIG_PATH = 'scene.config.json'

/**
 * Конфиг читается в runtime, а не собирается в бандл: параметры камеры можно
 * поменять на живой странице без пересборки.
 */
export async function loadSceneConfig(signal?: AbortSignal): Promise<SceneConfig> {
  const response = await fetch(publicUrl(CONFIG_PATH), {signal})

  if (!response.ok) {
    throw new Error(`Конфиг ${CONFIG_PATH} не загрузился: ${response.status} ${response.statusText}`)
  }

  return parseSceneConfig(await response.json())
}
