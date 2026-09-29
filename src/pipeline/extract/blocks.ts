import type { BlockEntry, Direction } from '../../catalog/types'
import type { JarAssets } from '../jar'
import type { ModelResolver } from '../render/models'

interface VariantModel {
  model: string
  x?: number
  y?: number
}

type VariantList = VariantModel | VariantModel[]

interface BlockState {
  variants?: Record<string, VariantList>
  multipart?: { when?: unknown, apply: VariantList }[]
}

const BLOCKSTATES = 'assets/minecraft/blockstates/'

function first(list: VariantList) {
  return Array.isArray(list) ? list[0] : list
}

function all(list: VariantList) {
  return Array.isArray(list) ? list : [list]
}

// The default state is defined in code, so take an unrotated variant
function defaultModel(state: BlockState) {
  if (state.variants) {
    const variants = Object.values(state.variants).map(first)
    return (variants.find(v => !v.x && !v.y) ?? variants[0])?.model
  }
  const unconditional = state.multipart?.find(part => !part.when) ?? state.multipart?.[0]
  return unconditional ? first(unconditional.apply).model : undefined
}

function stateModels(state: BlockState) {
  const lists = state.variants ? Object.values(state.variants) : (state.multipart ?? []).map(part => part.apply)
  return [...new Set(lists.flatMap(all).map(v => v.model))]
}

function faceTextures(models: ModelResolver, modelId: string) {
  const model = models.get(modelId)
  const faces: Partial<Record<Direction, string>> = {}
  const best: Partial<Record<Direction, number>> = {}
  for (const element of model.elements ?? []) {
    const size = [element.to[0] - element.from[0], element.to[1] - element.from[1], element.to[2] - element.from[2]]
    for (const [direction, face] of Object.entries(element.faces) as [Direction, { texture: string }][]) {
      const area = direction === 'up' || direction === 'down'
        ? size[0] * size[2]
        : direction === 'north' || direction === 'south' ? size[0] * size[1] : size[1] * size[2]
      const texture = models.texture(model, face.texture)
      if (texture && area > (best[direction] ?? -1)) {
        best[direction] = area
        faces[direction] = texture.sprite
      }
    }
  }
  return faces
}

function modelTextures(models: ModelResolver, modelId: string) {
  const model = models.get(modelId)
  const sprites = new Set<string>()
  for (const element of model.elements ?? []) {
    for (const face of Object.values(element.faces)) {
      const texture = face && models.texture(model, face.texture)
      if (texture) sprites.add(texture.sprite)
    }
  }
  return sprites
}

export function extractBlocks(assets: JarAssets, models: ModelResolver, items: Set<string>) {
  const blocks: BlockEntry[] = []
  for (const file of assets.list(BLOCKSTATES, '.json')) {
    const id = file.slice(BLOCKSTATES.length, -5)
    const state = assets.json<BlockState>(file)!
    const model = defaultModel(state)

    const textures = new Set<string>()
    for (const m of stateModels(state)) {
      try {
        for (const sprite of modelTextures(models, m)) textures.add(sprite)
      }
      catch {
        // missing model
      }
    }

    let faces: BlockEntry['faces'] = {}
    let particle: string | undefined
    if (model) {
      try {
        faces = faceTextures(models, model)
        particle = models.texture(models.get(model), '#particle')?.sprite
      }
      catch {
        // missing model
      }
    }

    blocks.push({
      id,
      translationKey: `block.minecraft.${id}`,
      item: items.has(id),
      model,
      particle,
      faces,
      textures: [...textures].sort(),
    })
  }
  return blocks
}
