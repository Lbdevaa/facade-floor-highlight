/**
 * Положение точки в мире по её пикселям на двух кадрах.
 *
 * Запуск: npm run triangulate -- pogod-01:1555,455 pogod-02:2018,442
 *
 * Через каждый пиксель строится луч из своей камеры; берётся точка, где лучи
 * ближе всего друг к другу. Расхождение лучей показывает, насколько согласованы
 * отметки: если оно велико, значит на кадрах отмечены разные физические точки.
 */
import {readFileSync} from 'node:fs'
import {PerspectiveCamera, Vector3} from 'three'
import {parseSceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {focalLengthToFovY} from 'shared/lib/lens'
import {uePositionToThree, ueRotationToCameraQuaternion} from 'shared/lib/ueMath'

const config = parseSceneConfig(JSON.parse(readFileSync('public/scene.config.json', 'utf8')))

interface Mark {
  shot: ShotConfig
  pixel: {x: number; y: number}
}

const marks: Mark[] = process.argv.slice(2).map((argument) => {
  const [id, coordinates] = argument.split(':')
  const shot = config.shots.find((item) => item.id === id)
  if (!shot) throw new Error(`Нет кадра ${id}`)

  const [x, y] = coordinates.split(',').map(Number)

  return {shot, pixel: {x, y}}
})

if (marks.length !== 2) throw new Error('Нужны ровно две отметки: <кадр>:<x>,<y> <кадр>:<x>,<y>')

const rayFor = ({shot, pixel}: Mark) => {
  const camera = new PerspectiveCamera(
    focalLengthToFovY(shot.camera.focalLengthMm, config.sensorHeightMm),
    shot.imageWidthPx / shot.imageHeightPx,
    0.1,
    20000
  )
  camera.position.copy(uePositionToThree(shot.camera.positionCmUe))
  camera.quaternion.copy(ueRotationToCameraQuaternion(shot.camera.rotationDegUe))
  camera.updateMatrixWorld(true)

  const ndc = new Vector3((pixel.x / shot.imageWidthPx) * 2 - 1, 1 - (pixel.y / shot.imageHeightPx) * 2, 0.5)
  const direction = ndc.unproject(camera).sub(camera.position).normalize()

  return {origin: camera.position.clone(), direction}
}

const [first, second] = marks.map(rayFor)

// Ближайшие точки двух прямых: решаем систему для параметров вдоль лучей.
const between = second.origin.clone().sub(first.origin)
const dotDirections = first.direction.dot(second.direction)
const denominator = 1 - dotDirections * dotDirections

const firstT = (between.dot(first.direction) - dotDirections * between.dot(second.direction)) / denominator
const secondT = (dotDirections * between.dot(first.direction) - between.dot(second.direction)) / denominator

const pointOnFirst = first.origin.clone().addScaledVector(first.direction, firstT)
const pointOnSecond = second.origin.clone().addScaledVector(second.direction, secondT)
const middle = pointOnFirst.clone().add(pointOnSecond).multiplyScalar(0.5)

/** Обратно в координаты Unreal, сантиметры. */
const ue = {x: middle.x * 100, y: middle.z * 100, z: middle.y * 100}

console.log('Точка в координатах Unreal, см:')
console.log(`  X = ${ue.x.toFixed(1)}   Y = ${ue.y.toFixed(1)}   Z = ${ue.z.toFixed(1)}`)
console.log(`Расхождение лучей: ${pointOnFirst.distanceTo(pointOnSecond).toFixed(2)} м`)
console.log(`Дистанции от камер: ${firstT.toFixed(1)} м и ${secondT.toFixed(1)} м`)
