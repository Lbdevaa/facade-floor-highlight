import {useSyncExternalStore} from 'react'

/**
 * Размер видимой области. На мобильных берётся visualViewport: при появлении
 * адресной строки и клавиатуры он меняется, а window.innerHeight — нет.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  window.visualViewport?.addEventListener('resize', onChange)

  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
    window.visualViewport?.removeEventListener('resize', onChange)
  }
}

function snapshot(): string {
  const width = window.visualViewport?.width ?? window.innerWidth
  const height = window.visualViewport?.height ?? window.innerHeight

  // Строка, а не объект: useSyncExternalStore сравнивает снимки по ссылке.
  return `${width}×${height}`
}

export function useViewportSize(): {width: number; height: number} {
  const [width, height] = useSyncExternalStore(subscribe, snapshot).split('×').map(Number)

  return {width, height}
}
