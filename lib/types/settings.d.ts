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
import type { CordisLike } from './cordis.d.ts';
/** settings 提供者暴露的最小调用面。 */
export interface SettingsProviderLike {
    register(namespace: string, schema: unknown, options?: {
        applies?: 'live' | 'user';
    }): SettingsScopeLike;
}
export interface SettingsScopeLike {
    get(): Record<string, unknown>;
    update(patch: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
}
export declare const SKILL_MARKET_NAMESPACE = "skillMarket";
export declare class MarketSettings {
    private settingsProvider;
    private scope;
    constructor(settingsProvider: SettingsProviderLike);
    /** 在 ctx 上注册命名空间(经 inject 传入 host 的 settings)。幂等。 */
    register(ctx: CordisLike): Promise<SettingsScopeLike | undefined>;
    get scopeOrNull(): SettingsScopeLike | undefined;
    read(): Record<string, unknown>;
    write(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
}
