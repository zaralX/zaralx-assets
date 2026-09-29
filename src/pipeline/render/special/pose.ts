import { apply, IDENTITY, mul, normalize, rotX, rotY, rotZ, scale, type Mat3, type Vec3 } from '../math'

export type Quaternion = [number, number, number, number]

export interface Transformation {
  translation?: Vec3
  left_rotation?: Quaternion
  scale?: Vec3
  right_rotation?: Quaternion
}

export function quaternionMatrix([x, y, z, w]: Quaternion): Mat3 {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]
}

function inverse(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ]
}

function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

export class Pose {
  constructor(public linear: Mat3 = IDENTITY, public offset: Vec3 = [0, 0, 0]) {}

  clone() {
    return new Pose(this.linear, this.offset)
  }

  translate(x: number, y: number, z: number) {
    const d = apply(this.linear, [x, y, z])
    this.offset = [this.offset[0] + d[0], this.offset[1] + d[1], this.offset[2] + d[2]]
    return this
  }

  multiply(m: Mat3) {
    this.linear = mul(this.linear, m)
    return this
  }

  scale(x: number, y: number, z: number) {
    return this.multiply(scale(x, y, z))
  }

  rotateX(radians: number) {
    return this.multiply(rotX(radians))
  }

  rotateY(radians: number) {
    return this.multiply(rotY(radians))
  }

  rotateZ(radians: number) {
    return this.multiply(rotZ(radians))
  }

  // translation * left rotation * scale * right rotation
  transform(t: Transformation) {
    const [tx, ty, tz] = t.translation ?? [0, 0, 0]
    const [sx, sy, sz] = t.scale ?? [1, 1, 1]
    this.translate(tx, ty, tz)
    if (t.left_rotation) this.multiply(quaternionMatrix(t.left_rotation))
    this.scale(sx, sy, sz)
    if (t.right_rotation) this.multiply(quaternionMatrix(t.right_rotation))
    return this
  }

  point(p: Vec3): Vec3 {
    const v = apply(this.linear, p)
    return [v[0] + this.offset[0], v[1] + this.offset[1], v[2] + this.offset[2]]
  }

  normal(n: Vec3): Vec3 {
    return normalize(apply(transpose(inverse(this.linear)), n))
  }
}
