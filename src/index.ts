/**
 * index.ts — dsh-skills-marketplace 的 cordis 插件入口(host 半区)
 *
 * 职责:
 *   1. 注册 skillMarket 设置命名空间(ctx.settings),让技能市场设置原生持久化于 DSH 设置页。
 *   2. 挂载 /skills-marketplace/* HTTP 路由(webServer),供 client 半区与 CLI 使用。
 *
 * 注意:cordis/cordis-plugin-loader 在 apply() 顶层读取尚未 inject 的服务属性会抛
 * "cannot get property \"<svc>\" without inject"。因此 settings/webServer 都必须
 * 通过 ctx.inject([...]) 回调里访问,而不能直接读 ctx.settings。
 *
 * 核心逻辑纯 Node,不依赖 cordis,可被 CLI 直接使用。
 */

import type { CordisLike } from './cordis.d.ts'
import { Manifest } from './manifest.js'
import { SyncEngine } from './sync.js'
import { mountSkillsMarketplaceRoutes, type WebServerLike } from './routes.js'
import { MarketSettings } from './settings.js'

export const name = 'dsh-skills-marketplace'

export type Config = Record<string, never>

/**
 * 挂载市场技能管理器:设置命名空间 + HTTP 路由。
 * @param ctx 已提供 settings / webServer 服务的 host context
 */
export function apply(ctx: CordisLike): void {
  // 1) 设置命名空间注册(host 侧持久化)。必须经 inject 获取 settings。
  ctx.inject(['settings'], (host: Record<string, unknown> & CordisLike) => {
    const provider = host.settings as never
    if (!provider) {
      console.warn('[dsh-skills-marketplace] settings provider unavailable; settings namespace skipped')
      return
    }
    void new MarketSettings(provider).register(host).catch((e: Error) => {
      console.error('[dsh-skills-marketplace] settings register failed:', e.message)
    })
  })

  // 2) HTTP 路由(webServer 提供后挂载)
  ctx.inject(['webServer'], (host: Record<string, unknown> & CordisLike) => {
    const webServer = host.webServer as unknown as WebServerLike | undefined
    if (!webServer) return

    const dispose = mountSkillsMarketplaceRoutes(webServer, {
      newManifest: () => new Manifest(),
      newEngine: (m) => new SyncEngine(m),
    })

    // 生命周期析构(cordis 的 dispose 事件)
    ctx.on('dispose', dispose)
  })
}

// 声明本插件要求宿主提供这些服务(cordis 组合依赖)。
export const inject = ['settings', 'webServer']
