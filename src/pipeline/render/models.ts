import { assetPath, normalizeId, type JarAssets } from '../jar'
import type { GuiLight, ItemTransform, ModelElement, ModelJson, TextureRef } from './types'

export interface ResolvedModel {
  id: string
  builtin?: string
  textures: Record<string, TextureRef>
  elements?: ModelElement[]
  display: Record<string, ItemTransform>
  guiLight: GuiLight
}

export interface ResolvedTexture {
  sprite: string
  translucent: boolean
}

const MAX_DEPTH = 32

export class ModelResolver {
  private readonly cache = new Map<string, ResolvedModel>()

  constructor(private readonly assets: JarAssets) {}

  get(id: string, depth = 0): ResolvedModel {
    const key = normalizeId(id)
    const cached = this.cache.get(key)
    if (cached) return cached
    if (depth > MAX_DEPTH) throw new Error(`Model parent chain too deep at ${key}`)

    const raw = this.assets.json<ModelJson>(assetPath('models', key, '.json'))
    if (!raw) {
      if (key.startsWith('minecraft:builtin/')) {
        return this.store(key, { id: key, builtin: key, textures: {}, display: {}, guiLight: 'side' })
      }
      throw new Error(`Missing model ${key}`)
    }

    const parent = raw.parent ? this.get(raw.parent, depth + 1) : undefined
    return this.store(key, {
      id: key,
      builtin: parent?.builtin,
      textures: { ...parent?.textures, ...raw.textures },
      elements: raw.elements ?? parent?.elements,
      display: { ...parent?.display, ...raw.display },
      guiLight: raw.gui_light ?? parent?.guiLight ?? 'side',
    })
  }

  texture(model: ResolvedModel, ref: string): ResolvedTexture | undefined {
    // A face may name its texture variable without the leading '#', texture map values may not
    let current: TextureRef | undefined = ref.startsWith('#') ? ref : (model.textures[ref] ?? ref)
    for (let i = 0; i < MAX_DEPTH && current !== undefined; i++) {
      if (typeof current !== 'string') {
        return { sprite: normalizeId(current.sprite), translucent: current.force_translucent ?? false }
      }
      if (!current.startsWith('#')) return { sprite: normalizeId(current), translucent: false }
      current = model.textures[current.slice(1)]
    }
    return undefined
  }

  private store(key: string, model: ResolvedModel) {
    this.cache.set(key, model)
    return model
  }
}
