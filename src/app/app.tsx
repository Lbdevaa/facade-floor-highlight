import {useEffect, useState} from 'react'
import {loadSceneConfig, type SceneConfig} from 'entities/sceneConfig'
import {FacadeView, useModelAdjust} from 'features/facadeHighlight'
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

  return (
    <ErrorBoundary title='Сцена не загрузилась'>
      <FacadeView shot={shot} config={config} debug={debug} adjust={adjust} />
    </ErrorBoundary>
  )
}
