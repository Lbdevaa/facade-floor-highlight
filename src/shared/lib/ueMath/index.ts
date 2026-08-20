import {Matrix4, Quaternion, Vector3} from 'three'

/** Вектор в мировых координатах Unreal: X вперёд, Y вправо, Z вверх. */
export interface UeVector {
  x: number
  y: number
  z: number
}

/** FRotator, градусы. */
export interface UeRotation {
  pitch: number
  yaw: number
  roll: number
}

const DEG = Math.PI / 180

/** Сантиметры Unreal → метры сцены. */
export const UE_TO_THREE_SCALE = 0.01

/**
 * Приведение системы координат Unreal к системе координат three.js.
 *
 * UE — левосторонняя, Z вверх, сантиметры. three — правосторонняя, Y вверх, метры.
 * Отображение (X, Y, Z) → (X, Z, Y) переставляет Y и Z; его определитель равен −1,
 * то есть это отражение — именно оно и меняет хиральность. Поворот (определитель +1)
 * оставил бы сцену зеркальной. Тот же оператор применяется и к точкам, и к направлениям,
 * и к вершинам геометрии, поэтому взаимное расположение камеры и объёма сохраняется.
 */
export const uePositionToThree = (position: UeVector, target = new Vector3()): Vector3 => {
  return target.set(position.x * UE_TO_THREE_SCALE, position.z * UE_TO_THREE_SCALE, position.y * UE_TO_THREE_SCALE)
}

/** То же отображение для направления: масштаб не применяется. */
export const ueDirectionToThree = (direction: UeVector, target = new Vector3()): Vector3 => {
  return target.set(direction.x, direction.z, direction.y)
}

/**
 * Матрица, переносящая вершины геометрии из конвенции Unreal (Z вверх, метры) в three.
 * Определитель −1 — то же отражение, что и для позиций.
 */
export const ueGeometryMatrix = (): Matrix4 => {
  // prettier-ignore
  return new Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1
  )
}

/**
 * Базис поворота ровно так, как его строит движок (FRotationMatrix::Make):
 * строки матрицы — оси объекта в мировых координатах Unreal.
 *
 * Roll учитывается наравне с Pitch и Yaw. На обоих известных кадрах Roll = 0,
 * но проверять решение будут третьим кадром, которого мы не видели.
 */
export const ueRotationBasis = (rotation: UeRotation): {forward: UeVector; right: UeVector; up: UeVector} => {
  const cp = Math.cos(rotation.pitch * DEG)
  const sp = Math.sin(rotation.pitch * DEG)
  const cy = Math.cos(rotation.yaw * DEG)
  const sy = Math.sin(rotation.yaw * DEG)
  const cr = Math.cos(rotation.roll * DEG)
  const sr = Math.sin(rotation.roll * DEG)

  return {
    forward: {x: cp * cy, y: cp * sy, z: sp},
    right: {x: sr * sp * cy - cr * sy, y: sr * sp * sy + cr * cy, z: -sr * cp},
    up: {x: -(cr * sp * cy + sr * sy), y: cy * sr - cr * sp * sy, z: cr * cp}
  }
}

/**
 * Ориентация камеры three по Pitch / Yaw / Roll из Unreal.
 * Камера в three смотрит вдоль −Z, поэтому третий столбец базиса — «назад».
 *
 * Собирается из базиса, а не через lookAt: lookAt восстанавливает up из мировой
 * вертикали и теряет roll.
 */
export const ueRotationToCameraQuaternion = (rotation: UeRotation, target = new Quaternion()): Quaternion => {
  const basis = ueRotationBasis(rotation)
  const matrix = new Matrix4().makeBasis(
    ueDirectionToThree(basis.right),
    ueDirectionToThree(basis.up),
    ueDirectionToThree(basis.forward).negate()
  )

  return target.setFromRotationMatrix(matrix)
}

/**
 * Ориентация объекта, чья геометрия уже переведена в three матрицей ueGeometryMatrix.
 *
 * Поворот сопрягается тем же отражением с двух сторон: A·R·A, где R — матрица Unreal
 * со столбцами-осями объекта (X вперёд, Y вправо, Z вверх), а A — перестановка Y↔Z,
 * обратная сама себе. Одностороннее применение дало бы матрицу с определителем −1,
 * то есть отражение вместо поворота, и кватернион из неё получился бы бессмысленным.
 */
export const ueRotationToObjectQuaternion = (rotation: UeRotation, target = new Quaternion()): Quaternion => {
  const basis = ueRotationBasis(rotation)
  const rotationUe = new Matrix4().makeBasis(
    new Vector3(basis.forward.x, basis.forward.y, basis.forward.z),
    new Vector3(basis.right.x, basis.right.y, basis.right.z),
    new Vector3(basis.up.x, basis.up.y, basis.up.z)
  )
  const swap = ueGeometryMatrix()

  return target.setFromRotationMatrix(swap.clone().multiply(rotationUe).multiply(swap))
}
