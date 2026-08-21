/**
 * client/index.ts — dsh-skills-marketplace 的浏览器半区。
 *
 * 在 DSH 设置页原生注册一个「Skills Marketplace」section(ctx.slots.inject('settings.section'))。
 * client 半区打包为 CJS + __ModuleLoader__ 手握手,由宿主 web server 在
 * /plugins/dsh-skills-marketplace/client.js 提供。
 *
 * 依赖注入结构类型化,避免在构建期强依赖 @deepseek-ai/dsh-client-* 的具体版本类型。
 */

import { SkillMarketSection } from './Section.tsx'
import type { MarketRemote } from './remote.ts'

// 结构类型:宿主 client context 的最小化形状。
export interface SlotsLike {
  inject(name: string, register: () => unknown): unknown
  register(opts: Record<string, unknown>, component: unknown): unknown
}

export interface ClientContextLike {
  slots?: SlotsLike
  locale?: { register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown }
}

export function apply(ctx: ClientContextLike): void {
  // 1) locale 字典(可选)
  ctx.locale?.register('dsh-skills-marketplace', {
    zh: { nav: 'Skill 插件市场' },
    en: { nav: 'Skills Marketplace' },
  })

  // 2) 注册设置页 section
  const slots = ctx.slots
  if (!slots) {
    console.warn('[dsh-skills-marketplace] slots unavailable; settings section not registered')
    return
  }

  const section = SkillMarketSection
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'skills-marketplace',
        order: 60,
        label: () => 'Skill 插件市场',
        inject: () => ({ hooks: {} }),
      },
      section as never,
    ),
  )
}

// 声明宿主注入该插件 client 所需服务名称(供 Host 客户端编排)。
export const inject = ['slots', 'locale']
export type { MarketRemote }
