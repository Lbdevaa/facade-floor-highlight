import {useCallback, useMemo, useState} from 'react'
import type {HighlightModelConfig} from 'entities/sceneConfig'
import type {UeVector} from 'shared/lib/ueMath'

export type UeAxis = keyof UeVector

/** Шаги подбора в сантиметрах Unreal: грубый проход, доводка, точная посадка. */
export const ADJUST_STEPS_CM = [500, 100, 10] as const

/**
 * Подбор положения объёма прямо на странице.
 *
 * Задание разрешает искать положение «любым удобным способом, хоть подбором чисел».
 * Панель двигает объём по осям Unreal и печатает готовый блок для конфига — иначе
 * каждая проверка гипотезы превращается в цикл «поправил JSON, перезагрузил, забыл».
 * Само состояние живёт только в отладочном режиме и в конфиг не попадает.
 */
export function useModelAdjust(model: HighlightModelConfig) {
  const [positionCmUe, setPositionCmUe] = useState<UeVector>(model.positionCmUe)
  const [yawDeg, setYawDeg] = useState(model.rotationDegUe.yaw)
  const [stepCm, setStepCm] = useState<number>(ADJUST_STEPS_CM[1])

  const nudge = useCallback(
    (axis: UeAxis, direction: 1 | -1) => {
      setPositionCmUe((current) => ({...current, [axis]: current[axis] + direction * stepCm}))
    },
    [stepCm]
  )

  const rotate = useCallback((direction: 1 | -1) => {
    setYawDeg((current) => current + direction)
  }, [])

  const reset = useCallback(() => {
    setPositionCmUe(model.positionCmUe)
    setYawDeg(model.rotationDegUe.yaw)
  }, [model])

  /** Зеркальная гипотеза по Y: экспортёр fbx мог применить конверсию (X, Z, −Y). */
  const flipY = useCallback(() => {
    setPositionCmUe((current) => ({...current, y: -current.y}))
  }, [])

  const adjusted = useMemo<HighlightModelConfig>(
    () => ({...model, positionCmUe, rotationDegUe: {...model.rotationDegUe, yaw: yawDeg}}),
    [model, positionCmUe, yawDeg]
  )

  /** Готовый фрагмент scene.config.json — чтобы найденное положение переносилось копированием. */
  const configFragment = useMemo(() => {
    const round = (value: number) => Number(value.toFixed(3))

    return JSON.stringify(
      {
        positionCmUe: {x: round(positionCmUe.x), y: round(positionCmUe.y), z: round(positionCmUe.z)},
        rotationDegUe: {...model.rotationDegUe, yaw: round(yawDeg)}
      },
      null,
      2
    )
  }, [model.rotationDegUe, positionCmUe, yawDeg])

  return {adjusted, positionCmUe, yawDeg, stepCm, setStepCm, nudge, rotate, reset, flipY, configFragment}
}
