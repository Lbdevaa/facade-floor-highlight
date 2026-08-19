import {useThree} from '@react-three/fiber'
import {useEffect} from 'react'

/**
 * Открывает состояние сцены наружу под `window.__r3f` — этим пользуются скрипты
 * юстировки в scripts/: они ждут, пока сцена реально отрисует геометрию, и читают
 * положение камеры. Живёт только в отладочном режиме.
 */
export function DebugBridge() {
  const state = useThree()

  useEffect(() => {
    const target = window as unknown as {__r3f?: unknown}
    target.__r3f = state

    return () => {
      delete target.__r3f
    }
  }, [state])

  return null
}
