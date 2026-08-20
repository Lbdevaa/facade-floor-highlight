import {useThree} from '@react-three/fiber'
import type {ShotConfig} from 'entities/sceneConfig'
import {coverFovY, focalLengthToFovY} from 'shared/lib/lens'

/**
 * Вертикальный угол обзора для текущего размера канваса.
 *
 * Кадр показан в режиме cover, значит камера обязана видеть ровно ту его часть,
 * которая осталась на экране: угол сжимается на видимую долю высоты. Без этого
 * геометрия поедет при первом же изменении пропорций окна.
 */
export const useCoverFov = (shot: ShotConfig, sensorHeightMm: number): number => {
  const size = useThree((state) => state.size)
  const imageFovY = focalLengthToFovY(shot.camera.focalLengthMm, sensorHeightMm)

  return coverFovY(
    imageFovY,
    {width: shot.imageWidthPx, height: shot.imageHeightPx},
    {width: size.width, height: size.height}
  )
}
