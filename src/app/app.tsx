import {useEffect, useState} from 'react'
import {loadSceneConfig, type SceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {FacadeView, ShotSwitch, useModelAdjust} from 'features/facadeHighlight'
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
 * Вид полностью описывается адресом: ?shot задаёт кадр, ?debug включает отладку.
 * Переключение кадра пишется в историю, поэтому «назад» возвращает предыдущий кадр,
 * а ссылка открывает ровно то, что видел отправитель.
 */
const Scene = ({config}: {config: SceneConfig}) => {
  const debug = new URLSearchParams(window.location.search).has('debug')
  const [shotId, setShotId] = useState(() => shotIdFromUrl(config))

  const shot = config.shots.find((item) => item.id === shotId) ?? config.shots[0]
  const adjust = useModelAdjust(config.model)

  // Адрес всегда содержит кадр — даже при первом открытии без параметров.
  useEffect(() => {
    const url = new URL(window.location.href)

    if (url.searchParams.get('shot') !== shot.id) {
      url.searchParams.set('shot', shot.id)
      window.history.replaceState({shot: shot.id}, '', url)
    }
    // Только на первом рендере: дальше адрес меняет сам переключатель.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onPopState = () => setShotId(shotIdFromUrl(config))

    window.addEventListener('popstate', onPopState)

    return () => window.removeEventListener('popstate', onPopState)
  }, [config])

  const selectShot = (next: ShotConfig) => {
    if (next.id === shot.id) return

    const url = new URL(window.location.href)
    url.searchParams.set('shot', next.id)
    window.history.pushState({shot: next.id}, '', url)
    setShotId(next.id)
  }

  return (
    <ErrorBoundary title='Сцена не загрузилась'>
      <FacadeView shot={shot} config={config} debug={debug} adjust={adjust} />
      <ShotSwitch shots={config.shots} currentId={shot.id} onSelect={selectShot} />
    </ErrorBoundary>
  )
}

/** Кадр из адреса; неизвестный или отсутствующий идентификатор — первый кадр конфига. */
const shotIdFromUrl = (config: SceneConfig): string => {
  const fromUrl = new URLSearchParams(window.location.search).get('shot')

  return config.shots.some((shot) => shot.id === fromUrl) ? fromUrl! : config.shots[0].id
}
