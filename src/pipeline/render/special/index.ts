import type { Quad } from '../geometry'
import type { ItemRenderer } from '../index'
import { argbToRgb } from '../item-model'
import type { Rgb, SpecialModel } from '../types'
import { modelQuads, type EntityTexture, type ModelPart } from './entity-model'
import { Pose, type Transformation } from './pose'

type SpecialRenderer = (context: SpecialContext, model: SpecialModel, pose: Pose) => Promise<Quad[] | undefined>

interface SpecialContext {
  renderer: ItemRenderer
  skin(paths: string[], width: number, height: number, tint?: Rgb): Promise<EntityTexture | undefined>
}

const PI = Math.PI

const DYE_COLORS: Record<string, number> = {
  white: 0xF9FFFE,
  orange: 0xF9801D,
  magenta: 0xC74EBD,
  light_blue: 0x3AB3DA,
  yellow: 0xFED83D,
  lime: 0x80C71F,
  pink: 0xF38BAA,
  gray: 0x474F52,
  light_gray: 0x9D9D97,
  cyan: 0x169C9C,
  purple: 0x8932B8,
  blue: 0x3C44AA,
  brown: 0x835432,
  green: 0x5E7C16,
  red: 0xB02E26,
  black: 0x1D1D21,
}

function texturePath(id: unknown, prefix: string) {
  const path = String(id).replace(/^minecraft:/, '')
  return path.startsWith('textures/') ? path.slice(9).replace(/\.png$/, '') : `${prefix}${path}`
}

const CHEST: ModelPart = {
  children: [
    { cubes: [{ uv: [0, 19], origin: [1, 0, 1], size: [14, 10, 14] }] },
    { offset: [0, 9, 1], cubes: [{ uv: [0, 0], origin: [1, 0, 0], size: [14, 5, 14] }] },
    { offset: [0, 9, 1], cubes: [{ uv: [0, 0], origin: [7, -2, 14], size: [2, 4, 1] }] },
  ],
}

const SHULKER_BOX: ModelPart = {
  children: [
    { offset: [0, 24, 0], cubes: [{ uv: [0, 0], origin: [-8, -16, -8], size: [16, 12, 16] }] },
    { offset: [0, 24, 0], cubes: [{ uv: [0, 28], origin: [-8, -8, -8], size: [16, 8, 16] }] },
  ],
}

const BANNER_POLE: ModelPart = {
  children: [
    { cubes: [{ uv: [44, 0], origin: [-1, -42, -1], size: [2, 42, 2] }] },
    { cubes: [{ uv: [0, 42], origin: [-10, -44, -1], size: [20, 2, 2] }] },
  ],
}

// BannerFlagModel with the standing pose, swaying phase 0
const BANNER_FLAG: ModelPart = {
  offset: [0, -44, 0],
  rotation: [(-0.0125 + 0.01) * PI, 0, 0],
  cubes: [{ uv: [0, 0], origin: [-10, 0, -2], size: [20, 40, 1] }],
}

const SHIELD: ModelPart = {
  children: [
    { cubes: [{ uv: [0, 0], origin: [-6, -11, -2], size: [12, 22, 1] }] },
    { cubes: [{ uv: [26, 0], origin: [-1, -3, -1], size: [2, 6, 6] }] },
  ],
}

const MOB_HEAD: ModelPart = { cubes: [{ uv: [0, 0], origin: [-4, -8, -4], size: [8, 8, 8] }] }

const HUMANOID_HEAD: ModelPart = {
  cubes: [
    { uv: [0, 0], origin: [-4, -8, -4], size: [8, 8, 8] },
    { uv: [32, 0], origin: [-4, -8, -4], size: [8, 8, 8], grow: 0.25 },
  ],
}

// Mouth animation 0: the jaw rests at 0.2 rad, piglin ears at -+0.7 rad
const DRAGON_HEAD: ModelPart = {
  // PartPose.scaled() scales the offset as well
  offset: [0, -7.986666 * 0.75, 0],
  scale: 0.75,
  cubes: [
    { uv: [176, 44], origin: [-6, -1, -24], size: [12, 5, 16] },
    { uv: [112, 30], origin: [-8, -8, -10], size: [16, 16, 16] },
    { uv: [0, 0], origin: [-5, -12, -4], size: [2, 4, 6], mirror: true },
    { uv: [112, 0], origin: [-5, -3, -22], size: [2, 2, 4], mirror: true },
    { uv: [0, 0], origin: [3, -12, -4], size: [2, 4, 6] },
    { uv: [112, 0], origin: [3, -3, -22], size: [2, 2, 4] },
  ],
  children: [
    { offset: [0, 4, -8], rotation: [0.2, 0, 0], cubes: [{ uv: [176, 65], origin: [-6, 0, -16], size: [12, 4, 16] }] },
  ],
}

const PIGLIN_HEAD: ModelPart = {
  cubes: [
    { uv: [0, 0], origin: [-5, -8, -4], size: [10, 8, 8] },
    { uv: [31, 1], origin: [-2, -4, -5], size: [4, 4, 1] },
    { uv: [2, 4], origin: [2, -2, -5], size: [1, 2, 1] },
    { uv: [2, 0], origin: [-3, -2, -5], size: [1, 2, 1] },
  ],
  children: [
    { offset: [4.5, -6, 0], rotation: [0, 0, -0.7], cubes: [{ uv: [51, 6], origin: [0, 0, -2], size: [1, 5, 4] }] },
    { offset: [-4.5, -6, 0], rotation: [0, 0, 0.7], cubes: [{ uv: [39, 6], origin: [-1, 0, -2], size: [1, 5, 4] }] },
  ],
}

const HEADS: Record<string, { model: ModelPart, textures: string[], width: number, height: number }> = {
  skeleton: { model: MOB_HEAD, textures: ['entity/skeleton/skeleton'], width: 64, height: 32 },
  wither_skeleton: { model: MOB_HEAD, textures: ['entity/skeleton/wither_skeleton'], width: 64, height: 32 },
  creeper: { model: MOB_HEAD, textures: ['entity/creeper/creeper'], width: 64, height: 32 },
  zombie: { model: HUMANOID_HEAD, textures: ['entity/zombie/zombie'], width: 64, height: 64 },
  player: { model: HUMANOID_HEAD, textures: ['entity/player/wide/steve', 'entity/steve'], width: 64, height: 64 },
  piglin: { model: PIGLIN_HEAD, textures: ['entity/piglin/piglin'], width: 64, height: 64 },
  dragon: { model: DRAGON_HEAD, textures: ['entity/enderdragon/dragon'], width: 256, height: 256 },
}

const BED_HEAD: ModelPart = {
  children: [
    { cubes: [{ uv: [0, 0], origin: [0, 0, 0], size: [16, 16, 6] }] },
    { rotation: [PI / 2, 0, PI / 2], cubes: [{ uv: [50, 6], origin: [0, 6, 0], size: [3, 3, 3] }] },
    { rotation: [PI / 2, 0, PI], cubes: [{ uv: [50, 18], origin: [-16, 6, 0], size: [3, 3, 3] }] },
  ],
}

const BED_FOOT: ModelPart = {
  children: [
    { cubes: [{ uv: [0, 22], origin: [0, 0, 0], size: [16, 16, 6] }] },
    { rotation: [PI / 2, 0, 0], cubes: [{ uv: [50, 0], origin: [0, 6, -16], size: [3, 3, 3] }] },
    { rotation: [PI / 2, 0, PI * 1.5], cubes: [{ uv: [50, 12], origin: [-16, 6, -16], size: [3, 3, 3] }] },
  ],
}

const POT_BASE: ModelPart = {
  children: [
    {
      offset: [0, 37, 16],
      rotation: [PI, 0, 0],
      cubes: [
        { uv: [0, 0], origin: [4, 17, 4], size: [8, 3, 8], grow: -0.1 },
        { uv: [0, 5], origin: [5, 20, 5], size: [6, 1, 6], grow: 0.2 },
      ],
    },
    { offset: [1, 16, 1], cubes: [{ uv: [-14, 13], origin: [0, 0, 0], size: [14, 0, 14] }] },
    { offset: [1, 0, 1], cubes: [{ uv: [-14, 13], origin: [0, 0, 0], size: [14, 0, 14] }] },
  ],
}

const POT_SIDE_CUBE = { uv: [1, 0] as [number, number], origin: [0, 0, 0] as [number, number, number], size: [14, 16, 0] as [number, number, number], faces: ['north' as const] }

const POT_SIDES: ModelPart = {
  children: [
    { offset: [15, 16, 1], rotation: [0, 0, PI], cubes: [POT_SIDE_CUBE] },
    { offset: [1, 16, 1], rotation: [0, -PI / 2, PI], cubes: [POT_SIDE_CUBE] },
    { offset: [15, 16, 15], rotation: [0, PI / 2, PI], cubes: [POT_SIDE_CUBE] },
    { offset: [1, 16, 15], rotation: [PI, 0, 0], cubes: [POT_SIDE_CUBE] },
  ],
}

const CONDUIT_SHELL: ModelPart = { cubes: [{ uv: [0, 0], origin: [-3, -3, -3], size: [6, 6, 6] }] }

// Before 26.x these placements lived in the renderers; newer item definitions carry them as `transformation`
const LEGACY_TRANSFORMS: Record<string, Transformation> = {
  banner: { translation: [0.5, 0, 0.5], scale: [2 / 3, -2 / 3, -2 / 3] },
  head: { translation: [0.5, 0, 0.5], left_rotation: [1, 0, 0, 0] },
  player_head: { translation: [0.5, 0, 0.5], left_rotation: [1, 0, 0, 0] },
  shulker_box: { translation: [0.5, 1.4995, 0.5], left_rotation: [1, 0, 0, 0], scale: [0.9995, 0.9995, 0.9995] },
  shield: { scale: [1, -1, -1] },
  conduit: { translation: [0.5, 0.5, 0.5] },
}

const RENDERERS: Record<string, SpecialRenderer> = {
  async chest(context, model, pose) {
    const skin = await context.skin([texturePath(model.texture ?? 'normal', 'entity/chest/')], 64, 64)
    return skin && modelQuads(CHEST, pose, skin)
  },

  async shulker_box(context, model, pose) {
    const skin = await context.skin([texturePath(model.texture ?? 'shulker', 'entity/shulker/')], 64, 64)
    return skin && modelQuads(SHULKER_BOX, pose, skin)
  },

  async banner(context, model, pose) {
    const base = await context.skin(['entity/banner/banner_base', 'entity/banner_base'], 64, 64)
    const color = DYE_COLORS[String(model.color)] ?? DYE_COLORS.white
    const layer = await context.skin(['entity/banner/base'], 64, 64, argbToRgb(color))
    if (!base || !layer) return undefined
    const quads = modelQuads(BANNER_POLE, pose, base)
    modelQuads(BANNER_FLAG, pose, base, quads)
    modelQuads(BANNER_FLAG, pose, layer, quads)
    return quads
  },

  async shield(context, _model, pose) {
    const skin = await context.skin(['entity/shield/shield_base_nopattern', 'entity/shield_base_nopattern'], 64, 64)
    return skin && modelQuads(SHIELD, pose, skin)
  },

  async head(context, model, pose) {
    const head = HEADS[String(model.kind)]
    if (!head) return undefined
    const textures = model.texture ? [texturePath(model.texture, 'entity/')] : head.textures
    const skin = await context.skin(textures, head.width, head.height)
    return skin && modelQuads(head.model, pose, skin)
  },

  async player_head(context, _model, pose) {
    const head = HEADS.player
    const skin = await context.skin(head.textures, head.width, head.height)
    return skin && modelQuads(head.model, pose, skin)
  },

  async bed(context, model, pose) {
    const skin = await context.skin([texturePath(model.texture ?? 'red', 'entity/bed/')], 64, 64)
    if (!skin) return undefined
    const quads: Quad[] = []
    for (const [part, foot] of [[BED_HEAD, false], [BED_FOOT, true]] as const) {
      const piece = pose.clone()
        .translate(0, 0.5625, foot ? -1 : 0)
        .rotateX(PI / 2)
        .translate(0.5, 0.5, 0.5)
        .rotateZ(PI)
        .translate(-0.5, -0.5, -0.5)
      modelQuads(part, piece, skin, quads)
    }
    return quads
  },

  async decorated_pot(context, _model, pose) {
    const base = await context.skin(['entity/decorated_pot/decorated_pot_base'], 32, 32)
    const side = await context.skin(['entity/decorated_pot/decorated_pot_side'], 16, 16)
    if (!base || !side) return undefined
    const quads = modelQuads(POT_BASE, pose, base)
    return modelQuads(POT_SIDES, pose, side, quads)
  },

  async conduit(context, _model, pose) {
    const skin = await context.skin(['entity/conduit/base'], 32, 16)
    return skin && modelQuads(CONDUIT_SHELL, pose, skin)
  },
}

export async function specialQuads(renderer: ItemRenderer, model: SpecialModel, transformations: Transformation[]) {
  const type = model.type.startsWith('minecraft:') ? model.type.slice(10) : model.type
  const special = RENDERERS[type]
  if (!special) return undefined

  const pose = new Pose()
  const placement = transformations.length ? transformations : [LEGACY_TRANSFORMS[type] ?? {}]
  for (const t of placement) pose.transform(t)

  const context: SpecialContext = {
    renderer,
    async skin(paths, width, height, tint) {
      for (const path of paths) {
        const texture = await renderer.textures.get(`minecraft:${path}`)
        if (texture) return { texture, width, height, tint }
      }
      return undefined
    },
  }
  return special(context, model, pose)
}
