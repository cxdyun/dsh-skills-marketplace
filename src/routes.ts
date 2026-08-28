/**
 * routes.ts — 把管理器能力暴露为 HTTP 路由,供 DSH Web GUI 调用。
 *
 * 路由:
 *   GET  /skills-marketplace/sources                 来源列表
 *   POST /skills-marketplace/sources                添加来源 {url, ref?, sparsePath?}
 *   DELETE /skills-marketplace/sources/:id           移除来源(不删已装技能)
 *   GET  /skills-marketplace/catalog/:sourceId       拉取远端插件/技能目录(插件维度)
 *   GET  /skills-marketplace/installed[/:sourceId]   已安装视图(插件维度)
 *   POST /skills-marketplace/install                 安装插件 {sourceId, pluginId, skills?}
 *   POST /skills-marketplace/uninstall               卸载 {sourceId, pluginId}
 *   POST /skills-marketplace/skill-toggle            技能开关 {sourceId, pluginId, skill, on}
 *   POST /skills-marketplace/refresh/{sourceId}      增量更新到用户配置 ref 的最新
 *                                                     (只重装已启用技能,保留用户选择)
 *
 * 变更类端点(非 GET)强制同源。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sameOrigin, sendJson } from './http.js'
import { Manifest, type MarketSource } from './manifest.js'
import { SyncEngine } from './sync.js'
import { fetchAndResolve, resolveMarket, resolveMarketCached, cacheDirFor, type RemotePlugin } from './remote.js'

export interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface RouteCtx {
  newManifest(): Manifest
  newEngine(m: Manifest): SyncEngine
}

function parseJson<T>(request: IncomingMessage): Promise<T> {
  return readJsonBody(request) as Promise<T>
}

export function mountSkillsMarketplaceRoutes(webServer: WebServerLike, ctx: RouteCtx): () => void {
  const disposers: Array<() => void> = []

  const mount = (kind: 'exact' | 'prefix', path: string, handler: (request: IncomingMessage, response: ServerResponse) => void) => {
    disposers.push(webServer.register({ kind, path, handler }))
  }

  // ---- 获取共享引擎 ----
  const fresh = () => {
    const m = ctx.newManifest()
    return { m, engine: ctx.newEngine(m) }
  }

  // /skills-marketplace/sources 与 /skills-marketplace/sources/<id>
  // host 的 prefix 匹配为 pathname.startsWith(prefix + '/')。为避免带尾斜杠 prefix
  // 拼出双斜杠而失配,这里统一用无尾斜杠 prefix,并在 handler 内按 pathname 分流。
  mount('prefix', '/skills-marketplace/sources', async (req, res) => {
    const pathname = (req.url ?? '').split('?')[0]
    const idMatch = pathname.match(/^\/skills-marketplace\/sources\/([^/]+)$/)
    const method = req.method ?? ''

    if (!idMatch) {
      // 精确 /skills-marketplace/sources —— GET 列表 / POST 添加
      if (pathname !== '/skills-marketplace/sources') return sendJson(res, 404, { ok: false, error: 'not found' })
      if (method === 'GET') {
        const { m } = fresh()
        return sendJson(res, 200, { ok: true, sources: m.listSources() })
      }
      if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      try {
        const body = await parseJson<{ url?: string; ref?: string; sparsePath?: string }>(req)
        if (!body?.url?.trim()) return sendJson(res, 400, { ok: false, error: 'url required' })
        const { id, ref, market } = await fetchAndResolve(body.url.trim(), body.ref, body.sparsePath)
        const { m } = fresh()
        const src: MarketSource = {
          id,
          url: body.url.trim(),
          ref,
          sparsePath: body.sparsePath?.trim() ?? '',
          addedAt: new Date().toISOString(),
          cacheDir: '',
        }
        m.addSource(src)
        return sendJson(res, 201, {
          ok: true,
          source: src,
          pluginCount: market.plugins.length,
          skillCount: market.plugins.reduce((a, p) => a + p.skills.length, 0),
        })
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: (e as Error).message })
      }
    }

    // /skills-marketplace/sources/<id> —— PUT 更新 / DELETE 移除
    const id = decodeURIComponent(idMatch[1])
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    if (method === 'PUT') {
      try {
        const body = await parseJson<{ url?: string; ref?: string; sparsePath?: string }>(req)
        if (!body?.url?.trim()) return sendJson(res, 400, { ok: false, error: 'url required' })
        const url = body.url.trim()
        const { m } = fresh()
        if (!m.getSource(id)) return sendJson(res, 404, { ok: false, error: 'unknown source' })
        if (m.listSources().some((source) => source.id !== id && source.url === url)) return sendJson(res, 409, { ok: false, error: 'source already exists' })
        const { ref, market } = await fetchAndResolve(url, body.ref, body.sparsePath?.trim() ?? '', id)
        const source = m.updateSource(id, { url, ref, sparsePath: body.sparsePath?.trim() ?? '' })!
        return sendJson(res, 200, { ok: true, source, pluginCount: market.plugins.length })
      } catch (e) { return sendJson(res, 500, { ok: false, error: (e as Error).message }) }
    }
    if (method !== 'DELETE') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    const { m } = fresh()
    m.removeSource(id)
    return sendJson(res, 200, { ok: true, id })
  })

  // GET /skills-marketplace/catalog?source=<id> —— 远端插件/技能目录(带磁盘缓存,重复打开即时)
  mount('exact', '/skills-marketplace/catalog', async (req, res) => {
    const u = new URL(req.url ?? '', 'http://local')
    const sourceId = u.searchParams.get('source') ?? ''
    const { m } = fresh()
    const src = m.getSource(sourceId)
    if (!src) return sendJson(res, 404, { ok: false, error: 'unknown source' })
    try {
      const cacheDir = cacheDirFor(sourceId)
      const { market, fromCache } = resolveMarketCached(sourceId, cacheDir, src.sparsePath)
      if (market.plugins.length === 0) {
        const local = resolveMarket(cacheDir, src.sparsePath)
        if (local.plugins.length > 0) {
          return sendJson(res, 200, { ok: true, sourceId, plugins: local.plugins, commit: local.commit, cached: false })
        }
        const fresh = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id)
        return sendJson(res, 200, { ok: true, sourceId, plugins: fresh.market.plugins, commit: fresh.market.commit, cached: false })
      }
      return sendJson(res, 200, {
        ok: true, sourceId, plugins: market.plugins, commit: market.commit, cached: fromCache,
      })
    } catch (e) {
      // 缓存未命中且首次解析失败 → 回退到完整 fetchAndResolve(触发 cloneMarket)
      try {
        const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id)
        return sendJson(res, 200, { ok: true, sourceId, plugins: market.plugins, commit: market.commit, cached: false })
      } catch (e2) {
        return sendJson(res, 500, { ok: false, error: (e2 as Error).message })
      }
    }
  })

  // GET /skills-marketplace/installed?source=<id>
  mount('exact', '/skills-marketplace/installed', async (req, res) => {
    const u = new URL(req.url ?? '', 'http://local')
    const sourceId = u.searchParams.get('source') ?? ''
    const { m } = fresh()
    const installed = sourceId ? m.listInstalledBySource(sourceId) : m.listInstalled()
    return sendJson(res, 200, { ok: true, installed })
  })

  // POST /skills-marketplace/install
  mount('exact', '/skills-marketplace/install', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    try {
      const body = await parseJson<{ sourceId: string; pluginId: string; skills?: string[] }>(req)
      const { m, engine } = fresh()
      const src = m.getSource(body.sourceId)
      if (!src) return sendJson(res, 404, { ok: false, error: 'unknown source' })
      // 用磁盘缓存解析(不重跑 git fetch),安装更快。
      const cached = resolveMarketCached(body.sourceId, cacheDirFor(body.sourceId), src.sparsePath).market
      const local = cached.plugins.length ? cached : resolveMarket(cacheDirFor(body.sourceId), src.sparsePath)
      const market = local.plugins.length ? local : cached
      const plugin = market.plugins.find((p: RemotePlugin) => p.id === body.pluginId)
      if (!plugin) return sendJson(res, 404, { ok: false, error: `plugin '${body.pluginId}' not found` })
      const result = engine.installPlugin(body.sourceId, plugin, body.skills)
      engine.setCommit(body.sourceId, plugin.id, market.commit)
      return sendJson(res, 200, { ok: true, result })
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: (e as Error).message })
    }
  })

  // POST /skills-marketplace/uninstall
  mount('exact', '/skills-marketplace/uninstall', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    try {
      const body = await parseJson<{ sourceId: string; pluginId: string }>(req)
      const { engine } = fresh()
      const result = engine.uninstallPlugin(body.sourceId, body.pluginId)
      return sendJson(res, 200, { ok: true, result })
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: (e as Error).message })
    }
  })

  // POST /skills-marketplace/skill-toggle {sourceId, pluginId, skill, on}
  mount('exact', '/skills-marketplace/skill-toggle', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    try {
      const body = await parseJson<{ sourceId: string; pluginId: string; skill: string; on: boolean }>(req)
      const { m, engine } = fresh()
      const src = m.getSource(body.sourceId)
      if (!src) return sendJson(res, 404, { ok: false, error: 'unknown source' })
      const cached = resolveMarketCached(body.sourceId, cacheDirFor(body.sourceId), src.sparsePath).market
      const local = cached.plugins.length ? cached : resolveMarket(cacheDirFor(body.sourceId), src.sparsePath)
      const market = local.plugins.length ? local : cached
      const plugin = market.plugins.find((p: RemotePlugin) => p.id === body.pluginId)
      if (!plugin) return sendJson(res, 404, { ok: false, error: 'plugin not found' })
      if (body.on) {
        engine.installPlugin(body.sourceId, plugin, [body.skill])
      } else {
        engine.uninstallSkill(body.sourceId, body.pluginId, body.skill)
      }
      return sendJson(res, 200, { ok: true })
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: (e as Error).message })
    }
  })

  // POST /skills-marketplace/refresh/<sourceId>
  mount('prefix', '/skills-marketplace/refresh', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    const sourceId = decodeURIComponent((req.url ?? '').split('/').filter(Boolean).pop() ?? '')
    if (!sourceId) return sendJson(res, 400, { ok: false, error: 'sourceId required' })
    const { m, engine } = fresh()
    const src = m.getSource(sourceId)
    if (!src) return sendJson(res, 404, { ok: false, error: 'unknown source' })
    try {
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id)
      const updated: string[] = []
      for (const p of market.plugins) {
        const already = m.listInstalledBySource(sourceId).find((i) => i.pluginId === p.id)
        if (already) {
          // 只重装用户已启用的技能(尊重既有选择),内容覆盖为最新版本;
          // 远端已删除的技能由 installPlugin 内部剔除并记入墓碑。
          const available = new Set(p.skills.map((s) => s.name))
          engine.installPlugin(sourceId, p, already.skills.filter((n) => available.has(n)))
          engine.setCommit(sourceId, p.id, market.commit)
          updated.push(p.id)
        }
      }
      const pruned = engine.pruneOrphans()
      return sendJson(res, 200, {
        ok: true,
        updated,
        pruned,
        commit: market.commit,
        pluginCount: market.plugins.length,
        skillCount: market.plugins.reduce((a, p) => a + p.skills.length, 0),
      })
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: (e as Error).message })
    }
  })

  return () => {
    for (const d of disposers) d()
  }
}
