import {Canvas} from '@react-three/fiber'
import {Suspense, useMemo, useRef, useState} from 'react'
import {publicUrl, type SceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {coverRegion, regionToObjectPosition} from 'shared/lib/lens'
import {useElementSize} from 'shared/lib/useElementSize'
import type {useModelAdjust} from '../../model/useModelAdjust'
import {useFocusPoint} from '../../model/useFocusPoint'
import {AdjustPanel} from '../adjustPanel'
import {DebugBridge} from '../debugBridge'
import {HighlightVolume} from '../highlightVolume'
import {ShotCamera} from '../shotCamera'
import styles from './styles.module.css'

interface Props {
  shot: ShotConfig
  config: SceneConfig
  debug: boolean
  /** Подбор положения объёма: работает только в отладочном режиме, в конфиг не пишет. */
  adjust: ReturnType<typeof useModelAdjust>
}

/**
 * Кадр и сцена лежат друг на друге и показывают одну и ту же часть изображения:
 * картинка кропается через object-position, камера — через setViewOffset, и обе
 * получают один и тот же прямоугольник region. Кадр остаётся картинкой, а не текстурой:
 * так он резче и не занимает видеопамять.
 */
export const FacadeView = ({shot, config, debug, adjust}: Props) => {
  const sensorHeightMm = config.sensorHeightMm
  const model = debug ? adjust.adjusted : config.model

  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  const [highlighted, setHighlighted] = useState(false)
  const [frameLoaded, setFrameLoaded] = useState(false)
  const {focus, setWorldCenter} = useFocusPoint(shot, sensorHeightMm)

  const image = useMemo(
    () => ({width: shot.imageWidthPx, height: shot.imageHeightPx}),
    [shot.imageWidthPx, shot.imageHeightPx]
  )
  // До первого замера контейнера считаем, что окно повторяет пропорции кадра:
  // так на первом кадре не возникает кропа, который тут же пришлось бы менять.
  const region = useMemo(
    () => coverRegion(image, size.width > 0 ? size : image, focus ?? undefined),
    [image, size, focus]
  )
  const objectPosition = regionToObjectPosition(image, region)

  // Кадр показывается, когда известна и картинка, и точка кропа: иначе он дёрнется,
  // как только загрузится геометрия и кроп сместится к зданию.
  const ready = frameLoaded && focus !== null

  return (
    <div ref={containerRef} className={styles.facade} data-hovered={highlighted || undefined}>
      <img
        key={shot.id}
        className={styles.frame}
        src={publicUrl(shot.imageSrc)}
        width={shot.imageWidthPx}
        height={shot.imageHeightPx}
        alt={`Фасад здания, ${shot.title}`}
        draggable={false}
        data-loaded={ready || undefined}
        style={{objectPosition: `${objectPosition.x}% ${objectPosition.y}%`}}
        onLoad={(event) => {
          const element = event.currentTarget

          if (element.naturalWidth !== shot.imageWidthPx || element.naturalHeight !== shot.imageHeightPx) {
            console.error(
              `Кадр ${shot.id}: файл ${element.naturalWidth}×${element.naturalHeight}, ` +
                `а в конфиге ${shot.imageWidthPx}×${shot.imageHeightPx}. ` +
                'Пока числа не совпадают, геометрия не сядет на изображение.'
            )
          }

          setFrameLoaded(true)
        }}
      />
      <Canvas
        className={styles.canvas}
        gl={{antialias: true, alpha: true}}
        dpr={[1, 2]}
        // Нажатие мимо объёма снимает подсветку. На тач-устройстве это единственный способ
        // её убрать: событие ухода указателя там не приходит.
        onPointerMissed={() => setHighlighted(false)}
      >
        <ShotCamera shot={shot} sensorHeightMm={sensorHeightMm} region={region} />
        {debug && <DebugBridge />}
        <Suspense fallback={null}>
          <HighlightVolume
            model={model}
            debug={debug}
            highlighted={highlighted}
            onHighlightChange={setHighlighted}
            onWorldCenterChange={setWorldCenter}
          />
        </Suspense>
      </Canvas>
      {debug && (
        <AdjustPanel
          adjust={adjust}
          cameraInfo={[
            `Кадр ${image.width}×${image.height} (${(image.width / image.height).toFixed(3)})`,
            `Окно ${Math.round(size.width)}×${Math.round(size.height)} (${(size.width / Math.max(size.height, 1)).toFixed(3)})`,
            `Видно ${Math.round(region.width)}×${Math.round(region.height)} от (${Math.round(region.left)}, ${Math.round(region.top)})`,
            focus ? `Кроп по объёму: (${Math.round(focus.x)}, ${Math.round(focus.y)})` : 'Кроп по центру кадра'
          ].join('\n')}
        />
      )}
    </div>
  )
}
