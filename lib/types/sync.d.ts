/**
 * sync.ts — 把拉取到的技能扁平落盘到 ~/.dsh/skills,并更新安装清单
 *
 * 严格对齐 DSII dsh-skill-filesystem 的约束:
 *   - 只认一层 <name>/SKILL.md
 *   - 每个技能摊平成 <skillsRoot>/<name>/
 *   - 剔除 Codex 专属 agents/openai.yaml
 *   - 卸载只删本管理器登记的受管技能,绝不碰用户自建技能
 */
import { Manifest, type InstalledPlugin } from './manifest.js';
import type { RemotePlugin } from './remote.js';
export interface SyncResult {
    installed: string[];
    skipped: string[];
    errors: string[];
}
export declare class SyncEngine {
    private manifest;
    constructor(manifest: Manifest);
    private get skillsRoot();
    /**
     * 安装一个插件及其技能到 ~/.dsh/skills。
     * @param sourceId   所属市场来源 id
     * @param plugin     解析出的插件
     * @param onlySkills 可选:只装其中某些技能(对应 GUI 技能开关 '开')
     */
    installPlugin(sourceId: string, plugin: RemotePlugin, onlySkills?: string[]): SyncResult;
    /** 回填 commit(git HEAD),便于"更新"比对。 */
    setCommit(sourceId: string, pluginId: string, commit: string | null): void;
    /**
     * 卸载插件:删除其受管技能目录 + 从清单剔除。
     * 严格按清单删,绝不整目录删除。
     */
    uninstallPlugin(sourceId: string, pluginId: string): {
        removed: string[];
    };
    /**
     * 卸载单个技能(对应 GUI 技能开关 '关')。
     * 从该插件已装集合剔除;若集合清空则整插件从清单移除。
     */
    uninstallSkill(sourceId: string, pluginId: string, skill: string): {
        removed: boolean;
    };
    /**
     * 移除孤立技能:曾由本管理器安装(在墓碑)、当前不再受管、且残留在 skills 根的目录。
     * 绝不触碰用户自建/从未受管的技能。幂等,可安全在每次 boot/update 后调用。
     */
    pruneOrphans(): string[];
    /** 返回当前 GUI 展示所需的"插件维度"聚合视图(从 manifest 还原)。 */
    pluginView(sourceId: string): InstalledPlugin[];
}
