import {useState} from 'react'
import {ADJUST_STEPS_CM, type UeAxis} from '../../model/useModelAdjust'
import styles from './styles.module.css'
import type {useModelAdjust} from '../../model/useModelAdjust'

interface Props {
  adjust: ReturnType<typeof useModelAdjust>
  cameraInfo: string
}

const AXES: {axis: UeAxis; title: string; hint: string}[] = [
  {axis: 'x', title: 'X', hint: 'вперёд / назад'},
  {axis: 'y', title: 'Y', hint: 'вправо / влево'},
  {axis: 'z', title: 'Z', hint: 'вверх / вниз'}
]

/** Панель юстировки. Живёт только в отладочном режиме `?debug`. */
export const AdjustPanel = ({adjust, cameraInfo}: Props) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(adjust.configFragment)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <aside className={styles.panel}>
      <p className={styles.caption}>Положение модели, см в координатах Unreal</p>

      {AXES.map(({axis, title, hint}) => (
        <div key={axis} className={styles.row}>
          <span className={styles.axis}>{title}</span>
          <button type='button' onClick={() => adjust.nudge(axis, -1)} aria-label={`${title} меньше`}>
            −
          </button>
          <span className={styles.value}>{adjust.positionCmUe[axis].toFixed(1)}</span>
          <button type='button' onClick={() => adjust.nudge(axis, 1)} aria-label={`${title} больше`}>
            +
          </button>
          <span className={styles.hint}>{hint}</span>
        </div>
      ))}

      <div className={styles.row}>
        <span className={styles.axis}>Yaw</span>
        <button type='button' onClick={() => adjust.rotate(-1)} aria-label='Повернуть влево'>
          −
        </button>
        <span className={styles.value}>{adjust.yawDeg.toFixed(1)}°</span>
        <button type='button' onClick={() => adjust.rotate(1)} aria-label='Повернуть вправо'>
          +
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.axis}>Шаг</span>
        {ADJUST_STEPS_CM.map((step) => (
          <button key={step} type='button' aria-pressed={adjust.stepCm === step} onClick={() => adjust.setStepCm(step)}>
            {step} см
          </button>
        ))}
      </div>

      <div className={styles.row}>
        <button type='button' onClick={adjust.flipY}>
          Отразить Y
        </button>
        <button type='button' onClick={adjust.reset}>
          Сбросить
        </button>
        <button type='button' onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать JSON'}
        </button>
      </div>

      <pre className={styles.fragment}>{adjust.configFragment}</pre>
      <p className={styles.camera}>{cameraInfo}</p>
    </aside>
  )
}
