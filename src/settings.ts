/**
 * settings.ts — host 侧设置命名空间注册。
 *
 * 采用与 dsh-at-file 相同的 ctx.settings.register 机制,让技能市场设置
 * 在 DSH 设置页原生持久化。schema 用 schemastery(宿主提供 @deepseek-ai/schemastery)
 * 在运行时动态构建,避免构建期强依赖。
 *
 * 命名空间:skillMarket —— { installRoot, autoInstall }
 * 说明:来源与已安装清单由 Manifest(markets.json)持久化;这里只登记轻量偏好。
 */

import type { CordisLike } from './cordis.d.ts'

/** settings 提供者暴露的最小调用面。 */
export interface SettingsProviderLike {
  register(namespace: string, schema: unknown, options?: { applies?: 'live' | 'user' }): SettingsScopeLike
}

export interface SettingsScopeLike {
  get(): Record<string, unknown>
  update(patch: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>
}

export const SKILL_MARKET_NAMESPACE = 'skillMarket'

/**
 * 运行时动态构建 schemastery schema。
 * @deepseek-ai/schemastery 由宿主提供(profile fallback 可解析),不声明为构建依赖。
 */
async function buildSchema(): Promise<unknown> {
  const mod = (await import('@deepseek-ai/schemastery')) as {
    z?: { object: (s: Record<string, unknown>) => unknown; string: () => unknown; boolean: () => unknown }
    default?: { object: (s: Record<string, unknown>) => unknown; string: () => unknown; boolean: () => unknown }
  }
  // schemastery 的默认导出即 z(schemastery 是 function 的 z 本身)。
  const z = mod.z ?? mod.default
  if (!z) throw new Error('schemastery z unavailable')
  return z.object({
    installRoot: z.string(),
    autoInstall: z.boolean(),
  })
}

export class MarketSettings {
  private scope: SettingsScopeLike | undefined

  constructor(private settingsProvider: SettingsProviderLike) {}

  /** 在 ctx 上注册命名空间(经 inject 传入 host 的 settings)。幂等。 */
  async register(ctx: CordisLike): Promise<SettingsScopeLike | undefined> {
    const existing = ctx.settings as unknown as SettingsProviderLike | undefined
    if (!existing) throw new Error('dsh-skills-marketplace: settings provider unavailable')
    this.settingsProvider = existing
    const schema = await buildSchema()
    this.scope = existing.register(SKILL_MARKET_NAMESPACE, schema, { applies: 'live' })
    return this.scope
  }

  get scopeOrNull(): SettingsScopeLike | undefined {
    return this.scope
  }

  read(): Record<string, unknown> {
    if (!this.scope) return {}
    return (this.scope.get() ?? {}) as Record<string, unknown>
  }

  async write(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.scope) throw new Error('dsh-skills-marketplace: settings not registered')
    const next = await this.scope.update(patch)
    return (next ?? {}) as Record<string, unknown>
  }
}
