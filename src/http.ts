/**
 * http.ts — 最小 HTTP 助手(JSON 序列化、同源校验、受限 body 读取)
 * 与 dshmarket 的 http.ts 同款模式,但自包含,不依赖外部包。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/** 变更类端点强制同源。 */
export function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (host === undefined) return false
  if (origin === undefined) {
    const fetchSite = request.headers['sec-fetch-site']
    if (fetchSite !== undefined) return fetchSite === 'same-origin'
    const referer = request.headers.referer
    if (referer !== undefined) {
      try {
        return new URL(referer).host === host
      } catch {
        return false
      }
    }
    // DSH's dsh-app:// renderer omits browser origin metadata; this non-simple header
    // keeps cross-site browser requests behind CORS preflight while identifying our UI.
    return request.headers['x-dsh-skills-marketplace'] === '1'
  }
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function readJsonBody(request: IncomingMessage, maxBytes = 8192): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
