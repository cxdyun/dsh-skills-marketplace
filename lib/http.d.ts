/**
 * http.ts — 最小 HTTP 助手(JSON 序列化、同源校验、受限 body 读取)
 * 与 dshmarket 的 http.ts 同款模式,但自包含,不依赖外部包。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function sendJson(response: ServerResponse, status: number, payload: unknown): void;
/** 变更类端点强制同源。 */
export declare function sameOrigin(request: IncomingMessage): boolean;
export declare function readJsonBody(request: IncomingMessage, maxBytes?: number): Promise<unknown>;
