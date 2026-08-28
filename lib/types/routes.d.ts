/**
 * routes.ts — 把管理器能力暴露为 HTTP 路由,供 DSH Web GUI 调用。
 *
 * 路由:
 *   GET  /skills-marketplace/sources                 来源列表
 *   POST /skills-marketplace/sources                添加来源 {url, ref?, sparsePath?}
 *   DELETE /skills-marketplace/sources/:id           移除来源(不删已装技能)
 *   GET  /skills-marketplace/catalog/:sourceId       拉取远端插件/技能目录(插件维度)
 *   GET  /skills-marketplace/installed[/:sourceId]   已安装视图(插件维度)
 *   POST /skills-marketplace/install                 安装插件 {sourceId, pluginId, skills?}
 *   POST /skills-marketplace/uninstall               卸载 {sourceId, pluginId}
 *   POST /skills-marketplace/skill-toggle            技能开关 {sourceId, pluginId, skill, on}
 *   POST /skills-marketplace/refresh/{sourceId}      增量更新到用户配置 ref 的最新
 *                                                     (只重装已启用技能,保留用户选择)
 *
 * 变更类端点(非 GET)强制同源。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Manifest } from './manifest.js';
import { SyncEngine } from './sync.js';
export interface WebServerLike {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
    }): () => void;
}
export interface RouteCtx {
    newManifest(): Manifest;
    newEngine(m: Manifest): SyncEngine;
}
export declare function mountSkillsMarketplaceRoutes(webServer: WebServerLike, ctx: RouteCtx): () => void;
