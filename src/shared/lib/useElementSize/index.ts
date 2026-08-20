import {useLayoutEffect, useState, type RefObject} from 'react'

/**
 * Размер элемента в CSS-пикселях.
 *
 * Меряется сам контейнер, а не окно: ровно его же меряет react-three-fiber для канваса,
 * поэтому картинка и сцена всегда исходят из одного числа. Заодно это переживает
 * появление адресной строки на мобильных — контейнер растянут на весь экран,
 * и ResizeObserver сообщает о смене высоты.
 */
export const useElementSize = (ref: RefObject<HTMLElement | null>): {width: number; height: number} => {
  const [size, setSize] = useState({width: 0, height: 0})

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize({width: box.width, height: box.height})
    })

    observer.observe(element)
    setSize({width: element.clientWidth, height: element.clientHeight})

    return () => observer.disconnect()
  }, [ref])

  return size
}
