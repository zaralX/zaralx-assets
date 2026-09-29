import type { Quad } from '../geometry'
import type { Vec2, Vec3 } from '../math'
import type { Texture } from '../textures'
import type { Direction, Rgb } from '../types'
import type { Pose } from './pose'

// Mirrors the game's ModelPart / CubeListBuilder: positions in pixels, Y down unless the renderer flips it

export interface Cube {
  uv: Vec2
  origin: Vec3
  size: Vec3
  grow?: number
  mirror?: boolean
  faces?: Direction[]
}

export interface ModelPart {
  cubes?: Cube[]
  offset?: Vec3
  // Radians, applied Z * Y * X like PartPose
  rotation?: Vec3
  scale?: number
  children?: ModelPart[]
}

export interface EntityTexture {
  texture: Texture
  // Size of the UV space the model was authored for
  width: number
  height: number
  tint?: Rgb
}

const NORMALS: Record<Direction, Vec3> = {
  down: [0, -1, 0],
  up: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
}

function cubeQuads(cube: Cube, pose: Pose, skin: EntityTexture, out: Quad[]) {
  const grow = cube.grow ?? 0
  let x0 = cube.origin[0] - grow
  const y0 = cube.origin[1] - grow
  const z0 = cube.origin[2] - grow
  let x1 = cube.origin[0] + cube.size[0] + grow
  const y1 = cube.origin[1] + cube.size[1] + grow
  const z1 = cube.origin[2] + cube.size[2] + grow
  if (cube.mirror) [x0, x1] = [x1, x0]

  const v1: Vec3 = [x0, y0, z0]
  const v2: Vec3 = [x1, y0, z0]
  const v3: Vec3 = [x1, y1, z0]
  const v4: Vec3 = [x0, y1, z0]
  const v5: Vec3 = [x0, y0, z1]
  const v6: Vec3 = [x1, y0, z1]
  const v7: Vec3 = [x1, y1, z1]
  const v8: Vec3 = [x0, y1, z1]

  const [dx, dy, dz] = cube.size
  const [u, v] = cube.uv
  const u1 = u + dz
  const u2 = u + dz + dx
  const u3 = u + dz + dx + dx
  const u4 = u + dz + dx + dz
  const u5 = u + dz + dx + dz + dx
  const t1 = v + dz
  const t2 = v + dz + dy

  const polygons: [Direction, [Vec3, Vec3, Vec3, Vec3], number, number, number, number][] = [
    ['down', [v6, v5, v1, v2], u1, v, u2, t1],
    ['up', [v3, v4, v8, v7], u2, t1, u3, v],
    ['west', [v1, v5, v8, v4], u, t1, u1, t2],
    ['north', [v2, v1, v4, v3], u1, t1, u2, t2],
    ['east', [v6, v2, v3, v7], u2, t1, u4, t2],
    ['south', [v5, v6, v7, v8], u4, t1, u5, t2],
  ]

  const toQuad = (a: number, b: number): Vec2 => [a / skin.width * 16, b / skin.height * 16]
  for (const [direction, vertices, ua, va, ub, vb] of polygons) {
    if (cube.faces && !cube.faces.includes(direction)) continue
    const normal = NORMALS[direction]
    out.push({
      positions: vertices.map(p => pose.point([p[0] / 16, p[1] / 16, p[2] / 16]).map(c => c * 16) as Vec3) as Quad['positions'],
      uvs: [toQuad(ub, va), toQuad(ua, va), toQuad(ua, vb), toQuad(ub, vb)],
      normal: pose.normal(cube.mirror ? [-normal[0], normal[1], normal[2]] : normal),
      texture: skin.texture,
      tint: skin.tint ?? [255, 255, 255],
      translucent: skin.texture.translucent,
    })
  }
}

export function modelQuads(part: ModelPart, pose: Pose, skin: EntityTexture, out: Quad[] = []) {
  const local = pose.clone()
  if (part.offset) local.translate(part.offset[0] / 16, part.offset[1] / 16, part.offset[2] / 16)
  if (part.rotation) local.rotateZ(part.rotation[2]).rotateY(part.rotation[1]).rotateX(part.rotation[0])
  if (part.scale !== undefined) local.scale(part.scale, part.scale, part.scale)
  for (const cube of part.cubes ?? []) cubeQuads(cube, local, skin, out)
  for (const child of part.children ?? []) modelQuads(child, local, skin, out)
  return out
}
