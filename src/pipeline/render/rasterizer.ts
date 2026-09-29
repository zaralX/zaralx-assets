import { apply, dot, mul, normalize, rotX, rotXYZ, rotY, type Mat3, type Vec2, type Vec3 } from './math'
import type { Quad } from './geometry'
import type { GuiLight, ItemTransform } from './types'

export interface SceneLayer {
  transform: ItemTransform
  guiLight: GuiLight
  quads: Quad[]
  cullBackFaces: boolean
}

const LIGHT_0 = normalize([0.2, 1, -0.7])
const LIGHT_1 = normalize([-0.2, 1, 0.7])
const LIGHT_POWER = 0.6
const AMBIENT = 0.4
// Below this alpha the item shaders discard the fragment
const ALPHA_CUTOFF = 0.1

// Lighting.ITEMS_FLAT and Lighting.ITEMS_3D
const LIGHTS: Record<GuiLight, [Vec3, Vec3]> = (() => {
  const flat = mul(rotY(-0.3926991), rotX(2.3561945))
  const yxz = (y: number, x: number): Mat3 => mul(rotY(y), rotX(x))
  const side = mul(mul([1, 0, 0, 0, -1, 0, 0, 0, 1], yxz(1.0821041, 3.2375858)), yxz(-0.3926991, 2.3561945))
  return {
    front: [apply(flat, LIGHT_0), apply(flat, LIGHT_1)],
    side: [apply(side, LIGHT_0), apply(side, LIGHT_1)],
  }
})()

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

interface Triangle {
  points: [Vec3, Vec3, Vec3]
  uvs: [Vec2, Vec2, Vec2]
  quad: Quad
  light: number
  cull: boolean
}

export function renderScene(layers: SceneLayer[], size: number) {
  const color = new Float32Array(size * size * 4)
  const depth = new Float32Array(size * size).fill(-Infinity)
  const solid: Triangle[] = []
  const translucent: { triangle: Triangle, z: number }[] = []

  for (const layer of layers) {
    const r = layer.transform.rotation ?? [0, 0, 0]
    const t = (layer.transform.translation ?? [0, 0, 0]).map(v => clamp(v, -80, 80) / 16)
    const s = (layer.transform.scale ?? [1, 1, 1]).map(v => clamp(v, -4, 4))
    const rotation = rotXYZ(r[0], r[1], r[2])
    const [l0, l1] = LIGHTS[layer.guiLight]

    for (const quad of layer.quads) {
      const points = quad.positions.map((p) => {
        const v = apply(rotation, [(p[0] / 16 - 0.5) * s[0], (p[1] / 16 - 0.5) * s[1], (p[2] / 16 - 0.5) * s[2]])
        return [size / 2 + (v[0] + t[0]) * size, size / 2 - (v[1] + t[1]) * size, v[2] + t[2]] as Vec3
      })
      // GUI space has Y pointing down
      const n = apply(rotation, [quad.normal[0] / s[0], quad.normal[1] / s[1], quad.normal[2] / s[2]])
      const normal = normalize([n[0], -n[1], n[2]])
      const light = Math.min(1, (Math.max(0, dot(l0, normal)) + Math.max(0, dot(l1, normal))) * LIGHT_POWER + AMBIENT)

      const cull = layer.cullBackFaces
      const triangles: Triangle[] = [
        { points: [points[0], points[1], points[2]], uvs: [quad.uvs[0], quad.uvs[1], quad.uvs[2]], quad, light, cull },
        { points: [points[0], points[2], points[3]], uvs: [quad.uvs[0], quad.uvs[2], quad.uvs[3]], quad, light, cull },
      ]
      if (!quad.translucent) {
        solid.push(...triangles)
        continue
      }
      const z = (points[0][2] + points[1][2] + points[2][2] + points[3][2]) / 4
      for (const triangle of triangles) translucent.push({ triangle, z })
    }
  }

  for (const triangle of solid) rasterize(triangle, size, color, depth)
  // Translucent geometry is drawn back to front, like the game's quad sorting
  translucent.sort((a, b) => a.z - b.z)
  for (const { triangle } of translucent) rasterize(triangle, size, color, depth)

  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < out.length; i++) out[i] = Math.round(clamp(color[i], 0, 255))
  return out
}

function rasterize({ points, uvs: [ua, ub, uc], quad, light, cull }: Triangle, size: number, color: Float32Array, depth: Float32Array) {
  const a = points[0]
  let [b, c] = [points[1], points[2]]
  let uvs = [ua, ub, uc]
  let area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  // In screen space (Y down) front faces wind clockwise
  if (area < 0) {
    if (cull) return
    ;[b, c] = [c, b]
    uvs = [ua, uc, ub]
    area = -area
  }
  if (area <= 1e-9) return

  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
  const { texture, tint } = quad

  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area
      const w2 = 1 - w0 - w1
      if (w0 < 0 || w1 < 0 || w2 < 0) continue

      const i = y * size + x
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2]
      if (z < depth[i] - 1e-6) continue

      const u = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0]
      const v = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1]
      const tx = clamp(Math.floor(u / 16 * texture.width), 0, texture.width - 1)
      const ty = clamp(Math.floor(v / 16 * texture.height), 0, texture.height - 1)
      const ti = (ty * texture.width + tx) * 4
      const alpha = texture.data[ti + 3] / 255
      if (alpha < ALPHA_CUTOFF) continue

      const o = i * 4
      const dst = color[o + 3] / 255
      const out = alpha + dst * (1 - alpha)
      for (let ch = 0; ch < 3; ch++) {
        const src = texture.data[ti + ch] * tint[ch] / 255 * light
        color[o + ch] = (src * alpha + color[o + ch] * dst * (1 - alpha)) / out
      }
      color[o + 3] = out * 255
      depth[i] = z
    }
  }
}
