/**
 * remote.ts — client 半区对 host 的访问通道。
 *
 * host 半区挂载了 /skills-marketplace/* HTTP 路由(same-origin)。client 半区在浏览器里
 * 直接 fetch 这些端点,不需要 Typert Remote 命名空间,保持轻量。
 */

export interface MarketSource {
  id: string
  url: string
  ref: string
  sparsePath: string
}

export interface SkillBrief {
  name: string
  description?: string
}

export interface PluginBrief {
  id: string
  displayName: string
  description: string
  category?: string
  skills: SkillBrief[]
}

export interface InstalledPlugin {
  pluginId: string
  sourceId: string
  displayName: string
  description: string
  skills: string[]
  commit: string | null
}

const BASE = '/skills-marketplace'

export class MarketRemote {
  async listSources(): Promise<MarketSource[]> {
    const j = await this.getJson(`${BASE}/sources`)
    return j.sources ?? []
  }

  async addSource(input: { url: string; ref?: string; sparsePath?: string }): Promise<{ source: MarketSource; pluginCount: number; skillCount: number }> {
    const j = await this.postJson(`${BASE}/sources`, input)
    if (!j.ok) throw new Error(j.error || 'add failed')
    return j
  }

  async updateSource(id: string, input: { url: string; ref?: string; sparsePath?: string }): Promise<MarketSource> {
    const j = await this.putJson(`${BASE}/sources/${encodeURIComponent(id)}`, input)
    if (!j.ok) throw new Error(j.error || 'update failed')
    return j.source
  }

  async removeSource(id: string): Promise<void> {
    const j = await this.delete(`${BASE}/sources/${encodeURIComponent(id)}`)
    if (!j.ok) throw new Error(j.error || 'remove failed')
  }

  async catalog(sourceId: string): Promise<{ plugins: PluginBrief[]; commit: string | null }> {
    const j = await this.getJson(`${BASE}/catalog?source=${encodeURIComponent(sourceId)}`)
    return { plugins: j.plugins ?? [], commit: j.commit ?? null }
  }

  async installed(sourceId: string): Promise<InstalledPlugin[]> {
    const j = await this.getJson(`${BASE}/installed?source=${encodeURIComponent(sourceId)}`)
    return j.installed ?? []
  }

  async installPlugin(sourceId: string, pluginId: string, skills?: string[]): Promise<void> {
    const j = await this.postJson(`${BASE}/install`, { sourceId, pluginId, skills })
    if (!j.ok) throw new Error(j.error || 'install failed')
  }

  async uninstallPlugin(sourceId: string, pluginId: string): Promise<void> {
    const j = await this.postJson(`${BASE}/uninstall`, { sourceId, pluginId })
    if (!j.ok) throw new Error(j.error || 'uninstall failed')
  }

  async toggleSkill(sourceId: string, pluginId: string, skill: string, on: boolean): Promise<void> {
    const j = await this.postJson(`${BASE}/skill-toggle`, { sourceId, pluginId, skill, on })
    if (!j.ok) throw new Error(j.error || 'toggle failed')
  }

  private async getJson(path: string): Promise<any> {
    const r = await fetch(path, { headers: { accept: 'application/json' } })
    return this.maybeJson(r)
  }

  private async postJson(path: string, body: unknown): Promise<any> {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return this.maybeJson(r)
  }

  private async delete(path: string): Promise<any> {
    const r = await fetch(path, { method: 'DELETE' })
    return this.maybeJson(r)
  }

  private async putJson(path: string, body: unknown): Promise<any> {
    const r = await fetch(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return this.maybeJson(r)
  }

  private async maybeJson(r: Response): Promise<any> {
    const text = await r.text()
    try {
      return JSON.parse(text)
    } catch {
      return { ok: false, error: `HTTP ${r.status}: ${text}` }
    }
  }
}
