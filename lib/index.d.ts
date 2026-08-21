/**
 * index.ts — dsh-skills-marketplace 的 cordis 插件入口
 *
 * 在 profile 组装好 webServer 后挂载 HTTP 路由(GUI 数据后端)。
 * 核心逻辑(lib 层)是纯 Node,不依赖 cordis,因此也可被 CLI 直接使用。
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-skills-marketplace";
export type Config = Record<string, never>;
/**
 * 挂载市场技能管理器的 HTTP 路由。
 * @param ctx 已提供 webServer 服务的 host context
 */
export declare function apply(ctx: Context): void;
export declare const inject: string[];
