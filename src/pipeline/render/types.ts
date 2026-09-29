import type { Vec3 } from './math'

export type Direction = 'down' | 'up' | 'north' | 'south' | 'west' | 'east'

export type TextureRef = string | { sprite: string, force_translucent?: boolean }

export interface ModelFace {
  uv?: [number, number, number, number]
  texture: string
  cullface?: Direction
  rotation?: number
  tintindex?: number
}

export interface ElementRotation {
  origin: Vec3
  axis?: 'x' | 'y' | 'z'
  angle?: number
  x?: number
  y?: number
  z?: number
  rescale?: boolean
}

export interface ModelElement {
  from: Vec3
  to: Vec3
  rotation?: ElementRotation
  shade?: boolean
  shade_direction_override?: Direction
  faces: Partial<Record<Direction, ModelFace>>
}

export interface ItemTransform {
  rotation?: Vec3
  translation?: Vec3
  scale?: Vec3
}

export type GuiLight = 'front' | 'side'

export interface ModelJson {
  parent?: string
  textures?: Record<string, TextureRef>
  elements?: ModelElement[]
  display?: Record<string, ItemTransform>
  gui_light?: GuiLight
}

export interface ItemModelNode {
  type: string
  [key: string]: unknown
}

export interface ItemDefinition {
  model: ItemModelNode
}

export interface SpecialModel {
  type: string
  [key: string]: unknown
}

export type Rgb = [number, number, number]
