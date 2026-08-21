/**
 * remote.ts — git sparse-checkout 拉取 + 仓库清单解析
 *
 * 实测链路(见项目根 dev-notes):
 *   1. git clone --filter=blob:none --no-checkout <url> <cache>
 *   2. git -C <cache> sparse-checkout init --cone
 *   3. git -C <cache> sparse-checkout set <sparsePath>
 *   4. git -C <cache> checkout <ref>
 *   5. 遍历 sparse 目录找到插件与技能
 *
 * 仓库侧清单支持两套:
 *   A. dsh.market.json    显式清单(推荐,DSH 专属)
 *   B. 约定式发现          扫 skills 目录下的 SKILL.md,按 marketplace.json 还原插件分组
 */
import type { MarketSource } from './manifest.ts';
export interface RemoteSkill {
    name: string;
    pluginId: string;
    dir: string;
    description?: string;
}
export interface RemotePlugin {
    id: string;
    displayName: string;
    description: string;
    category?: string;
    skills: RemoteSkill[];
}
export interface ResolvedMarket {
    plugins: RemotePlugin[];
    commit: string | null;
}
/** 获取默认分支名(remote 探测),失败回退 'master'。 */
export declare function defaultBranch(url: string): string;
/** 执行一次稀疏拉取,把仓库落到 cacheDir。幂等:已有 clone 则增量 fetch。 */
export declare function cloneMarket(src: Pick<MarketSource, 'url' | 'ref' | 'sparsePath'>): {
    id: string;
    cacheDir: string;
};
/** 从已拉取的 cache 里解析出插件与技能清单。 */
export declare function resolveMarket(cacheDir: string, sparsePath: string): ResolvedMarket;
/** 从一个目录里收集所有 <name>/SKILL.md bundle,并解析每个技能的 description。
 *  listDirs 返回完整路径,故直接用作技能目录。
 */
export declare function collectSkillBundles(root: string, pluginId: string): RemoteSkill[];
/** 从 SKILL.md 提取 frontmatter 的 description(纯文本粗略解析,不依赖 yaml 库)。 */
export declare function frontmatterDescription(skillMd: string): string | undefined;
/** CLI 用的完整 source → resolve 流程。 */
export declare function fetchAndResolve(url: string, ref?: string, sparsePath?: string): {
    id: string;
    cacheDir: string;
    market: ResolvedMarket;
};
