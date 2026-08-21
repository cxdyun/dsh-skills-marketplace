import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Manifest } from '../lib/manifest.js'
import { resolveMarket } from '../lib/remote.js'
import * as remote from '../lib/remote.js'
import { SyncEngine } from '../lib/sync.js'

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-skills-marketplace-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function createSkill(root, name) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\n`)
  return dir
}

test('单独安装技能时保留同一插件已安装的技能', (t) => {
  const root = tempDir(t)
  const plugin = {
    id: 'plugin', displayName: 'Plugin', description: '',
    skills: ['one', 'two'].map((name) => ({ name, pluginId: 'plugin', dir: createSkill(join(root, 'source'), name) })),
  }
  const manifest = new Manifest(join(root, 'dsh'))
  const engine = new SyncEngine(manifest)

  engine.installPlugin('market', plugin, ['one'])
  engine.installPlugin('market', plugin, ['two'])

  assert.deepEqual(manifest.listInstalledBySource('market')[0].skills.sort(), ['one', 'two'])
})

test('根目录同时含直接插件和嵌套插件时发现全部插件', (t) => {
  const root = tempDir(t)
  createSkill(join(root, 'direct', 'skills'), 'direct-skill')
  createSkill(join(root, 'packages', 'nested', 'skills'), 'nested-skill')

  assert.deepEqual(resolveMarket(root, '').plugins.map((plugin) => plugin.id).sort(), ['direct', 'nested'])
})

test('不同仓库即使末级目录相同也生成不同来源 ID', () => {
  assert.equal(typeof remote.sourceIdFor, 'function')
  assert.notEqual(
    remote.sourceIdFor('https://github.com/org-a/marketplace.git'),
    remote.sourceIdFor('https://github.com/org-b/marketplace.git'),
  )
})

test('编辑来源时保持来源 ID 和已安装记录', (t) => {
  const root = tempDir(t)
  const manifest = new Manifest(join(root, 'dsh'))
  manifest.addSource({ id: 'stable-id', url: 'https://example.com/old.git', ref: 'main', sparsePath: '', cacheDir: '' })
  manifest.recordInstalled({ pluginId: 'plugin', sourceId: 'stable-id', displayName: 'Plugin', description: '', skills: ['skill'], commit: null, installedAt: 'now' })

  manifest.updateSource('stable-id', { url: 'https://example.com/new.git', ref: 'main', sparsePath: 'plugins' })

  assert.equal(manifest.getSource('stable-id')?.url, 'https://example.com/new.git')
  assert.equal(manifest.listInstalledBySource('stable-id').length, 1)
})

test('卸载一个来源不会删除另一个来源仍受管的同名技能', (t) => {
  const root = tempDir(t)
  const skillDir = createSkill(join(root, 'source'), 'shared')
  const manifest = new Manifest(join(root, 'dsh'))
  const engine = new SyncEngine(manifest)
  const plugin = { id: 'plugin', displayName: 'Plugin', description: '', skills: [{ name: 'shared', pluginId: 'plugin', dir: skillDir }] }

  engine.installPlugin('market-a', plugin)
  engine.installPlugin('market-b', plugin)
  engine.uninstallPlugin('market-a', 'plugin')

  assert.equal(manifest.listInstalledBySource('market-b')[0].skills[0], 'shared')
  assert.equal(existsSync(join(root, 'dsh', 'skills', 'shared')), true)
})
