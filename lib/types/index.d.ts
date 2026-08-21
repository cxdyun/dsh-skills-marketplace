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
import type { CordisLike } from './cordis.d.ts';
export declare const name = "dsh-skills-marketplace";
export type Config = Record<string, never>;
/**
 * 挂载市场技能管理器:设置命名空间 + HTTP 路由。
 * @param ctx 已提供 settings / webServer 服务的 host context
 */
export declare function apply(ctx: CordisLike): void;
export declare const inject: string[];
