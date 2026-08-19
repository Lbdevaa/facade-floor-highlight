import {Canvas} from '@react-three/fiber'
import {Suspense, useState} from 'react'
import {publicUrl, type SceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {DebugBridge} from '../debugBridge'
import {HighlightVolume} from '../highlightVolume'
import {ShotCamera} from '../shotCamera'
import styles from './styles.module.css'
import type {HighlightModelConfig} from 'entities/sceneConfig'

interface Props {
  shot: ShotConfig
  model: HighlightModelConfig
  sensorHeightMm: SceneConfig['sensorHeightMm']
  debug: boolean
}

/**
 * Кадр и сцена лежат друг на друге и кропаются одинаково: изображение — обычным
 * object-fit: cover, камера — сжатием угла обзора на ту же долю (см. useCoverCamera).
 * Кадр остаётся картинкой, а не текстурой: так он резче и не занимает видеопамять.
 */
export function FacadeView({shot, model, sensorHeightMm, debug}: Props) {
  const [hovered, setHovered] = useState(false)
  const [frameLoaded, setFrameLoaded] = useState(false)

  return (
    <div className={styles.facade} data-hovered={hovered || undefined}>
      <img
        key={shot.id}
        className={styles.frame}
        src={publicUrl(shot.imageSrc)}
        width={shot.imageWidthPx}
        height={shot.imageHeightPx}
        alt={`Фасад здания, ${shot.title}`}
        draggable={false}
        data-loaded={frameLoaded || undefined}
        onLoad={() => setFrameLoaded(true)}
      />
      <Canvas className={styles.canvas} gl={{antialias: true, alpha: true}} dpr={[1, 2]}>
        <ShotCamera shot={shot} sensorHeightMm={sensorHeightMm} />
        {debug && <DebugBridge />}
        <Suspense fallback={null}>
          <HighlightVolume model={model} debug={debug} onHoverChange={setHovered} />
        </Suspense>
      </Canvas>
    </div>
  )
}
