import {useLoader} from '@react-three/fiber'
import {useEffect, useMemo} from 'react'
import {Box3, DoubleSide, Mesh, Vector3} from 'three'
import type {BufferGeometry} from 'three'
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js'
import {publicUrl, type HighlightModelConfig} from 'entities/sceneConfig'
import {ueGeometryMatrix, uePositionToThree, ueRotationToObjectQuaternion} from 'shared/lib/ueMath'

const HOVER_COLOR = '#4da3ff'
const DEBUG_COLOR = '#ff3b30'

interface Props {
  model: HighlightModelConfig
  debug: boolean
  highlighted: boolean
  onHighlightChange: (highlighted: boolean) => void
  /** Центр габарита в координатах сцены — по нему кадрируется изображение. */
  onWorldCenterChange: (center: Vector3) => void
}

/**
 * Объём этажа поверх фасада.
 *
 * Из fbx берётся только геометрия: трансформ узла внутри файла — это конверсия осей
 * экспортёра, а положение в мире задаёт конфиг. Масштаб не трогаем, модель приходит
 * в натуральную величину. По умолчанию объём полностью прозрачен и виден только
 * при наведении — в отладочном режиме подсвечивается сеткой.
 */
export const HighlightVolume = ({model, debug, highlighted, onHighlightChange, onWorldCenterChange}: Props) => {
  const fbx = useLoader(FBXLoader, publicUrl(model.src))

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

  const position = uePositionToThree(model.positionCmUe)
  const quaternion = ueRotationToObjectQuaternion(model.rotationDegUe)

  useEffect(() => {
    const center = new Box3().setFromBufferAttribute(geometry.attributes.position as never).getCenter(new Vector3())

    onWorldCenterChange(center.applyQuaternion(quaternion).add(position))
    // Пересчитывать нужно при смене геометрии или положения модели, а не на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, model.positionCmUe, model.rotationDegUe])

  // В отладочном режиме объём видно всегда, в обычном он проявляется только под курсором.
  const appearance =
    highlighted ? {color: HOVER_COLOR, opacity: 0.38}
    : debug ? {color: DEBUG_COLOR, opacity: 0.35}
    : {color: HOVER_COLOR, opacity: 0}

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      // Мышь: наведение и уход курсора. Касание: pointerdown по объёму включает подсветку,
      // а выключает её промах мимо объёма — onPointerMissed на канвасе. Своего pointerout
      // тач не даёт: после отрыва пальца указатель исчезает, оставаясь над объёмом.
      onPointerOver={() => onHighlightChange(true)}
      onPointerOut={() => onHighlightChange(false)}
      onPointerDown={() => onHighlightChange(true)}
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
