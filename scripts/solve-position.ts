/**
 * Истинное положение модели по двум ручным подгонкам — по одной на каждый кадр.
 *
 * Запуск: npm run solve -- pogod-01:-7552.8,-6628.1,16864.6,10 pogod-02:247.2,3271.9,17064.6,12
 *
 * Подгонка по одному кадру не определяет положение однозначно: сдвиг вдоль луча
 * зрения почти не меняет картинку. Зато она точно фиксирует направление на объём
 * с этой точки съёмки. Две подгонки дают два луча, пересечение которых и есть
 * искомая точка.
 */
import {readFileSync} from 'node:fs'
import {Box3, Mesh, PerspectiveCamera, Vector3, type BufferGeometry} from 'three'
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js'
import {parseSceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {focalLengthToFovY} from 'shared/lib/lens'
import {
  ueGeometryMatrix,
  uePositionToThree,
  ueRotationToCameraQuaternion,
  ueRotationToObjectQuaternion,
  type UeVector
} from 'shared/lib/ueMath'

const config = parseSceneConfig(JSON.parse(readFileSync('public/scene.config.json', 'utf8')))

const fbx = readFileSync(`public/${config.model.src}`)
const root = new FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), '')

const geometry = (() => {
  let found: BufferGeometry | null = null
  root.traverse((node) => {
    if (found === null && node instanceof Mesh) found = node.geometry as BufferGeometry
  })
  if (found === null) throw new Error('В fbx нет меша')

  const converted = (found as BufferGeometry).clone()
  converted.applyMatrix4(ueGeometryMatrix())
  converted.computeBoundingBox()

  return converted
})()

const localCenter = (geometry.boundingBox as Box3).getCenter(new Vector3())

interface Fit {
  shot: ShotConfig
  positionCmUe: UeVector
  yawDeg: number
}

const fits: Fit[] = process.argv.slice(2).map((argument) => {
  const [id, numbers] = argument.split(':')
  const shot = config.shots.find((item) => item.id === id)
  if (!shot) throw new Error(`Нет кадра ${id}`)

  const [x, y, z, yaw] = numbers.split(',').map(Number)

  return {shot, positionCmUe: {x, y, z}, yawDeg: yaw ?? 0}
})

if (fits.length !== 2) throw new Error('Нужны ровно две подгонки')

function cameraFor(shot: ShotConfig): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    focalLengthToFovY(shot.camera.focalLengthMm, config.sensorHeightMm),
    shot.imageWidthPx / shot.imageHeightPx,
    0.1,
    20000
  )
  camera.position.copy(uePositionToThree(shot.camera.positionCmUe))
  camera.quaternion.copy(ueRotationToCameraQuaternion(shot.camera.rotationDegUe))
  camera.updateMatrixWorld(true)

  return camera
}

/** Центр объёма в сцене при данной подгонке. */
function centerOf(fit: Fit): Vector3 {
  const quaternion = ueRotationToObjectQuaternion({pitch: 0, yaw: fit.yawDeg, roll: 0})

  return localCenter.clone().applyQuaternion(quaternion).add(uePositionToThree(fit.positionCmUe))
}

/** Луч из камеры кадра через тот пиксель, куда подгонка поместила центр объёма. */
function rayFor(fit: Fit) {
  const camera = cameraFor(fit.shot)
  const center = centerOf(fit)
  const direction = center.clone().sub(camera.position).normalize()
  const ndc = center.clone().project(camera)

  return {
    origin: camera.position.clone(),
    direction,
    pixel: {
      x: ((ndc.x + 1) / 2) * fit.shot.imageWidthPx,
      y: ((1 - ndc.y) / 2) * fit.shot.imageHeightPx
    },
    distance: center.distanceTo(camera.position)
  }
}

const [first, second] = fits.map(rayFor)

const between = second.origin.clone().sub(first.origin)
const dot = first.direction.dot(second.direction)
const denominator = 1 - dot * dot
const firstT = (between.dot(first.direction) - dot * between.dot(second.direction)) / denominator
const secondT = (dot * between.dot(first.direction) - between.dot(second.direction)) / denominator

const pointOnFirst = first.origin.clone().addScaledVector(first.direction, firstT)
const pointOnSecond = second.origin.clone().addScaledVector(second.direction, secondT)
const center = pointOnFirst.clone().add(pointOnSecond).multiplyScalar(0.5)

const yawDeg = (fits[0].yawDeg + fits[1].yawDeg) / 2
const origin = center
  .clone()
  .sub(localCenter.clone().applyQuaternion(ueRotationToObjectQuaternion({pitch: 0, yaw: yawDeg, roll: 0})))

const toUe = (vector: Vector3): UeVector => ({x: vector.x * 100, y: vector.z * 100, z: vector.y * 100})
const centerUe = toUe(center)
const originUe = toUe(origin)

console.log('Куда подгонки поместили центр объёма на своих кадрах:')
fits.forEach((fit, index) => {
  const ray = [first, second][index]
  console.log(
    `  ${fit.shot.id}: пиксель (${ray.pixel.x.toFixed(0)}, ${ray.pixel.y.toFixed(0)}), дистанция ${ray.distance.toFixed(1)} м`
  )
})

console.log('\nПересечение лучей — истинный центр объёма, см в координатах Unreal:')
console.log(`  X = ${centerUe.x.toFixed(1)}   Y = ${centerUe.y.toFixed(1)}   Z = ${centerUe.z.toFixed(1)}`)
console.log(`  расхождение лучей: ${pointOnFirst.distanceTo(pointOnSecond).toFixed(2)} м`)
console.log(`  дистанции до точки: ${firstT.toFixed(1)} м и ${secondT.toFixed(1)} м`)
console.log(
  `  подгонки ставили объём на ${first.distance.toFixed(1)} м и ${second.distance.toFixed(1)} м — расхождение по размеру: ${(first.distance - firstT).toFixed(1)} м и ${(second.distance - secondT).toFixed(1)} м`
)

console.log('\nДля конфига (positionCmUe — это origin модели, а не центр объёма):')
console.log(
  JSON.stringify(
    {
      positionCmUe: {x: +originUe.x.toFixed(1), y: +originUe.y.toFixed(1), z: +originUe.z.toFixed(1)},
      rotationDegUe: {pitch: 0, yaw: yawDeg, roll: 0}
    },
    null,
    2
  )
)
