import type {Vector3} from 'three'
import type {ShotConfig} from 'entities/sceneConfig'
import {coverRegion, type CoverRegion} from 'shared/lib/lens'
import {createShotCamera, projectPoint} from 'shared/lib/projection'

/**
 * Прямоугольник кадра, который останется видимым в окне.
 *
 * Кроп ведётся не от центра изображения, а от проекции подсвечиваемого объёма: на узком
 * экране от кадра остаётся полоса шириной около 640 пикселей из 3439, и здание в неё
 * попросту не попадает. Пока геометрия не загрузилась, центра ещё нет — кропаем от центра
 * кадра, но и картинку в этот момент не показываем, чтобы она потом не дёрнулась.
 */
export const regionForShot = (
  shot: ShotConfig,
  sensorHeightMm: number,
  viewport: {width: number; height: number},
  worldCenter: Vector3 | null
): {region: CoverRegion; focus: {x: number; y: number} | null} => {
  const image = {width: shot.imageWidthPx, height: shot.imageHeightPx}

  if (!worldCenter) {
    return {region: coverRegion(image, viewport), focus: null}
  }

  const point = projectPoint(worldCenter, shot, createShotCamera(shot, sensorHeightMm))
  const focus = point.depth > -1 && point.depth < 1 ? {x: point.x, y: point.y} : null

  return {region: coverRegion(image, viewport, focus ?? undefined), focus}
}
