import {useMemo, useState} from 'react'
import type {Vector3} from 'three'
import type {ShotConfig} from 'entities/sceneConfig'
import {createShotCamera, projectPoint} from 'shared/lib/projection'

/**
 * Точка кадра, вокруг которой имеет смысл кропать, — проекция подсвечиваемого объёма.
 *
 * Центр кадра для этого не годится: объём стоит не в центре, а на узком экране от кадра
 * остаётся полоса шириной около 640 пикселей из 3439. Считается по центру габарита
 * геометрии, а не по её началу координат: на первом кадре они расходятся на 335 пикселей,
 * то есть больше половины видимой полосы.
 */
export const useFocusPoint = (shot: ShotConfig, sensorHeightMm: number) => {
  const [worldCenter, setWorldCenter] = useState<Vector3 | null>(null)

  const focus = useMemo(() => {
    if (!worldCenter) return null

    const camera = createShotCamera(shot, sensorHeightMm)
    const point = projectPoint(worldCenter, shot, camera)

    return point.depth > -1 && point.depth < 1 ? {x: point.x, y: point.y} : null
  }, [worldCenter, shot, sensorHeightMm])

  return {focus, setWorldCenter}
}
