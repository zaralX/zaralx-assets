import sharp from 'sharp'
import { JarAssets } from '../../src/pipeline/jar'

export async function solidPng(rgba: [number, number, number, number], size = 16) {
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toBuffer()
}

export function json(value: unknown) {
  return JSON.stringify(value)
}

export async function testAssets(extra: Record<string, Uint8Array | string> = {}) {
  return JarAssets.fromFiles({
    'assets/minecraft/models/block/block.json': json({
      gui_light: 'side',
      display: { gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] } },
    }),
    'assets/minecraft/models/block/cube_all.json': json({
      parent: 'block/block',
      elements: [{
        from: [0, 0, 0],
        to: [16, 16, 16],
        faces: Object.fromEntries(['down', 'up', 'north', 'south', 'west', 'east'].map(d => [d, { texture: '#all' }])),
      }],
    }),
    'assets/minecraft/models/block/white.json': json({ parent: 'block/cube_all', textures: { all: 'block/white' } }),
    'assets/minecraft/models/item/generated.json': json({ parent: 'builtin/generated', gui_light: 'front' }),
    'assets/minecraft/models/item/flat.json': json({ parent: 'item/generated', textures: { layer0: 'item/flat' } }),
    'assets/minecraft/items/white.json': json({ model: { type: 'minecraft:model', model: 'minecraft:block/white' } }),
    'assets/minecraft/items/flat.json': json({
      model: { type: 'minecraft:model', model: 'minecraft:item/flat', tints: [{ type: 'minecraft:dye', default: -65536 }] },
    }),
    'assets/minecraft/textures/block/white.png': await solidPng([255, 255, 255, 255]),
    'assets/minecraft/textures/item/flat.png': await solidPng([255, 255, 255, 255]),
    ...extra,
  })
}
