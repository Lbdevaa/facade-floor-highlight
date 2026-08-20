import {PerspectiveCamera} from '@react-three/drei'
import {useLayoutEffect, useRef} from 'react'
import type {PerspectiveCamera as PerspectiveCameraImpl} from 'three'
import type {ShotConfig} from 'entities/sceneConfig'
import {focalLengthToFovY, type CoverRegion} from 'shared/lib/lens'
import {uePositionToThree, ueRotationToCameraQuaternion} from 'shared/lib/ueMath'

interface Props {
  shot: ShotConfig
  sensorHeightMm: number
  region: CoverRegion
}

/**
 * Камера кадра.
 *
 * Позиция, поворот и угол обзора приходят из конфига и от устройства не зависят —
 * камера описывает исходный кадр целиком. Под окно подстраивается не она, а вырезанная
 * из кадра область: setViewOffset говорит камере рендерить прямоугольник region
 * из полного кадра. Ровно тот же прямоугольник показывает картинка под канвасом,
 * поэтому геометрия остаётся приклеенной к изображению при любых пропорциях окна.
 */
export const ShotCamera = ({shot, sensorHeightMm, region}: Props) => {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const position = uePositionToThree(shot.camera.positionCmUe)
  const quaternion = ueRotationToCameraQuaternion(shot.camera.rotationDegUe)

  useLayoutEffect(() => {
    const camera = cameraRef.current
    if (!camera || region.width <= 0 || region.height <= 0) return

    camera.setViewOffset(shot.imageWidthPx, shot.imageHeightPx, region.left, region.top, region.width, region.height)
    camera.updateProjectionMatrix()

    return () => {
      camera.clearViewOffset()
    }
  }, [shot.imageWidthPx, shot.imageHeightPx, region])

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      manual
      fov={focalLengthToFovY(shot.camera.focalLengthMm, sensorHeightMm)}
      aspect={shot.imageWidthPx / shot.imageHeightPx}
      near={0.1}
      far={20000}
      position={[position.x, position.y, position.z]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
    />
  )
}
