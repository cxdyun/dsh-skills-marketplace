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

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { MarketSource } from './manifest.js'

export interface RemoteSkill {
  name: string
  pluginId: string
  dir: string      // 含 SKILL.md 的 bundle 目录
  description?: string // 解析自 SKILL.md frontmatter(GUI 技能开关展示用)
}

export interface RemotePlugin {
  id: string
  displayName: string
  description: string
  category?: string
  skills: RemoteSkill[]
}

export interface ResolvedMarket {
  plugins: RemotePlugin[]
  commit: string | null
}

function runGit(cwd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGTERM',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  const err = r.error?.message ?? r.stderr ?? ''
  return { ok: r.status === 0, out: r.stdout ?? '', err }
}

export function sourceIdFor(url: string): string {
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '')
  const last = clean.split(/[/:]/).filter(Boolean).pop() ?? 'market'
  const slug = last.replace(/[^a-zA-Z0-9_-]/g, '-') || 'market'
  return `${slug}-${createHash('sha256').update(clean).digest('hex').slice(0, 10)}`
}

/** 给定 source id,返回其缓存目录(与 cloneMarket 一致)。 */
export function cacheDirFor(sourceId: string): string {
  const home = process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh')
  return join(home, 'markets-cache', sourceId)
}

/** 获取默认分支名(remote 探测),失败回退 'master'。 */
export function defaultBranch(url: string): string {
  const r = spawnSync('git', ['ls-remote', '--symref', url, 'HEAD'], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  const m = /HEAD\s+ref:\s+refs\/heads\/([^\s]+)/.exec(r.stdout ?? '')
  return m ? m[1] : 'master'
}

/** 执行一次稀疏拉取,把仓库落到 cacheDir。幂等:已有 clone 则增量 fetch。 */
export function cloneMarket(src: Pick<MarketSource, 'url' | 'ref' | 'sparsePath'> & Partial<Pick<MarketSource, 'id'>>): { id: string; cacheDir: string } {
  const id = src.id ?? sourceIdFor(src.url)
  const cacheDir = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'markets-cache', id)
  mkdirSync(cacheDir, { recursive: true })

  const ref = src.ref.trim() || defaultBranch(src.url)
  const sparsePath = src.sparsePath.trim()
  const sparse = sparsePath || '.'
  const hasOrigin = runGit(cacheDir, ['remote']).out.includes('origin')

  // 1. 初始化或复用现有仓库
  if (!hasOrigin) {
    let r = runGit(cacheDir, ['init', '-q'])
    if (!r.ok) throw new Error(`git init failed: ${r.err}`)
    r = runGit(cacheDir, ['remote', 'add', 'origin', src.url])
    if (!r.ok) throw new Error(`git remote add failed: ${r.err}`)
  } else {
    const origin = runGit(cacheDir, ['remote', 'get-url', 'origin'])
    if (!origin.ok) throw new Error(`git remote get-url failed: ${origin.err}`)
    if (origin.out.trim() !== src.url) {
      const r = runGit(cacheDir, ['remote', 'set-url', 'origin', src.url])
      if (!r.ok) throw new Error(`git remote set-url failed: ${r.err}`)
    }
  }
  // 2. 抓取(首拉带 blob filter 浅抓;增量用普通 fetch)
  let r = runGit(cacheDir, hasOrigin
    ? ['fetch', '--depth=1', 'origin', ref]
    : ['fetch', '--filter=blob:none', '--depth=1', 'origin', ref])
  if (!r.ok) throw new Error(`git fetch failed: ${r.err}`)

  // 3/4. 稀疏路径为空时检出整个仓库；`set .` 在 cone 模式会留下空工作区。
  if (sparsePath) {
    r = runGit(cacheDir, ['sparse-checkout', 'init', '--cone'])
    if (!r.ok) throw new Error(`sparse-checkout init failed: ${r.err}`)
    r = runGit(cacheDir, ['sparse-checkout', 'set', sparse])
    if (!r.ok) throw new Error(`sparse-checkout set ${sparse} failed: ${r.err}`)
  } else {
    r = runGit(cacheDir, ['sparse-checkout', 'disable'])
    if (!r.ok) throw new Error(`sparse-checkout disable failed: ${r.err}`)
  }
  r = runGit(cacheDir, ['checkout', ref])
  if (!r.ok) throw new Error(`git checkout ${ref} failed: ${r.err}`)

  // 增量 fetch 后本地分支/工作区可能仍停留在旧 commit:fetch 只更新 FETCH_HEAD 与
  // remote-tracking 引用,对已存在的本地分支 checkout 是 no-op。强制对齐到本次
  // fetch 下来的最新快照,保证「更新」真正拿到 ref 的最新内容(缓存 .catalog.json
  // 的 commit 比对也随之失效,自动重新解析目录)。
  r = runGit(cacheDir, ['reset', '--hard', 'FETCH_HEAD'])
  if (!r.ok) throw new Error(`git reset failed: ${r.err}`)

  return { id, cacheDir }
}

/** 从已拉取的 cache 里解析出插件与技能清单。 */
export function resolveMarket(cacheDir: string, sparsePath: string): ResolvedMarket {
  // A. 显式清单 dsh.market.json(若存在)
  const explicitFile = join(cacheDir, sparsePath, 'dsh.market.json')
  const fsTryExplicit = tryReadJson(explicitFile)
  if (fsTryExplicit) {
    return resolveExplicit(fsTryExplicit, cacheDir)
  }
  // B. 约定式:walk cache 找 skills 目录下的 SKILL.md
  return resolveConvention(cacheDir, sparsePath)
}

function tryReadJson(p: string): any | null {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function resolveExplicit(markets: any, cacheDir: string): ResolvedMarket {
  const plugins: RemotePlugin[] = []
  for (const p of markets.plugins ?? []) {
    const skillRoot = join(cacheDir, p.skills ?? '')
    const skills: RemoteSkill[] = collectSkillBundles(skillRoot, p.id)
    plugins.push({
      id: p.id,
      displayName: p.displayName ?? p.id,
      description: p.description ?? '',
      category: p.category,
      skills,
    })
  }
  return { plugins, commit: headCommit(cacheDir) }
}

/**
 * B. 约定式发现 —— 从已拉取的仓库按目录约定还原插件与技能。
 *
 * 兼容三种形态的 sparsePath:
 *  1) 指向「插件容器」(如 plugins/):把每个含 skills/ 的一级子目录当作一个插件。
 *  2) 指向「单个插件目录」(如 plugins/my-plugin):直接识别它为一个插件。
 *  3) 指向根('.')或任意目录:尽量向上归集含 skills/ 的插件;若一级子目录无插件,
 *     递归向下扫描嵌套容器(如 plugins/ 下的插件)兜底,避免 sparsePath 留空时漏发现。
 */
function resolveConvention(cacheDir: string, sparsePath: string): ResolvedMarket {
  const root = join(cacheDir, sparsePath)
  const plugins: RemotePlugin[] = []

  // 情况 2:sparsePath 本身就指向一个带 skills/ 的插件目录
  if (isPluginDir(root)) {
    const p = pluginFromDir(root)
    if (p && p.skills.length) plugins.push(p)
    return { plugins, commit: headCommit(cacheDir) }
  }

  // 情况 1/3:遍历 root 的一级子目录
  const seen = new Set<string>()
  for (const pd of listDirs(root)) {
    const p = pluginFromDir(pd)
    if (p && p.skills.length) { plugins.push(p); seen.add(p.id) }
  }
  // 一级子目录无插件(如根目录只是容器)时,递归扫描嵌套的 skills/ 兜底
  for (const p of collectNestedPlugins(root)) {
    if (!seen.has(p.id)) { plugins.push(p); seen.add(p.id) }
  }
  return { plugins, commit: headCommit(cacheDir) }
}

/** 递归收集一棵目录树下所有「含 skills/ 的目录」作为插件(不重复收录)。 */
function collectNestedPlugins(dir: string): RemotePlugin[] {
  const out: RemotePlugin[] = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of listDirs(cur)) {
      if (isPluginDir(child)) {
        const p = pluginFromDir(child)
        if (p && p.skills.length) out.push(p)
      } else {
        stack.push(child)
      }
    }
  }
  return out
}

/** 目录是否为插件:存在直接的 skills/ 子目录(且 skills 本身来自约定的子项)。 */
function isPluginDir(dir: string): boolean {
  return existsSync(join(dir, 'skills'))
}

/** 从单个插件目录解析出插件(读取 plugin.json 元数据 + 收集其技能)。 */
function pluginFromDir(pd: string): RemotePlugin | null {
  const skillsDir = join(pd, 'skills')
  if (!existsSync(skillsDir)) return null
  const pid = basename(pd)
  const skills = collectSkillBundles(skillsDir, pid)
  if (skills.length === 0) return null
  const meta = pluginMeta(pd)
  return {
    id: pid,
    displayName: meta.displayName ?? pid,
    description: meta.description ?? '',
    category: meta.category,
    skills,
  }
}

function pluginMeta(pd: string): { displayName?: string; description?: string; category?: string } {
  // 优先 Codex plugin.json
  const codex = tryReadJson(join(pd, '.codex-plugin', 'plugin.json'))
  if (codex) {
    const itf = codex.interface
    return {
      displayName: itf?.displayName ?? codex.name,
      description: itf?.shortDescription ?? codex.description,
      category: itf?.category,
    }
  }
  // 兜底顶层 plugin.json
  const flat = tryReadJson(join(pd, 'plugin.json'))
  if (flat) {
    return {
      displayName: flat.displayName ?? flat.name,
      description: flat.description,
      category: flat.category,
    }
  }
  // Claude .claude-plugin/marketplace.json 里的同名 plugin 项(可选)
  const claude = tryReadJson(join(pd, '..', '.claude-plugin', 'marketplace.json'))
  if (claude && Array.isArray(claude.plugins)) {
    const match = claude.plugins.find((x: any) => basename(String(x?.source ?? '').replace(/^\.?\//, '')) === basename(pd))
    if (match) return { description: match.description, category: match.category }
  }
  return {}
}

/** 从一个目录里收集所有 <name>/SKILL.md bundle,并解析每个技能的 description。
 *  listDirs 返回完整路径,故直接用作技能目录。
 */
export function collectSkillBundles(root: string, pluginId: string): RemoteSkill[] {
  const out: RemoteSkill[] = []
  for (const skillDir of listDirs(root)) {
    const skillMd = join(skillDir, 'SKILL.md')
    if (exists(skillMd)) {
      out.push({
        name: basename(skillDir),
        pluginId,
        dir: skillDir,
        description: frontmatterDescription(skillMd),
      })
    }
  }
  return out
}

/** 从 SKILL.md 提取 frontmatter 的 description(纯文本粗略解析,不依赖 yaml 库)。 */
export function frontmatterDescription(skillMd: string): string | undefined {
  try {
    const txt = readFileSync(skillMd, 'utf8')
    const m = /^---\n([\s\S]*?)\n---/.exec(txt)
    const fm = m ? m[1] : ''
    const dm = /^description\s*:\s*(.+)$/m.exec(fm)
    return dm ? dm[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

// ---- helpers ----
function listDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => join(root, d.name))
}

function exists(p: string): boolean {
  return existsSync(p)
}

function headCommit(cacheDir: string): string | null {
  const r = runGit(cacheDir, ['rev-parse', 'HEAD'])
  return r.ok && r.out.trim() ? r.out.trim() : null
}

/** CLI 用的完整 source → resolve 流程。 */
export function fetchAndResolve(url: string, ref?: string, sparsePath?: string, sourceId?: string): { id: string; ref: string; cacheDir: string; market: ResolvedMarket } {
  const resolvedRef = ref?.trim() || defaultBranch(url)
  const src = { id: sourceId, url, ref: resolvedRef, sparsePath: sparsePath?.trim() ?? '' }
  const { cacheDir } = cloneMarket(src)
  const market = resolveMarket(cacheDir, src.sparsePath)
  return { id: src.id ?? sourceIdFor(url), ref: resolvedRef, cacheDir, market }
}

/**
 * 带磁盘缓存的 resolve:把上次解析结果(带 commit)落到 cacheDir 的 .catalog.json。
 * 若磁盘缓存存在且 checkout 的 HEAD 与缓存 commit 一致,直接读缓存,跳过整套
 * sparse-checkout/resolve —— 让「插件目录」重复打开立即响应。
 *
 * @returns { market, fromCache: boolean, commit }
 */
export function resolveMarketCached(
  sourceId: string,
  cacheDir: string,
  sparsePath: string,
): { market: ResolvedMarket; fromCache: boolean; commit: string | null } {
  const cacheFile = join(cacheDir, '.catalog.json')
  const disk = tryReadJson(cacheFile) as { commit?: string | null; plugins?: RemotePlugin[] } | null

  // 若 checkout 已存在且 HEAD 与磁盘缓存 commit 相同 → 直接读缓存,零网络。
  let head: string | null = null
  let resolved: ResolvedMarket | null = null
  if (disk && disk.commit && exists(cacheDir)) {
    head = headCommit(cacheDir)
    if (head === disk.commit) {
      resolved = { plugins: disk.plugins ?? [], commit: head }
    }
  }

  if (resolved) {
    // 缓存命中:保证技能条目字段完整(defaults)
    return { market: resolved, fromCache: true, commit: head }
  }

  // 未命中:重新解析并落盘缓存。
  const fresh = resolveMarket(cacheDir, sparsePath)
  try {
    writeFileSync(cacheFile, JSON.stringify({ commit: fresh.commit, plugins: fresh.plugins }, null, 2))
  } catch { /* cache write is best-effort */ }
  return { market: fresh, fromCache: false, commit: fresh.commit }
}

/** 判断某个 source 的 checkout 是否已就绪(用于「插件目录」点击前快速预览)。 */
export function isCheckoutReady(cacheDir: string): boolean {
  return existsSync(cacheDir) && existsSync(join(cacheDir, '.git')) && headCommit(cacheDir) !== null
}
