import type { VersionType } from '../mojang'

export type Direction = 'down' | 'up' | 'north' | 'south' | 'west' | 'east'

export interface VersionSummary {
  id: string
  type: VersionType
  releaseTime: string
  builtAt: string
  pipeline: number
  items: number
  blocks: number
  textures: number
}

export interface VersionIndex {
  updatedAt: string
  versions: VersionSummary[]
}

export interface VersionMeta extends VersionSummary {
  assetIndex: { id: string, url: string, sha1: string }
  client: { url: string, sha1: string }
  missingIcons: Record<string, string>
}

export interface ItemEntry {
  id: string
  translationKey: string
  block: boolean
  icon: boolean
  textures: string[]
}

export interface BlockEntry {
  id: string
  translationKey: string
  item: boolean
  model?: string
  particle?: string
  faces: Partial<Record<Direction, string>>
  textures: string[]
}

export interface TextureEntry {
  path: string
  width: number
  height: number
  frames: number
}

export type LangIndex = Record<string, { hash: string, size: number }>

export type CreativeTabs = Record<string, string[]>

export const UNCATEGORIZED = 'uncategorized'

export const ICON_SIZES = [16, 32, 64, 128, 256] as const
