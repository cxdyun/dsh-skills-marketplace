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

import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface MarketSource {
  id: string
  url: string
  ref: string
  sparsePath: string
  addedAt: string
  cacheDir: string
}

export interface InstalledPlugin {
  pluginId: string
  sourceId: string
  displayName: string
  description: string
  category?: string
  skills: string[]
  commit: string | null
  installedAt: string
}

export interface MarketState {
  version: 1
  sources: MarketSource[]
  installed: InstalledPlugin[]
  /** 历史上由本管理器安装、后被卸载/替换的受管技能名(墓碑)。prune 只作用于此集合。 */
  removed: string[]
}

export function defaultDshHome(): string {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh')
}

export class Manifest {
  readonly dshHome: string
  private state: MarketState

  constructor(dshHome: string = defaultDshHome()) {
    this.dshHome = dshHome
    this.state = this.load()
  }

  private stateFile(): string {
    return join(this.dshHome, 'markets.json')
  }

  private load(): MarketState {
    const empty: MarketState = { version: 1, sources: [], installed: [], removed: [] }
    const f = this.stateFile()
    if (existsSync(f)) {
      try {
        const raw = JSON.parse(readFileSync(f, 'utf8'))
        return {
          version: 1,
          sources: Array.isArray(raw.sources) ? raw.sources : [],
          installed: Array.isArray(raw.installed) ? raw.installed : [],
          removed: Array.isArray(raw.removed) ? raw.removed : [],
        }
      } catch {
        // fall through to defaults
      }
    }
    return empty
  }

  private persist() {
    mkdirSync(this.dshHome, { recursive: true })
    writeFileSync(this.stateFile(), JSON.stringify(this.state, null, 2))
  }

  // ---- sources ----
  listSources(): MarketSource[] {
    return [...this.state.sources]
  }

  getSource(id: string): MarketSource | undefined {
    return this.state.sources.find((s) => s.id === id)
  }

  addSource(src: Omit<MarketSource, 'addedAt'>): MarketSource {
    const full: MarketSource = { ...src, addedAt: new Date().toISOString() }
    this.state.sources = this.state.sources.filter((s) => s.id !== full.id)
    this.state.sources.push(full)
    this.persist()
    return full
  }

  removeSource(id: string) {
    this.state.sources = this.state.sources.filter((s) => s.id !== id)
    this.persist()
  }

  /** 更新来源配置但保持 id 与已安装技能的来源关联不变。 */
  updateSource(id: string, patch: Pick<MarketSource, 'url' | 'ref' | 'sparsePath'>): MarketSource | undefined {
    const index = this.state.sources.findIndex((s) => s.id === id)
    if (index === -1) return undefined
    const source = { ...this.state.sources[index], ...patch, id }
    this.state.sources[index] = source
    this.persist()
    return source
  }

  // ---- installed ----
  listInstalled(): InstalledPlugin[] {
    return [...this.state.installed]
  }

  listInstalledBySource(sourceId: string): InstalledPlugin[] {
    return this.state.installed.filter((p) => p.sourceId === sourceId)
  }

  /** 记录一个已安装插件(含其技能、来源 commit)。 */
  recordInstalled(p: InstalledPlugin) {
    this.state.installed = this.state.installed.filter((x) => x.pluginId !== p.pluginId || x.sourceId !== p.sourceId)
    this.state.installed.push(p)
    this.persist()
  }

  /** 从清单剔除一个插件(卸载)。返回被剔除项,并把其技能记入墓碑,供后续安全清理。 */
  removeInstalled(pluginId: string, sourceId: string): InstalledPlugin | undefined {
    const i = this.state.installed.findIndex((x) => x.pluginId === pluginId && x.sourceId === sourceId)
    if (i === -1) return undefined
    const [removed] = this.state.installed.splice(i, 1)
    for (const name of removed.skills) this.tombstone(name)
    this.persist()
    return removed
  }

  /** 记录一个技能名到墓碑(已由本管理器安装过、现已失效)。 */
  tombstone(name: string) {
    if (!this.state.removed.includes(name)) this.state.removed.push(name)
  }

  /** 安装成功后从墓碑清除(技能再次受管)。 */
  clearTombstone(name: string) {
    this.state.removed = this.state.removed.filter((n) => n !== name)
  }

  /** 同名技能仍由另一个插件或来源托管时，不应删除其落盘目录。 */
  isManagedElsewhere(name: string, sourceId: string, pluginId: string): boolean {
    return this.state.installed.some((p) =>
      (p.sourceId !== sourceId || p.pluginId !== pluginId) && p.skills.includes(name),
    )
  }

  /**
   * 返回可安全清理的孤立技能:曾由本管理器安装(在墓碑里)但当前不再受管、
   * 且仍残留在 skills 根的目录。绝不触碰用户自建或从未受管的技能。
   */
  orphanSkills(): string[] {
    const managed = new Set(this.state.installed.flatMap((p) => p.skills))
    const dest = join(this.dshHome, 'skills')
    if (!existsSync(dest)) return []
    return this.state.removed
      .filter((n) => !managed.has(n))
      .filter((n) => !n.startsWith('.'))
      .filter((n) => existsSync(join(dest, n)) && statSync(join(dest, n)).isDirectory())
  }

  /** 清理后从墓碑移除(技能目录已删除)。 */
  clearTombstones(names: string[]) {
    const set = new Set(names)
    this.state.removed = this.state.removed.filter((n) => !set.has(n))
    this.persist()
  }
}

/** 把一个 SKILL.md bundle 目录复制到安装根(扁平一层)。 */
export function copySkillBundle(srcDir: string, destRoot: string, name: string) {
  const dest = join(destRoot, name)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(destRoot, { recursive: true })
  copyRecursive(srcDir, dest)
}

function copyRecursive(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from)) {
    const s = join(from, entry)
    const t = join(to, entry)
    if (entry === 'agents') {
      // Codex 专属目录;DSH 不读。若只含 agents/openai.yaml 则整体跳过;
      // 若还含其他文件则保留它们、仅剔除 openai.yaml。
      const hasOther = readdirSync(s).some((n) => n !== 'openai.yaml')
      if (!hasOther) continue
      copyRecursiveFiltered(s, t, (n) => n !== 'openai.yaml')
      continue
    }
    if (statSync(s).isDirectory()) {
      copyRecursive(s, t)
    } else {
      copyFileSync(s, t)
    }
  }
}

/** 复制目录,仅跳过 name 命中过滤器的条目(用于剥掉 openai.yaml,保留其余)。 */
function copyRecursiveFiltered(from: string, to: string, skip: (name: string) => boolean) {
  for (const entry of readdirSync(from)) {
    if (skip(entry)) continue
    const s = join(from, entry)
    const t = join(to, entry)
    if (statSync(s).isDirectory()) {
      copyRecursiveFiltered(s, t, skip)
    } else {
      mkdirSync(to, { recursive: true })
      copyFileSync(s, t)
    }
  }
}
