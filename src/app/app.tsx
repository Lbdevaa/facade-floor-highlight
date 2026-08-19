import {useEffect, useMemo, useState} from 'react'
import {loadSceneConfig, type SceneConfig} from 'entities/sceneConfig'
import {AdjustPanel, FacadeView, useModelAdjust} from 'features/facadeHighlight'
import {coverFovY, focalLengthToFovY} from 'shared/lib/lens'
import {useViewportSize} from 'shared/lib/useViewportSize'
import {ErrorBoundary} from 'shared/ui/errorBoundary'
import {StatusScreen} from 'shared/ui/statusScreen'

type ConfigState = {status: 'loading'} | {status: 'ready'; config: SceneConfig} | {status: 'error'; error: Error}

const useSceneConfig = (): ConfigState => {
  const [state, setState] = useState<ConfigState>({status: 'loading'})

  useEffect(() => {
    const controller = new AbortController()

    loadSceneConfig(controller.signal)
      .then((config) => setState({status: 'ready', config}))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          setState({status: 'error', error})
        }
      })

    return () => controller.abort()
  }, [])

  return state
}

export const App = () => {
  const state = useSceneConfig()

  if (state.status === 'loading') {
    return <StatusScreen kind='loading' title='Загружаем сцену' />
  }

  if (state.status === 'error') {
    return <StatusScreen kind='error' title='Не удалось прочитать конфиг сцены' details={state.error.message} />
  }

  return <Scene config={state.config} />
}

/**
 * Кадр выбирается параметром ?shot, отладочный режим — параметром ?debug.
 * Полноценное переключение кадров и восстановление вида по ссылке — отдельный шаг.
 */
const Scene = ({config}: {config: SceneConfig}) => {
  const params = new URLSearchParams(window.location.search)
  const debug = params.has('debug')
  const shot = config.shots.find((item) => item.id === params.get('shot')) ?? config.shots[0]

  const adjust = useModelAdjust(config.model)
  const viewport = useViewportSize()

  const cameraInfo = useMemo(() => {
    const image = {width: shot.imageWidthPx, height: shot.imageHeightPx}
    const imageFovY = focalLengthToFovY(shot.camera.focalLengthMm, config.sensorHeightMm)
    const fov = coverFovY(imageFovY, image, viewport)

    return [
      `Кадр ${image.width}×${image.height} (${(image.width / image.height).toFixed(3)})`,
      `Окно ${Math.round(viewport.width)}×${Math.round(viewport.height)} (${(viewport.width / viewport.height).toFixed(3)})`,
      `fovY кадра ${imageFovY.toFixed(3)}° → на экране ${fov.toFixed(3)}°`
    ].join('\n')
  }, [config.sensorHeightMm, shot, viewport])

  return (
    <>
      <ErrorBoundary title='Сцена не загрузилась'>
        <FacadeView
          shot={shot}
          model={debug ? adjust.adjusted : config.model}
          sensorHeightMm={config.sensorHeightMm}
          debug={debug}
        />
      </ErrorBoundary>
      {debug && <AdjustPanel adjust={adjust} cameraInfo={cameraInfo} />}
    </>
  )
}
