import {PerspectiveCamera} from '@react-three/drei'
import type {ShotConfig} from 'entities/sceneConfig'
import {uePositionToThree, ueRotationToCameraQuaternion} from 'shared/lib/ueMath'
import {useCoverFov} from '../../model/useCoverFov'

interface Props {
  shot: ShotConfig
  sensorHeightMm: number
}

/**
 * Камера кадра. Позиция и поворот приходят из конфига как есть и от устройства
 * не зависят; под окно подстраивается только угол обзора.
 *
 * Камера описана пропсами, а не мутацией объекта three: аспект и проекционную
 * матрицу drei пересчитывает сам на каждом ресайзе.
 */
export function ShotCamera({shot, sensorHeightMm}: Props) {
  const fov = useCoverFov(shot, sensorHeightMm)
  const position = uePositionToThree(shot.camera.positionCmUe)
  const quaternion = ueRotationToCameraQuaternion(shot.camera.rotationDegUe)

  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      near={0.1}
      far={20000}
      position={[position.x, position.y, position.z]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
    />
  )
}
