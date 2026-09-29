import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JarAssets } from '../../src/pipeline/jar'
import { ModelResolver } from '../../src/pipeline/render/models'
import { json } from './fixtures'

const assets = JarAssets.fromFiles({
  'assets/minecraft/models/block/parent.json': json({
    textures: { particle: '#side', side: 'block/stone' },
    display: { gui: { scale: [1, 1, 1] } },
  }),
  'assets/minecraft/models/block/child.json': json({
    parent: 'minecraft:block/parent',
    textures: { top: { sprite: 'block/glass', force_translucent: true }, all: 'block/dirt' },
    display: { ground: { scale: [0.5, 0.5, 0.5] } },
  }),
})

test('child models inherit and override textures and display', () => {
  const model = new ModelResolver(assets).get('block/child')
  assert.equal(model.id, 'minecraft:block/child')
  assert.deepEqual(Object.keys(model.display).sort(), ['ground', 'gui'])
  assert.equal(model.guiLight, 'side')
})

test('texture references resolve through variables', () => {
  const models = new ModelResolver(assets)
  const model = models.get('block/child')
  assert.deepEqual(models.texture(model, '#particle'), { sprite: 'minecraft:block/stone', translucent: false })
  assert.deepEqual(models.texture(model, '#top'), { sprite: 'minecraft:block/glass', translucent: true })
  // faces may name a variable without the hash
  assert.deepEqual(models.texture(model, 'all'), { sprite: 'minecraft:block/dirt', translucent: false })
  assert.equal(models.texture(model, '#missing'), undefined)
})

test('missing models throw', () => {
  assert.throws(() => new ModelResolver(assets).get('block/nope'), /Missing model/)
})
