import type { Quad } from '../geometry'
import type { ItemRenderer } from '../index'
import type { SpecialModel } from '../types'

export type SpecialRenderer = (renderer: ItemRenderer, model: SpecialModel) => Promise<Quad[] | undefined>

const RENDERERS: Record<string, SpecialRenderer> = {}

export async function specialQuads(renderer: ItemRenderer, model: SpecialModel) {
  const type = model.type.startsWith('minecraft:') ? model.type.slice(10) : model.type
  const special = RENDERERS[type]
  return special ? special(renderer, model) : undefined
}
