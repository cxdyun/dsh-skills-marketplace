#!/usr/bin/env node
/**
 * dsh-skills-marketplace CLI
 *
 *   node cli.mjs add <url> [--ref <branch>] [--path <sparse>]
 *   node cli.mjs list
 *   node cli.mjs install <pluginId> [--source <id>] [--skills a,b,c]
 *   node cli.mjs uninstall <pluginId> [--source <id>]
 *   node cli.mjs refresh <sourceId>
 *   node cli.mjs prune
 *   node cli.mjs view <sourceId>     # 以插件维度展示
 */

// 直接使用编译产物(lib/)。运行前先 `pnpm exec tsc -p tsconfig.json` 或 `pnpm build`。
async function main() {
  const [cmd, ...rest] = process.argv.slice(2)

  const { fetchAndResolve } = await import('./lib/remote.js')
  const { Manifest } = await import('./lib/manifest.js')
  const { SyncEngine } = await import('./lib/sync.js')

  const manifest = new Manifest()
  const engine = new SyncEngine(manifest)

  switch (cmd) {
    case 'add': {
      const url = rest[0]
      if (!url) return usage()
      const ref = flag(rest, 'ref')
      const path = flag(rest, 'path')
      const { id, market, cacheDir } = await fetchAndResolve(url, ref, path)
      manifest.addSource({ id, url, ref: ref ?? 'master', sparsePath: path ?? 'plugins', cacheDir })
      console.log(`✔ added source '${id}' (${market.plugins.length} plugins, ${market.plugins.reduce((a, p) => a + p.skills.length, 0)} skills)`)
      console.log(`  cache: ${cacheDir}`)
      break
    }
    case 'list': {
      const sources = manifest.listSources()
      if (!sources.length) return console.log('(no sources added)')
      for (const s of sources) console.log(`• ${s.id}  ${s.url}  @${s.ref}  [${s.sparsePath}]`)
      break
    }
    case 'install-all': {
      const sourceId = rest[0] ?? (manifest.listSources()[0]?.id)
      if (!sourceId) return console.error('✖ no source; add one first')
      const src = manifest.getSource(sourceId)
      if (!src) return console.error(`✖ unknown source '${sourceId}'`)
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath)
      let total = 0
      for (const p of market.plugins) {
        const res = engine.installPlugin(sourceId, p)
        engine.setCommit(sourceId, p.id, market.commit)
        total += res.installed.length
        console.log(`  ✔ ${p.displayName} → ${res.installed.length} skills`)
      }
      console.log(`✔ installed ${total} skills from ${market.plugins.length} plugins`)
      break
    }
    case 'catalog': {
      const sourceId = rest[0] ?? (manifest.listSources()[0]?.id)
      if (!sourceId) return console.error('✖ no source; add one first')
      const src = manifest.getSource(sourceId)
      if (!src) return console.error(`✖ unknown source '${sourceId}'`)
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath)
      console.log(`source '${sourceId}' @${market.commit?.slice(0, 8) ?? '-'}`)
      for (const p of market.plugins) {
        console.log(`\n[${p.id}] ${p.displayName} — ${p.skills.length} skills`)
        if (p.description) console.log(`  ${p.description}`)
        for (const s of p.skills) {
          console.log(`   • ${s.name}${s.description ? ': ' + s.description : ''}`)
        }
      }
      break
    }
    case 'install': {
      const pluginId = rest[0]
      if (!pluginId) return usage()
      const sourceId = flag(rest, 'source') ?? (manifest.listSources()[0]?.id)
      const src = manifest.getSource(sourceId)
      if (!src) return console.error(`✖ unknown source '${sourceId}'`)
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath)
      const plugin = market.plugins.find((p) => p.id === pluginId)
      if (!plugin) return console.error(`✖ plugin '${pluginId}' not found in '${sourceId}'`)
      const only = flag(rest, 'skills')?.split(',')
      const res = engine.installPlugin(sourceId, plugin, only)
      engine.setCommit(sourceId, plugin.id, market.commit)
      console.log(`✔ installed ${plugin.displayName} → ${res.installed.length} skills`)
      for (const s of res.installed) console.log(`   • ${s}`)
      if (res.errors.length) console.error('errors:', res.errors)
      break
    }
    case 'uninstall': {
      const pluginId = rest[0]
      if (!pluginId) return usage()
      const sourceId = flag(rest, 'source')
      const { removed } = engine.uninstallPlugin(sourceId, pluginId)
      console.log(`✔ uninstalled, removed ${removed.length} skill dirs: ${removed.join(', ') || '(none)'}`)
      break
    }
    case 'refresh': {
      const sourceId = rest[0]
      if (!sourceId) return usage()
      const src = manifest.getSource(sourceId)
      if (!src) return console.error(`✖ unknown source '${sourceId}'`)
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath)
      for (const p of market.plugins) {
        const already = manifest.listInstalledBySource(sourceId).find((i) => i.pluginId === p.id)
        if (already) {
          // 只重装已启用技能,保留用户逐技能开关的选择
          const available = new Set(p.skills.map((s) => s.name))
          engine.installPlugin(sourceId, p, already.skills.filter((n) => available.has(n)))
          engine.setCommit(sourceId, p.id, market.commit)
          console.log(`↻ updated ${p.displayName}`)
        }
      }
      const pruned = engine.pruneOrphans()
      if (pruned.length) console.log(`pruned orphans: ${pruned.join(', ')}`)
      console.log(`✔ refreshed @${market.commit?.slice(0, 8) ?? '-'}`)
      break
    }
    case 'prune': {
      const removed = engine.pruneOrphans()
      console.log(`pruned ${removed.length}: ${removed.join(', ') || '(none)'}`)
      break
    }
    case 'view': {
      const sourceId = rest[0] ?? (manifest.listSources()[0]?.id)
      for (const p of manifest.listInstalledBySource(sourceId)) {
        const tags = p.skills.join(', ')
        console.log(`\n[${p.pluginId}] ${p.displayName}`)
        console.log(`  ${p.description}`)
        console.log(`  skills(${p.skills.length}): ${tags}`)
        console.log(`  commit: ${p.commit ?? '-'}`)
      }
      break
    }
    default:
      usage()
  }
}

function flag(args, key) {
  const i = args.indexOf(`--${key}`)
  return i !== -1 ? args[i + 1] : undefined
}

function usage() {
  console.log(`Usage:
  add <url> [--ref <branch>] [--path <sparse>]
  list
  catalog [sourceId]
  install <pluginId> [--source <id>] [--skills a,b,c]
  install-all [sourceId]
  uninstall <pluginId> [--source <id>]
  refresh <sourceId>
  prune
  view [sourceId]`)
}

main().catch((e) => {
  console.error('✖', e)
  process.exit(1)
})
