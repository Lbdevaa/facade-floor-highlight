import {useEffect, useState} from 'react'
import {publicUrl, type ShotConfig} from 'entities/sceneConfig'
import styles from './styles.module.css'

interface Props {
  shots: ShotConfig[]
  currentId: string
  onSelect: (shot: ShotConfig) => void
}

/**
 * Миниатюра лежит рядом с кадром по соглашению об имени и делается скриптом `npm run thumbs`.
 * Кадр, дописанный в конфиг руками, миниатюры не имеет — тогда кнопка показывает заглушку,
 * а не битую картинку.
 */
const thumbUrl = (shot: ShotConfig) => publicUrl(`assets/thumbs/${shot.id}.webp`)

export const ShotSwitch = ({shots, currentId, onSelect}: Props) => {
  const [missingThumbs, setMissingThumbs] = useState<string[]>([])

  // Стрелками листать привычнее, чем целиться в кнопку, — особенно когда кадров станет много.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step =
        event.key === 'ArrowRight' ? 1
        : event.key === 'ArrowLeft' ? -1
        : 0
      if (step === 0) return

      const index = shots.findIndex((shot) => shot.id === currentId)
      onSelect(shots[(index + step + shots.length) % shots.length])
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shots, currentId, onSelect])

  if (shots.length < 2) return null

  return (
    <nav className={styles.switch} aria-label='Кадры здания'>
      {shots.map((shot) => {
        const current = shot.id === currentId
        const withoutThumb = missingThumbs.includes(shot.id)

        return (
          <button
            key={shot.id}
            type='button'
            className={styles.shot}
            aria-current={current || undefined}
            aria-label={`Показать ${shot.title}`}
            // Большой кадр весит больше мегабайта: тянем его заранее, но только когда
            // человек к кнопке потянулся, а не всё сразу при открытии страницы.
            onPointerEnter={() => {
              new Image().src = publicUrl(shot.imageSrc)
            }}
            onClick={() => onSelect(shot)}
          >
            {withoutThumb ?
              <span className={styles.placeholder} aria-hidden />
            : <img
                className={styles.thumb}
                src={thumbUrl(shot)}
                alt=''
                loading='lazy'
                draggable={false}
                onError={() => setMissingThumbs((current) => [...current, shot.id])}
              />
            }
            <span className={styles.title}>{shot.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
