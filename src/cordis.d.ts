/**
 * cordis.d.ts — 本插件所用到的 cordis Context 最小面。
 *
 * 避免在构建期强依赖 @deepseek-ai/cordis 的类型(宿主提供,构建环境不解析)。
 * 结构类型进,窄化出我们需要的注入能力。
 */

export interface CordisLike {
  /** 注入服务:回调在服务就绪后执行。 */
  inject(services: string[], cb: (host: Record<string, unknown> & CordisLike) => void): void
  /** 事件监听,返回注销函数。 */
  on(name: string, cb: (payload?: unknown) => void | Promise<void>): () => void
  /** 读取已注入服务。 */
  get(name: string): unknown
  /** 当前可用服务集合。 */
  [key: string]: unknown
}
