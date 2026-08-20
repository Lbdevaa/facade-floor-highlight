/**
 * Миниатюры кадров для переключателя: npm run thumbs
 *
 * Кадрируются вокруг подсвечиваемого объёма, а не по центру изображения, — иначе на
 * превью попадёт случайный кусок квартала. Точка берётся из той же проекции, по которой
 * кадрируется большое изображение на экране.
 *
 * Результат кладётся в public/assets/thumbs/<id>.webp. Кадр без миниатюры не ломает
 * интерфейс: кнопка показывает стеклянную заглушку, см. ui/shotSwitch.
 */
import {execFileSync} from 'node:child_process'
import {mkdirSync, readFileSync, statSync} from 'node:fs'
import {Box3, Mesh, Vector3, type BufferGeometry} from 'three'
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js'
import {parseSceneConfig} from 'entities/sceneConfig'
import {createShotCamera, projectPoint} from 'shared/lib/projection'
import {ueGeometryMatrix, uePositionToThree, ueRotationToObjectQuaternion} from 'shared/lib/ueMath'

/** Размер миниатюры под кнопку 120×90 с запасом на плотные экраны. */
const THUMB = {width: 240, height: 180}

/** Сколько пикселей исходного кадра попадает в миниатюру — здание с окружением. */
const CROP = {width: 1200, height: 900}

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

  return converted
})()

const worldCenter = new Box3()
  .setFromBufferAttribute(geometry.attributes.position as never)
  .getCenter(new Vector3())
  .applyQuaternion(ueRotationToObjectQuaternion(config.model.rotationDegUe))
  .add(uePositionToThree(config.model.positionCmUe))

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

mkdirSync('public/assets/thumbs', {recursive: true})

for (const shot of config.shots) {
  const camera = createShotCamera(shot, config.sensorHeightMm)
  const focus = projectPoint(worldCenter, shot, camera)

  const left = Math.round(clamp(focus.x - CROP.width / 2, 0, shot.imageWidthPx - CROP.width))
  const top = Math.round(clamp(focus.y - CROP.height / 2, 0, shot.imageHeightPx - CROP.height))
  const out = `public/assets/thumbs/${shot.id}.webp`

  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    `public/${shot.imageSrc}`,
    '-vf',
    `crop=${CROP.width}:${CROP.height}:${left}:${top},scale=${THUMB.width}:${THUMB.height}`,
    '-quality',
    '72',
    out
  ])

  console.log(
    `${shot.id}: кроп ${CROP.width}×${CROP.height} от (${left}, ${top}) → ${out}, ${(statSync(out).size / 1024).toFixed(1)} КБ`
  )
}
