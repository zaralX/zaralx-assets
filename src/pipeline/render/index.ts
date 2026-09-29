import { assetPath, normalizeId, type JarAssets } from '../jar'
import { elementQuads, generatedQuads } from './geometry'
import { evaluateItemModel, type RenderPart } from './item-model'
import { ModelResolver } from './models'
import { renderScene, type SceneLayer } from './rasterizer'
import { specialQuads } from './special'
import { Pose } from './special/pose'
import type { Quad } from './geometry'
import { TextureStore } from './textures'
import type { ItemDefinition, SpecialModel } from './types'

export const ICON_SIZE = 256

function transformQuads(quads: Quad[], transformations: Parameters<Pose['transform']>[0][]) {
  const pose = new Pose()
  for (const t of transformations) pose.transform(t)
  return quads.map(q => ({
    ...q,
    positions: q.positions.map(p => pose.point([p[0] / 16, p[1] / 16, p[2] / 16]).map(c => c * 16)) as Quad['positions'],
    normal: pose.normal(q.normal),
  }))
}

export interface ItemRenderResult {
  // RGBA, ICON_SIZE x ICON_SIZE; undefined when the item has nothing to draw
  image?: Buffer
  parts: RenderPart[]
  unsupported: SpecialModel[]
}

export class ItemRenderer {
  readonly models: ModelResolver
  readonly textures: TextureStore

  constructor(private readonly assets: JarAssets) {
    this.models = new ModelResolver(assets)
    this.textures = new TextureStore(assets)
  }

  definition(item: string) {
    return this.assets.json<ItemDefinition>(assetPath('items', item, '.json'))
  }

  async render(item: string, size = ICON_SIZE): Promise<ItemRenderResult> {
    const definition = this.definition(item)
    if (!definition) throw new Error(`Missing item definition ${normalizeId(item)}`)

    const parts = await evaluateItemModel(this.textures, definition.model)
    const layers: SceneLayer[] = []
    const unsupported: SpecialModel[] = []

    for (const part of parts) {
      if (part.kind === 'model') {
        const model = this.models.get(part.model)
        let quads = model.builtin === 'minecraft:builtin/generated'
          ? await generatedQuads(this.models, this.textures, model, part.tints)
          : await elementQuads(this.models, this.textures, model, part.tints)
        if (part.transformations.length) quads = transformQuads(quads, part.transformations)
        layers.push({ transform: model.display.gui ?? {}, guiLight: model.guiLight, quads, cullBackFaces: true })
        continue
      }

      const base = this.models.get(part.base)
      const quads = await specialQuads(this, part.model, part.transformations)
      if (!quads) {
        unsupported.push(part.model)
        continue
      }
      layers.push({ transform: base.display.gui ?? {}, guiLight: base.guiLight, quads, cullBackFaces: false })
    }

    const drawable = layers.some(l => l.quads.length > 0)
    return { image: drawable ? renderScene(layers, size) : undefined, parts, unsupported }
  }
}
