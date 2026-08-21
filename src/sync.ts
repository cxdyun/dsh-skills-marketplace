/**
 * sync.ts — 把拉取到的技能扁平落盘到 ~/.dsh/skills,并更新安装清单
 *
 * 严格对齐 DSII dsh-skill-filesystem 的约束:
 *   - 只认一层 <name>/SKILL.md
 *   - 每个技能摊平成 <skillsRoot>/<name>/
 *   - 剔除 Codex 专属 agents/openai.yaml
 *   - 卸载只删本管理器登记的受管技能,绝不碰用户自建技能
 */

import { join, basename } from 'node:path'
import { rmSync, existsSync } from 'node:fs'
import { Manifest, copySkillBundle, type InstalledPlugin } from './manifest.js'
import type { RemotePlugin, RemoteSkill } from './remote.js'

export interface SyncResult {
  installed: string[]
  skipped: string[]
  errors: string[]
}

export class SyncEngine {
  constructor(private manifest: Manifest) {}

  private get skillsRoot(): string {
    return join(this.manifest.dshHome, 'skills')
  }

  /**
   * 安装一个插件及其技能到 ~/.dsh/skills。
   * @param sourceId   所属市场来源 id
   * @param plugin     解析出的插件
   * @param onlySkills 可选:只装其中某些技能(对应 GUI 技能开关 '开')
   */
  installPlugin(sourceId: string, plugin: RemotePlugin, onlySkills?: string[]): SyncResult {
    const res: SyncResult = { installed: [], skipped: [], errors: [] }
    const target = new Set(onlySkills ?? plugin.skills.map((s) => s.name))
    const previous = this.manifest.listInstalled().find((p) => p.pluginId === plugin.id && p.sourceId === sourceId)

    for (const skill of plugin.skills) {
      if (!target.has(skill.name)) continue
      try {
        copySkillBundle(skill.dir, this.skillsRoot, skill.name)
        this.manifest.clearTombstone(skill.name)
        res.installed.push(skill.name)
      } catch (e) {
        res.errors.push(`${skill.name}: ${(e as Error).message}`)
      }
    }

    const available = new Set(plugin.skills.map((skill) => skill.name))
    const retained = previous?.skills.filter((name) => available.has(name)) ?? []
    for (const name of previous?.skills ?? []) {
      if (!available.has(name)) this.manifest.tombstone(name)
    }
    this.manifest.recordInstalled({
      pluginId: plugin.id,
      sourceId,
      displayName: plugin.displayName,
      description: plugin.description,
      category: plugin.category,
      skills: Array.from(new Set([...retained, ...res.installed])),
      commit: null, // caller 可在 resolve 后回填
      installedAt: new Date().toISOString(),
    })
    return res
  }

  /** 回填 commit(git HEAD),便于"更新"比对。 */
  setCommit(sourceId: string, pluginId: string, commit: string | null) {
    const cur = this.manifest.listInstalled().find((p) => p.pluginId === pluginId && p.sourceId === sourceId)
    if (cur) {
      this.manifest.recordInstalled({ ...cur, commit })
    }
  }

  /**
   * 卸载插件:删除其受管技能目录 + 从清单剔除。
   * 严格按清单删,绝不整目录删除。
   */
  uninstallPlugin(sourceId: string, pluginId: string): { removed: string[] } {
    const p = this.manifest.listInstalled().find((x) => x.pluginId === pluginId && x.sourceId === sourceId)
    const removed: string[] = []
    if (p) {
      for (const name of p.skills) {
        const d = join(this.skillsRoot, name)
        if (existsSync(d) && !this.manifest.isManagedElsewhere(name, sourceId, pluginId)) {
          rmSync(d, { recursive: true, force: true })
          removed.push(name)
        }
      }
      this.manifest.removeInstalled(pluginId, sourceId)
    }
    return { removed }
  }

  /**
   * 卸载单个技能(对应 GUI 技能开关 '关')。
   * 从该插件已装集合剔除;若集合清空则整插件从清单移除。
   */
  uninstallSkill(sourceId: string, pluginId: string, skill: string): { removed: boolean } {
    const p = this.manifest.listInstalled().find((x) => x.pluginId === pluginId && x.sourceId === sourceId)
    if (!p) return { removed: false }
    if (!p.skills.includes(skill)) return { removed: false }
    const d = join(this.skillsRoot, skill)
    if (existsSync(d) && !this.manifest.isManagedElsewhere(skill, sourceId, pluginId)) rmSync(d, { recursive: true, force: true })
    const rest = p.skills.filter((n) => n !== skill)
    if (rest.length === 0) {
      this.manifest.removeInstalled(pluginId, sourceId) // 会记录墓碑
    } else {
      this.manifest.recordInstalled({ ...p, skills: rest })
      this.manifest.tombstone(skill)
    }
    return { removed: true }
  }

  /**
   * 移除孤立技能:曾由本管理器安装(在墓碑)、当前不再受管、且残留在 skills 根的目录。
   * 绝不触碰用户自建/从未受管的技能。幂等,可安全在每次 boot/update 后调用。
   */
  pruneOrphans(): string[] {
    const removed: string[] = []
    const gone: string[] = []
    for (const name of this.manifest.orphanSkills()) {
      const d = join(this.skillsRoot, name)
      if (existsSync(d)) {
        rmSync(d, { recursive: true, force: true })
        removed.push(name)
        gone.push(name)
      }
    }
    // 已清理完成的,从墓碑移除;仍清理不到的(根目录里不存在)保留墓碑待下次。
    this.manifest.clearTombstones(gone)
    return removed
  }

  /** 返回当前 GUI 展示所需的"插件维度"聚合视图(从 manifest 还原)。 */
  pluginView(sourceId: string): InstalledPlugin[] {
    return this.manifest.listInstalledBySource(sourceId)
  }
}
