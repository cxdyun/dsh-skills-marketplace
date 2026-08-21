/**
 * client/index.ts — dsh-skills-marketplace 的浏览器半区。
 *
 * 在 DSH 设置页原生注册一个「Skills Marketplace」section(ctx.slots.inject('settings.section'))。
 * client 半区打包为 CJS + __ModuleLoader__ 手握手,由宿主 web server 在
 * /plugins/dsh-skills-marketplace/client.js 提供。
 *
 * 依赖注入结构类型化,避免在构建期强依赖 @deepseek-ai/dsh-client-* 的具体版本类型。
 */
import type { MarketRemote } from './remote.ts';
export interface SlotsLike {
    inject(name: string, register: () => unknown): unknown;
    register(opts: Record<string, unknown>, component: unknown): unknown;
}
export interface ClientContextLike {
    slots?: SlotsLike;
    locale?: {
        register(namespace: string, dicts: {
            zh: Record<string, string>;
            en: Record<string, string>;
        }): unknown;
    };
}
export declare function apply(ctx: ClientContextLike): void;
export declare const inject: string[];
export type { MarketRemote };
