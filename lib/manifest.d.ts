/**
 * manifest.ts — 本地配置与安装清单的读写
 *
 * 两个文件:
 *  - <dshHome>/markets.json                    来源清单(sources)
 *  - <dshHome>/skills/.dsh-skills-marketplace.json  安装清单(installed,插件↔技能)
 *
 * 这份清单是「插件维度展示」的唯一真源。DSH 技能注册表本身是扁平的,
 * 全靠这里把扁平技能聚合回插件。
 */
export interface MarketSource {
    id: string;
    url: string;
    ref: string;
    sparsePath: string;
    addedAt: string;
    cacheDir: string;
}
export interface InstalledPlugin {
    pluginId: string;
    sourceId: string;
    displayName: string;
    description: string;
    category?: string;
    skills: string[];
    commit: string | null;
    installedAt: string;
}
export interface MarketState {
    version: 1;
    sources: MarketSource[];
    installed: InstalledPlugin[];
    /** 历史上由本管理器安装、后被卸载/替换的受管技能名(墓碑)。prune 只作用于此集合。 */
    removed: string[];
}
export declare function defaultDshHome(): string;
export declare class Manifest {
    readonly dshHome: string;
    private state;
    constructor(dshHome?: string);
    private stateFile;
    private load;
    private persist;
    listSources(): MarketSource[];
    getSource(id: string): MarketSource | undefined;
    addSource(src: Omit<MarketSource, 'addedAt'>): MarketSource;
    removeSource(id: string): void;
    listInstalled(): InstalledPlugin[];
    listInstalledBySource(sourceId: string): InstalledPlugin[];
    /** 记录一个已安装插件(含其技能、来源 commit)。 */
    recordInstalled(p: InstalledPlugin): void;
    /** 从清单剔除一个插件(卸载)。返回被剔除项,并把其技能记入墓碑,供后续安全清理。 */
    removeInstalled(pluginId: string, sourceId: string): InstalledPlugin | undefined;
    /** 记录一个技能名到墓碑(已由本管理器安装过、现已失效)。 */
    tombstone(name: string): void;
    /** 安装成功后从墓碑清除(技能再次受管)。 */
    clearTombstone(name: string): void;
    /** 判断某技能名是否受本管理器托管(用清单反查)。 */
    isManaged(name: string): boolean;
    /**
     * 返回可安全清理的孤立技能:曾由本管理器安装(在墓碑里)但当前不再受管、
     * 且仍残留在 skills 根的目录。绝不触碰用户自建或从未受管的技能。
     */
    orphanSkills(): string[];
    /** 清理后从墓碑移除(技能目录已删除)。 */
    clearTombstones(names: string[]): void;
}
/** 把一个 SKILL.md bundle 目录复制到安装根(扁平一层)。 */
export declare function copySkillBundle(srcDir: string, destRoot: string, name: string): void;
