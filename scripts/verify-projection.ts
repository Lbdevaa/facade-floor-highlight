/**
 * Диагностика положения модели без браузера: куда проецируется объём этажа на каждом кадре.
 *
 * Запуск: npm run verify
 *
 * Печатает пиксельные координаты центра объёма, его габарит на кадре и углы, под которыми
 * камера видит центр модели. Совпадение этих углов с Pitch и Yaw самой камеры означает,
 * что камера смотрит в центр объёма — на юстировке это первый признак, что положение верное.
 */
import {readFileSync} from 'node:fs'
import {Box3, Mesh, PerspectiveCamera, Vector3, type BufferGeometry} from 'three'
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js'
import {parseSceneConfig, type ShotConfig} from 'entities/sceneConfig'
import {focalLengthToFovY} from 'shared/lib/lens'
import {ueGeometryMatrix, uePositionToThree, ueRotationToCameraQuaternion, type UeVector} from 'shared/lib/ueMath'

const config = parseSceneConfig(JSON.parse(readFileSync('public/scene.config.json', 'utf8')))

const fbx = readFileSync(`public/${config.model.src}`)
const root = new FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), '')

const geometry = (() => {
  let found: BufferGeometry | null = null
  root.traverse((node) => {
    if (found === null && node instanceof Mesh) found = node.geometry as BufferGeometry
  })
  if (found === null) throw new Error(`В ${config.model.src} нет ни одного меша`)

  // В файле геометрия лежит в конвенции Unreal (Z вверх, метры) — переводим её в сцену.
  const converted = (found as BufferGeometry).clone()
  converted.applyMatrix4(ueGeometryMatrix())
  converted.computeBoundingBox()

  return converted
})()

const localBox = geometry.boundingBox as Box3

const cameraFor = (shot: ShotConfig): PerspectiveCamera => {
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

/** Точка сцены → пиксели кадра. */
const toPixels = (point: Vector3, shot: ShotConfig, camera: PerspectiveCamera) => {
  const ndc = point.clone().project(camera)

  return {x: ((ndc.x + 1) / 2) * shot.imageWidthPx, y: ((1 - ndc.y) / 2) * shot.imageHeightPx}
}

/** Под каким Pitch и Yaw камера видит эту точку — для сравнения с поворотом самой камеры. */
const anglesTo = (target: UeVector, shot: ShotConfig) => {
  const dx = target.x - shot.camera.positionCmUe.x
  const dy = target.y - shot.camera.positionCmUe.y
  const dz = target.z - shot.camera.positionCmUe.z
  const horizontal = Math.hypot(dx, dy)

  return {
    pitch: (Math.atan2(dz, horizontal) * 180) / Math.PI,
    yaw: (Math.atan2(dy, dx) * 180) / Math.PI,
    distanceM: Math.hypot(horizontal, dz) / 100
  }
}

const origin = uePositionToThree(config.model.positionCmUe)
const corners: Vector3[] = []
for (const x of [localBox.min.x, localBox.max.x])
  for (const y of [localBox.min.y, localBox.max.y])
    for (const z of [localBox.min.z, localBox.max.z]) corners.push(new Vector3(x, y, z).add(origin))

const center = localBox.getCenter(new Vector3()).add(origin)
const centerUe: UeVector = {x: center.x * 100, y: center.z * 100, z: center.y * 100}

console.log(`Модель: ${config.model.label}`)
console.log(
  `  габарит, м: ${localBox
    .getSize(new Vector3())
    .toArray()
    .map((v) => v.toFixed(2))
    .join(' × ')}`
)
console.log(
  `  центр объёма в координатах Unreal, м: ${(centerUe.x / 100).toFixed(1)}, ${(centerUe.y / 100).toFixed(1)}, ${(centerUe.z / 100).toFixed(1)}\n`
)

for (const shot of config.shots) {
  const camera = cameraFor(shot)
  const pixels = corners.map((corner) => toPixels(corner, shot, camera))
  const xs = pixels.map((point) => point.x)
  const ys = pixels.map((point) => point.y)
  const centerPixels = toPixels(center, shot, camera)
  const angles = anglesTo(centerUe, shot)
  const inside = xs.every((x) => x > 0 && x < shot.imageWidthPx) && ys.every((y) => y > 0 && y < shot.imageHeightPx)

  console.log(`${shot.id} — ${shot.title} (${shot.imageWidthPx} × ${shot.imageHeightPx})`)
  console.log(`  fovY кадра: ${focalLengthToFovY(shot.camera.focalLengthMm, config.sensorHeightMm).toFixed(4)}°`)
  console.log(
    `  центр объёма: (${centerPixels.x.toFixed(0)}, ${centerPixels.y.toFixed(0)}) при центре кадра (${(shot.imageWidthPx / 2).toFixed(0)}, ${(shot.imageHeightPx / 2).toFixed(0)})`
  )
  console.log(
    `  габарит на кадре: ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(0)} px, целиком в кадре: ${inside ? 'да' : 'НЕТ'}`
  )
  console.log(
    `  камера смотрит на центр под pitch ${angles.pitch.toFixed(2)}° / yaw ${angles.yaw.toFixed(2)}°, а её поворот — ${shot.camera.rotationDegUe.pitch.toFixed(2)}° / ${shot.camera.rotationDegUe.yaw.toFixed(2)}°`
  )
  console.log(`  дистанция до центра: ${angles.distanceM.toFixed(0)} м\n`)
}
