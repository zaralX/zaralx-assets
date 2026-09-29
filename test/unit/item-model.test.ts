import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JarAssets } from '../../src/pipeline/jar'
import { argbToRgb, evaluateItemModel } from '../../src/pipeline/render/item-model'
import { TextureStore } from '../../src/pipeline/render/textures'

const textures = new TextureStore(JarAssets.fromFiles({}))
const model = (id: string, extra = {}) => ({ type: 'minecraft:model', model: id, ...extra })

test('argb ints become rgb', () => {
  assert.deepEqual(argbToRgb(-6265536), [0xA0, 0x65, 0x40])
})

test('select picks the gui case of display_context, otherwise the fallback', async () => {
  const [gui] = await evaluateItemModel(textures, {
    type: 'minecraft:select',
    property: 'minecraft:display_context',
    cases: [{ when: ['gui', 'ground'], model: model('a') }],
    fallback: model('b'),
  })
  assert.equal(gui.kind === 'model' && gui.model, 'a')

  const [fallback] = await evaluateItemModel(textures, {
    type: 'minecraft:select',
    property: 'minecraft:trim_material',
    cases: [{ when: 'minecraft:iron', model: model('a') }],
    fallback: model('b'),
  })
  assert.equal(fallback.kind === 'model' && fallback.model, 'b')
})

test('conditions are false and ranges use value 0', async () => {
  const [off] = await evaluateItemModel(textures, { type: 'minecraft:condition', on_true: model('on'), on_false: model('off') })
  assert.equal(off.kind === 'model' && off.model, 'off')

  const [range] = await evaluateItemModel(textures, {
    type: 'minecraft:range_dispatch',
    entries: [{ threshold: 0, model: model('zero') }, { threshold: 0.5, model: model('half') }],
    fallback: model('fallback'),
  })
  assert.equal(range.kind === 'model' && range.model, 'zero')
})

test('tints use their defaults and transformations accumulate outside in', async () => {
  const outer = { translation: [1, 0, 0] }
  const inner = { scale: [2, 2, 2] }
  const [part] = await evaluateItemModel(textures, {
    type: 'minecraft:condition',
    transformation: outer,
    on_false: model('m', {
      transformation: inner,
      tints: [{ type: 'minecraft:constant', value: -16711936 }, { type: 'minecraft:dye', default: -1 }],
    }),
  })
  assert.equal(part.kind, 'model')
  assert.deepEqual(part.kind === 'model' && part.tints, [[0, 255, 0], [255, 255, 255]])
  assert.deepEqual(part.transformations, [outer, inner])
})
