import {useLoader} from '@react-three/fiber'
import {useMemo, useState} from 'react'
import {DoubleSide, Mesh} from 'three'
import type {BufferGeometry} from 'three'
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js'
import {publicUrl, type HighlightModelConfig} from 'entities/sceneConfig'
import {ueGeometryMatrix, uePositionToThree, ueRotationToObjectQuaternion} from 'shared/lib/ueMath'

const HOVER_COLOR = '#4da3ff'
const DEBUG_COLOR = '#ff3b30'

interface Props {
  model: HighlightModelConfig
  debug: boolean
  onHoverChange: (hovered: boolean) => void
}

/**
 * Объём этажа поверх фасада.
 *
 * Из fbx берётся только геометрия: трансформ узла внутри файла — это конверсия осей
 * экспортёра, а положение в мире задаёт конфиг. Масштаб не трогаем, модель приходит
 * в натуральную величину. По умолчанию объём полностью прозрачен и виден только
 * при наведении — в отладочном режиме подсвечивается сеткой.
 */
export function HighlightVolume({model, debug, onHoverChange}: Props) {
  const fbx = useLoader(FBXLoader, publicUrl(model.src))
  const [hovered, setHovered] = useState(false)

  const geometry = useMemo(() => {
    let source: BufferGeometry | null = null

    fbx.traverse((node) => {
      if (source === null && node instanceof Mesh) {
        source = node.geometry as BufferGeometry
      }
    })

    if (source === null) {
      throw new Error(`В файле ${model.src} нет ни одного меша`)
    }

    const converted = (source as BufferGeometry).clone()
    converted.applyMatrix4(ueGeometryMatrix())

    return converted
  }, [fbx, model.src])

  const setHover = (next: boolean) => {
    setHovered(next)
    onHoverChange(next)
  }

  // В отладочном режиме объём видно всегда, в обычном он проявляется только под курсором.
  const appearance =
    hovered ? {color: HOVER_COLOR, opacity: 0.38}
    : debug ? {color: DEBUG_COLOR, opacity: 0.35}
    : {color: HOVER_COLOR, opacity: 0}

  return (
    <mesh
      geometry={geometry}
      position={uePositionToThree(model.positionCmUe)}
      quaternion={ueRotationToObjectQuaternion(model.rotationDegUe)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onPointerDown={() => setHover(true)}
    >
      <meshBasicMaterial
        color={appearance.color}
        opacity={appearance.opacity}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
      {debug && (
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color={DEBUG_COLOR} />
        </lineSegments>
      )}
    </mesh>
  )
}
