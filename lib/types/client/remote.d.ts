/**
 * remote.ts — client 半区对 host 的访问通道。
 *
 * host 半区挂载了 /skills-marketplace/* HTTP 路由(same-origin)。client 半区在浏览器里
 * 直接 fetch 这些端点,不需要 Typert Remote 命名空间,保持轻量。
 */
export interface MarketSource {
    id: string;
    url: string;
    ref: string;
    sparsePath: string;
}
export interface SkillBrief {
    name: string;
    description?: string;
}
export interface PluginBrief {
    id: string;
    displayName: string;
    description: string;
    category?: string;
    skills: SkillBrief[];
}
export interface InstalledPlugin {
    pluginId: string;
    sourceId: string;
    displayName: string;
    description: string;
    skills: string[];
    commit: string | null;
}
export declare class MarketRemote {
    listSources(): Promise<MarketSource[]>;
    addSource(input: {
        url: string;
        ref?: string;
        sparsePath?: string;
    }): Promise<{
        source: MarketSource;
        pluginCount: number;
        skillCount: number;
    }>;
    updateSource(id: string, input: {
        url: string;
        ref?: string;
        sparsePath?: string;
    }): Promise<MarketSource>;
    removeSource(id: string): Promise<void>;
    catalog(sourceId: string): Promise<{
        plugins: PluginBrief[];
        commit: string | null;
    }>;
    installed(sourceId: string): Promise<InstalledPlugin[]>;
    installPlugin(sourceId: string, pluginId: string, skills?: string[]): Promise<void>;
    uninstallPlugin(sourceId: string, pluginId: string): Promise<void>;
    toggleSkill(sourceId: string, pluginId: string, skill: string, on: boolean): Promise<void>;
    private getJson;
    private postJson;
    private delete;
    private putJson;
    private maybeJson;
}
