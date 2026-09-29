import type { Transformation } from './special/pose'
import type { TextureStore } from './textures'
import type { ItemModelNode, Rgb, SpecialModel } from './types'

export type RenderPart
  = | { kind: 'model', model: string, tints: Rgb[], transformations: Transformation[] }
    | { kind: 'special', base: string, model: SpecialModel, transformations: Transformation[] }

const WHITE: Rgb = [255, 255, 255]

const GUI_CONTEXT = 'gui'
const RANGE_VALUE = 0

export function argbToRgb(argb: number): Rgb {
  const v = argb >>> 0
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function stripNamespace(type: string) {
  return type.startsWith('minecraft:') ? type.slice(10) : type
}

async function colormap(textures: TextureStore, name: string, temperature: number, downfall: number): Promise<Rgb> {
  const map = await textures.get(`minecraft:colormap/${name}`)
  if (!map) return WHITE
  const temp = Math.min(Math.max(temperature, 0), 1)
  const rain = Math.min(Math.max(downfall, 0), 1) * temp
  const x = Math.floor((1 - temp) * 255)
  const y = Math.floor((1 - rain) * 255)
  if (x >= map.width || y >= map.height) return [255, 0, 255]
  const i = (y * map.width + x) * 4
  return [map.data[i], map.data[i + 1], map.data[i + 2]]
}

export async function evaluateTint(textures: TextureStore, tint: ItemModelNode): Promise<Rgb> {
  switch (stripNamespace(tint.type)) {
    case 'constant':
      return argbToRgb(tint.value as number)
    case 'grass':
      return colormap(textures, 'grass', tint.temperature as number, tint.downfall as number)
    case 'foliage':
      return colormap(textures, 'foliage', tint.temperature as number, tint.downfall as number)
    case 'dry_foliage':
      return colormap(textures, 'dry_foliage', tint.temperature as number, tint.downfall as number)
    default:
      return typeof tint.default === 'number' ? argbToRgb(tint.default) : WHITE
  }
}

export async function evaluateItemModel(textures: TextureStore, node: ItemModelNode, outer: Transformation[] = []): Promise<RenderPart[]> {
  const transformations = node.transformation ? [...outer, node.transformation as Transformation] : outer
  const child = (next: ItemModelNode) => evaluateItemModel(textures, next, transformations)
  switch (stripNamespace(node.type)) {
    case 'model': {
      const tints = await Promise.all(((node.tints ?? []) as ItemModelNode[]).map(t => evaluateTint(textures, t)))
      return [{ kind: 'model', model: node.model as string, tints, transformations }]
    }
    case 'composite': {
      const parts = await Promise.all((node.models as ItemModelNode[]).map(child))
      return parts.flat()
    }
    case 'condition':
      return child(node.on_false as ItemModelNode)
    case 'select': {
      if (node.property === 'minecraft:display_context') {
        const match = (node.cases as { when: string | string[], model: ItemModelNode }[])
          .find(c => ([] as string[]).concat(c.when).includes(GUI_CONTEXT))
        if (match) return child(match.model)
      }
      return node.fallback ? child(node.fallback as ItemModelNode) : []
    }
    case 'range_dispatch': {
      const scale = (node.scale as number | undefined) ?? 1
      let picked: ItemModelNode | undefined
      for (const entry of (node.entries ?? []) as { threshold: number, model: ItemModelNode }[]) {
        if (entry.threshold <= RANGE_VALUE * scale) picked = entry.model
      }
      picked ??= node.fallback as ItemModelNode | undefined
      return picked ? child(picked) : []
    }
    case 'special':
      return [{ kind: 'special', base: node.base as string, model: node.model as SpecialModel, transformations }]
    default:
      return []
  }
}
