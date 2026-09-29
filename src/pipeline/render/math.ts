export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
// Row-major 3x3
export type Mat3 = [number, number, number, number, number, number, number, number, number]

export const DEG = Math.PI / 180

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
    }
  }
  return r
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

export function rotX(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}

export function rotY(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

export function rotZ(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

export function scale(x: number, y: number, z: number): Mat3 {
  return [x, 0, 0, 0, y, 0, 0, 0, z]
}

export function rotXYZ(x: number, y: number, z: number) {
  return mul(mul(rotX(x * DEG), rotY(y * DEG)), rotZ(z * DEG))
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function nearestAxis(v: Vec3): Vec3 {
  const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2])
  if (ax >= ay && ax >= az) return [Math.sign(v[0]), 0, 0]
  if (ay >= az) return [0, Math.sign(v[1]), 0]
  return [0, 0, Math.sign(v[2])]
}
