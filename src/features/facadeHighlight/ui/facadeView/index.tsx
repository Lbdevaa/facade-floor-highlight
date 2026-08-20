import {Canvas} from '@react-three/fiber'
import {Suspense, useRef, useState} from 'react'
import type {Vector3} from 'three'
import {publicUrl, type SceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {regionToObjectPosition} from 'shared/lib/lens'
import {useElementSize} from 'shared/lib/useElementSize'
import {regionForShot} from '../../model/focus'
import type {useModelAdjust} from '../../model/useModelAdjust'
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
 * Кадр и сцена показывают одну и ту же часть изображения: картинка кропается через
 * object-position, камера — через setViewOffset, и обе получают один прямоугольник.
 * Кадр остаётся картинкой, а не текстурой: так он резче и не занимает видеопамять.
 *
 * При смене кадра новый грузится под старым и проявляется, когда готов. Камера переезжает
 * ровно в этот момент: если переключить её раньше, объём окажется поверх ещё не сменившегося
 * изображения, то есть на чужом здании.
 */
export const FacadeView = ({shot, config, debug, adjust}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  const [highlighted, setHighlighted] = useState(false)
  const [worldCenter, setWorldCenter] = useState<Vector3 | null>(null)
  const [loadedShots, setLoadedShots] = useState<string[]>([])

  // Показанный кадр и тот, что готовится ему на смену.
  const [displayed, setDisplayed] = useState(shot)
  const incoming = shot.id === displayed.id ? null : shot
  const incomingReady = incoming !== null && loadedShots.includes(incoming.id)
  const active = incomingReady ? incoming : displayed

  const sensorHeightMm = config.sensorHeightMm
  const model = debug ? adjust.adjusted : config.model
  const viewport = size.width > 0 ? size : {width: shot.imageWidthPx, height: shot.imageHeightPx}

  const activeView = regionForShot(active, sensorHeightMm, viewport, worldCenter)
  const ready = loadedShots.includes(displayed.id) && activeView.focus !== null

  const renderFrame = (item: ShotConfig, visible: boolean) => {
    const {region} = regionForShot(item, sensorHeightMm, viewport, worldCenter)
    const position = regionToObjectPosition({width: item.imageWidthPx, height: item.imageHeightPx}, region)

    return (
      <img
        key={item.id}
        className={styles.frame}
        src={publicUrl(item.imageSrc)}
        width={item.imageWidthPx}
        height={item.imageHeightPx}
        alt={`Фасад здания, ${item.title}`}
        draggable={false}
        data-loaded={visible || undefined}
        style={{objectPosition: `${position.x}% ${position.y}%`}}
        onLoad={(event) => {
          const element = event.currentTarget

          if (element.naturalWidth !== item.imageWidthPx || element.naturalHeight !== item.imageHeightPx) {
            console.error(
              `Кадр ${item.id}: файл ${element.naturalWidth}×${element.naturalHeight}, ` +
                `а в конфиге ${item.imageWidthPx}×${item.imageHeightPx}. ` +
                'Пока числа не совпадают, геометрия не сядет на изображение.'
            )
          }

          setLoadedShots((current) => (current.includes(item.id) ? current : [...current, item.id]))

          // Кадр сменился — подсветка предыдущего вида больше не имеет смысла.
          if (item.id !== displayed.id) {
            setHighlighted(false)
          }
        }}
        // Предыдущий кадр убирается, когда новый проявился полностью.
        onAnimationEnd={() => {
          if (visible && item.id !== displayed.id) {
            setDisplayed(item)
          }
        }}
      />
    )
  }

  return (
    <div ref={containerRef} className={styles.facade} data-hovered={highlighted || undefined}>
      {renderFrame(displayed, ready)}
      {incoming && renderFrame(incoming, incomingReady)}

      <Canvas
        className={styles.canvas}
        gl={{antialias: true, alpha: true}}
        dpr={[1, 2]}
        // Нажатие мимо объёма снимает подсветку. На тач-устройстве это единственный способ
        // её убрать: событие ухода указателя там не приходит.
        onPointerMissed={() => setHighlighted(false)}
      >
        <ShotCamera shot={active} sensorHeightMm={sensorHeightMm} region={activeView.region} />
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
            `Кадр ${active.imageWidthPx}×${active.imageHeightPx}`,
            `Окно ${Math.round(viewport.width)}×${Math.round(viewport.height)}`,
            `Видно ${Math.round(activeView.region.width)}×${Math.round(activeView.region.height)} от (${Math.round(activeView.region.left)}, ${Math.round(activeView.region.top)})`,
            activeView.focus ?
              `Кроп по объёму: (${Math.round(activeView.focus.x)}, ${Math.round(activeView.focus.y)})`
            : 'Кроп по центру кадра'
          ].join('\n')}
        />
      )}
    </div>
  )
}
