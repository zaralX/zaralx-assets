import { apply, DEG, IDENTITY, mul, nearestAxis, rotX, rotY, rotZ, scale, sub, type Mat3, type Vec2, type Vec3 } from './math'
import type { ModelResolver, ResolvedModel } from './models'
import type { Texture, TextureStore } from './textures'
import type { Direction, ElementRotation, ModelElement, Rgb } from './types'

export interface Quad {
  positions: [Vec3, Vec3, Vec3, Vec3]
  uvs: [Vec2, Vec2, Vec2, Vec2]
  normal: Vec3
  texture: Texture
  tint: Rgb
  translucent: boolean
}

type Corners = (a: Vec3, b: Vec3) => [Vec3, Vec3, Vec3, Vec3]
type DefaultUv = (a: Vec3, b: Vec3) => [number, number, number, number]

// Corners: top-left, top-right, bottom-right, bottom-left
const FACES: Record<Direction, { normal: Vec3, corners: Corners, uv: DefaultUv }> = {
  up: {
    normal: [0, 1, 0],
    corners: (a, b) => [[a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]],
    uv: (a, b) => [a[0], a[2], b[0], b[2]],
  },
  down: {
    normal: [0, -1, 0],
    corners: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], a[1], a[2]], [a[0], a[1], a[2]]],
    uv: (a, b) => [a[0], 16 - b[2], b[0], 16 - a[2]],
  },
  north: {
    normal: [0, 0, -1],
    corners: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]],
    uv: (a, b) => [16 - b[0], 16 - b[1], 16 - a[0], 16 - a[1]],
  },
  south: {
    normal: [0, 0, 1],
    corners: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]],
    uv: (a, b) => [a[0], 16 - b[1], b[0], 16 - a[1]],
  },
  west: {
    normal: [-1, 0, 0],
    corners: (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], b[2]], [a[0], a[1], a[2]]],
    uv: (a, b) => [a[2], 16 - b[1], b[2], 16 - a[1]],
  },
  east: {
    normal: [1, 0, 0],
    corners: (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]]],
    uv: (a, b) => [16 - b[2], 16 - b[1], 16 - a[2], 16 - a[1]],
  },
}

const DIRECTION_NORMALS: Record<Direction, Vec3> = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
}

function rotationMatrix(rotation: ElementRotation): Mat3 {
  let m: Mat3
  if (rotation.axis) {
    const a = (rotation.angle ?? 0) * DEG
    m = rotation.axis === 'x' ? rotX(a) : rotation.axis === 'y' ? rotY(a) : rotZ(a)
  }
  else {
    // Matrix4f.rotationZYX
    m = mul(mul(rotZ((rotation.z ?? 0) * DEG), rotY((rotation.y ?? 0) * DEG)), rotX((rotation.x ?? 0) * DEG))
  }
  if (!rotation.rescale) return m

  const factor = (axis: Vec3) => {
    const v = apply(m, axis)
    return 1 / Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]))
  }
  return mul(m, scale(factor([1, 0, 0]), factor([0, 1, 0]), factor([0, 0, 1])))
}

function elementTransform(element: ModelElement) {
  if (!element.rotation) return undefined
  const matrix = rotationMatrix(element.rotation)
  const origin = element.rotation.origin
  const point = (p: Vec3) => {
    const v = apply(matrix, sub(p, origin))
    return [v[0] + origin[0], v[1] + origin[1], v[2] + origin[2]] as Vec3
  }
  return { matrix, point }
}

export async function elementQuads(
  models: ModelResolver,
  textures: TextureStore,
  model: ResolvedModel,
  tints: Rgb[],
  transform: Mat3 = IDENTITY,
): Promise<Quad[]> {
  const quads: Quad[] = []
  for (const element of model.elements ?? []) {
    const rotation = elementTransform(element)
    for (const [direction, face] of Object.entries(element.faces) as [Direction, NonNullable<ModelElement['faces'][Direction]>][]) {
      const resolved = models.texture(model, face.texture)
      const texture = resolved && await textures.get(resolved.sprite)
      if (!texture) continue

      const def = FACES[direction]
      let positions = def.corners(element.from, element.to)
      if (rotation) positions = positions.map(rotation.point) as typeof positions
      if (transform !== IDENTITY) positions = positions.map(p => apply(transform, p)) as typeof positions

      const [u1, v1, u2, v2] = face.uv ?? def.uv(element.from, element.to)
      const base: Vec2[] = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]]
      const turns = (((face.rotation ?? 0) / 90) % 4 + 4) % 4
      const uvs = base.map((_, i) => base[(i + 4 - turns) % 4]) as Quad['uvs']

      let facing = rotation ? apply(rotation.matrix, def.normal) : def.normal
      if (transform !== IDENTITY) facing = apply(transform, facing)
      const normal = element.shade_direction_override
        ? DIRECTION_NORMALS[element.shade_direction_override]
        : nearestAxis(facing)

      const tint = face.tintindex !== undefined && face.tintindex >= 0 ? (tints[face.tintindex] ?? [255, 255, 255]) : [255, 255, 255] as Rgb
      quads.push({ positions, uvs, normal, texture, tint, translucent: resolved.translucent || texture.translucent })
    }
  }
  return quads
}

// Only the front sprite of an extruded item model is visible in a slot
export async function generatedQuads(models: ModelResolver, textures: TextureStore, model: ResolvedModel, tints: Rgb[]) {
  const quads: Quad[] = []
  for (let layer = 0; ; layer++) {
    const ref = model.textures[`layer${layer}`]
    if (ref === undefined) break
    const resolved = models.texture(model, `#layer${layer}`)
    const texture = resolved && await textures.get(resolved.sprite)
    if (!texture) continue
    const z = 8.5
    quads.push({
      positions: [[0, 16, z], [16, 16, z], [16, 0, z], [0, 0, z]],
      uvs: [[0, 0], [16, 0], [16, 16], [0, 16]],
      normal: [0, 0, 1],
      texture,
      tint: tints[layer] ?? [255, 255, 255],
      translucent: resolved.translucent || texture.translucent,
    })
  }
  return quads
}
