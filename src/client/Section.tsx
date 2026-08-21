/**
 * Section.tsx — 设置页「技能市场」section 组件。
 *
 * 采用 DSH 官方设计语言:使用 @deepseek-ai/dsh-client-ui-primitives 的
 * Button/Pill/Input,配合官方 --dsw-alias-* token 与 dshmarket 同类卡片样式,
 * 自适应浅/深色主题,与内置「插件市场」观感一致。
 *
 * 数据通过 MarketRemote 走 host 的 /skills-marketplace/* 端点。
 * 渲染三个层级:来源列表 → 插件目录(插件维度)→ 插件详情(技能开关)。
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Pill, Input, IconChevronDownOutline14, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { MarketRemote, type PluginBrief, type InstalledPlugin, type MarketSource } from './remote.ts'

// ---- 官方 alias token(宿主 design-platform.css 提供,自适应主题) ----
const T = {
  bg1: 'var(--dsw-alias-bg-layer-1,#fff)',
  bg2: 'var(--dsw-alias-bg-layer-2,#f3f4f6)',
  bg3: 'var(--dsw-alias-bg-layer-3,#fafafa)',
  bgPlatform: 'var(--dsw-alias-bg-module-platform,#f7f8fa)',
  interactiveHover: 'var(--dsw-alias-interactive-bg-hover,rgba(79,110,247,.06))',
  border2: 'var(--dsw-alias-border-l2,#e5e7eb)',
  // 更柔和的卡片边框:宿主 token 加透明度,深浅主题都不过亮
  borderSoft: 'color-mix(in srgb, var(--dsw-alias-bg-layer-3,#343536) 92%, var(--dsw-alias-label-primary,#fff))',
  l1: 'var(--dsw-alias-label-primary,#1f2328)',
  l2: 'var(--dsw-alias-label-secondary,#6b7280)',
  l3: 'var(--dsw-alias-label-tertiary,#8b93a1)',
  success: 'var(--dsw-alias-state-success-primary,#16a34a)',
  error: 'var(--dsw-alias-state-error-primary,#dc2626)',
} as const

// 中文字案
const L: Record<string, string> = {
  myMarkets: '插件市场', none: '尚未添加任何插件市场', addMarket: '添加插件市场', edit: '编辑',
  source: '来源', sourceHint: '仓库地址 · org/repo 或 https/git 链接',
  gitRef: 'Git 引用', gitRefHint: '分支、Tag 或 commit',
  sparsePath: '稀疏路径', sparsePathHint: '可选，插件子目录，如 plugins/',
  addBtn: '保存', saveBtn: '保存', loading: '处理中…', cancel: '取消',
  pluginCatalog: '插件列表', collapse: '收起', install: '安装', removeSource: '移除', emptyCatalog: '该来源下未发现插件',
  back: '返回', catalogLoading: '正在加载插件清单',
  allSkills: '全部技能', enabledPrefix: '已启用 ',
  skillCount: '技能', installedCount: '已安装', error: '失败',
}

type View = { kind: 'sources' } | { kind: 'detail'; source: string; plugin: string }

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, fontFamily: 'inherit' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px 6px' },
  // 二三级页面顶部条:返回按钮居左,标题紧随其后,左对齐
  headerRow: { display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 } as const,
  title: { fontSize: 17, lineHeight: '24px', fontWeight: 600, margin: 0, color: T.l1 },
  sub: { fontSize: 12, lineHeight: '18px', color: T.l3, margin: 0 },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sourcePill: { background: T.bg2, color: T.l2, border: '0' } as const,
  // 官方式内联展开卡片(对齐 dsh 内置「插件列表」):市场源卡片 + 卡片内展开插件清单
  capiCard: { background: T.bg3, border: `1px solid ${T.borderSoft}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10, transition: 'box-shadow .14s ease,border-color .14s ease' } as const,
  capiHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', cursor: 'pointer', minHeight: 52, transition: 'background .14s ease' } as const,
  capiHeadHover: { background: T.interactiveHover } as const,
  capiHeadLeft: { flex: 1, minWidth: 0 },
  capiName: { fontWeight: 600, fontSize: 14, lineHeight: '20px', color: T.l1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const,
  capiUrl: { fontSize: 11, color: T.l3, fontFamily: 'ui-monospace,Menlo,monospace', overflowWrap: 'anywhere', margin: '2px 0 6px' },
  capiTrailing: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 150 },
  capiChevron: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 28px', width: 28, height: 28, padding: 0, margin: 0, border: 0, borderRadius: 6, background: 'transparent', color: T.l3, cursor: 'pointer', appearance: 'none' } as const,
  capiChevronIcon: { flex: 'none', transition: 'transform .16s var(--ds-ease-in-out,ease)' } as const,
  capiChevronOpen: { transform: 'rotate(180deg)' } as const,
  capiDetails: { borderTop: `1px solid ${T.borderSoft}`, background: T.bgPlatform, padding: '12px 14px 14px' } as const,
  // CodeX 式添加表单:纵向卡片,每个字段带 label
  addCard: { background: T.bg1, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 } as const,
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: T.l2, margin: 0 },
  fieldHelp: { fontSize: 11, color: T.l3, margin: 0 },
  fieldInput: { width: '100%', minWidth: 0 } as const,
  formActions: { display: 'flex', gap: 8, marginTop: 4 },
  actionButton: { flexShrink: 0, minWidth: 64, whiteSpace: 'nowrap' } as const,
  configAction: { boxSizing: 'border-box', minWidth: 'auto', height: 32, padding: '0 14px', border: `1px solid ${T.border2}`, borderRadius: 999, background: 'transparent', color: T.l1, fontSize: 13, lineHeight: '20px', fontWeight: 400, boxShadow: 'none' } as const,
  loadingLabel: { display: 'inline-flex', alignItems: 'center', gap: 6 } as const,
  loadingSpinner: { display: 'inline-flex', flex: '0 0 16px', width: 16, height: 16, animation: 'dsh-skills-spin 0.8s linear infinite', transformOrigin: '50% 50%' } as const,
  // 插件网格卡
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px,1fr))', gap: 10 },
  plug: { background: T.bg2, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' } as const,
  plugTitle: { fontWeight: 600, fontSize: 14, lineHeight: '20px', color: T.l1, margin: 0 },
  plugDesc: { fontSize: 12, lineHeight: '18px', color: T.l3, margin: 0, minHeight: 36 },
  plugFoot: { display: 'flex', alignItems: 'center', gap: 6 },
  badge: { display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 8px', borderRadius: 9, background: T.bg3, color: T.l2, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' } as const,
  badgeSuccess: { display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 8px', borderRadius: 9, background: T.success, color: '#fff', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' } as const,
  allLabel: { fontWeight: 500, fontSize: 13, color: T.l1, margin: 0 } as const,
  allCount: { fontSize: 12, color: T.l2, margin: 0 } as const,
  // 技能详情行
  skill: { background: T.bg1, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 } as const,
  skillText: { flex: 1, minWidth: 0 },
  skillName: { fontWeight: 600, fontSize: 13, lineHeight: '20px', color: T.l1, margin: 0 },
  skillDesc: { fontSize: 12, lineHeight: '18px', color: T.l3, margin: 0 },
  // 全部技能开关行:无底色、无卡片包裹,视觉上是标题行,与下方技能卡区分
  allRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0 10px', marginBottom: 2, borderBottom: `1px solid ${T.border2}` } as const,
  // 官方 switch(按钮式,38x22)
  switchBase: { position: 'relative', width: 38, height: 22, borderRadius: 99, border: `1px solid ${T.border2}`, background: T.bg2, cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background .15s ease,border-color .15s ease' } as const,
  switchKnob: { position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .15s ease' } as const,
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.l2, fontSize: 13, padding: '24px 16px', textAlign: 'center', width: '100%', boxSizing: 'border-box' } as const,
  catalogLoading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.l2, fontSize: 13, padding: 32 } as const,
  err: { color: T.error, fontSize: 12, margin: '8px 0', whiteSpace: 'pre-wrap' } as const,
}

type CSSN = React.CSSProperties

function BackButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" size="sm" onClick={onClick}>{L.back}</Button>
}

export function SkillMarketSection(props: { remote?: MarketRemote }) {
  const remote = props.remote ?? new MarketRemote()
  const [view, setView] = useState<View>({ kind: 'sources' })
  const [sources, setSources] = useState<MarketSource[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, PluginBrief[]>>({})
  const [installedBySource, setInstalledBySource] = useState<Record<string, InstalledPlugin[]>>({})
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [hoveredSource, setHoveredSource] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ url: '', ref: '', sparsePath: '' })

  const loadSources = useCallback(async () => {
    try {
      const s = await remote.listSources()
      setSources(s)
      if (s.length === 0) setView((v) => (v.kind === 'sources' ? { kind: 'sources' } : v))
    } catch (e) { setError(String((e as Error).message)) }
  }, [remote])

  const loadInstalled = useCallback(async (sid: string) => {
    try {
      const installed = await remote.installed(sid)
      setInstalledBySource((current) => ({ ...current, [sid]: installed }))
    } catch { /* best-effort */ }
  }, [remote])

  useEffect(() => { void loadSources() }, [loadSources])

  /** 打开插件目录:立即用缓存渲染(若已缓存),后台刷新。 */
  const openCatalog = useCallback(async (sid: string, forceOpen = false) => {
    const cached = catalogs[sid]
    setError('')
    if (expandedSource === sid && !forceOpen) {
      setExpandedSource(null)
      return
    }
    // 每个来源独立存储目录，晚到的请求不能覆盖当前展开的市场。
    setExpandedSource(sid)
    setView({ kind: 'sources' })
    if (!cached) setCatalogLoading(sid)
    try {
      const c = await remote.catalog(sid)
      setCatalogs((current) => ({ ...current, [sid]: c.plugins }))
      void loadInstalled(sid)
    } catch (e) {
      if (!cached) setError(String((e as Error).message))
    } finally {
      setCatalogLoading((current) => current === sid ? null : current)
    }
  }, [remote, loadInstalled, catalogs, expandedSource])

  const openDetail = useCallback(async (sid: string, pluginId: string) => {
    // 立即切视图 + 后台刷新 installed
    setView({ kind: 'detail', source: sid, plugin: pluginId })
    void loadInstalled(sid)
  }, [loadInstalled])

  const addSource = async () => {
    if (!form.url.trim()) return
    setBusy(true); setError('')
    try {
      let added: MarketSource | undefined
      if (editing) added = await remote.updateSource(editing, { url: form.url.trim(), ref: form.ref.trim() || undefined, sparsePath: form.sparsePath.trim() })
      else added = (await remote.addSource({ url: form.url.trim(), ref: form.ref.trim() || undefined, sparsePath: form.sparsePath.trim() })).source
      setForm({ url: '', ref: '', sparsePath: '' })
      setEditing(null)
      setAdding(false)
      await loadSources()
      if (added) await openCatalog(added.id, true)
    } catch (e) { setError(String((e as Error).message)) } finally { setBusy(false) }
  }

  const editSource = (s: MarketSource) => {
    setForm({ url: s.url, ref: s.ref, sparsePath: s.sparsePath })
    setEditing(s.id)
    setAdding(true)
    setError('')
  }

  const removeSource = async (id: string) => {
    setRemoving(id); setError('')
    try {
      await remote.removeSource(id)
      setCatalogs((current) => { const next = { ...current }; delete next[id]; return next })
      setInstalledBySource((current) => { const next = { ...current }; delete next[id]; return next })
      setExpandedSource((current) => current === id ? null : current)
      await loadSources()
    } catch (e) { setError(String((e as Error).message)) } finally { setRemoving(null) }
  }

  // —— 乐观更新:先即时改 UI,后台落盘,不阻塞点击 ——
  const optimisticPatch = useCallback((sid: string, pluginId: string, fn: (cur: InstalledPlugin[]) => InstalledPlugin[]) => {
    setInstalledBySource((current) => ({ ...current, [sid]: fn(current[sid] ?? []) }))
  }, [])

  /** 单个技能切换:立即翻转,后台安装/卸载。 */
  const onToggle = useCallback((pluginId: string, skill: string, on: boolean) => {
    if (view.kind !== 'detail') return
    const sid = view.source
    // 乐观:即时更新 installed → 开关立刻响应
    optimisticPatch(sid, pluginId, (cur) => {
      const idx = cur.findIndex((p) => p.pluginId === pluginId && p.sourceId === sid)
      if (on) {
        // 开启:确保该插件条目 + 该技能
        if (idx === -1) {
          return [...cur, { pluginId, sourceId: sid, displayName: pluginId, description: '', skills: [skill], commit: null, installedAt: new Date().toISOString() }]
        }
        const next = [...cur]
        next[idx] = { ...next[idx], skills: Array.from(new Set([...next[idx].skills, skill])) }
        return next
      }
      // 关闭:移除该技能;若空则整插件移除
      if (idx === -1) return cur
      const rest = cur[idx].skills.filter((s) => s !== skill)
      const next = [...cur]
      if (rest.length === 0) next.splice(idx, 1)
      else next[idx] = { ...next[idx], skills: rest }
      return next
    })
    // 后台执行,不阻塞
    void (async () => {
      try {
        if (on) await remote.installPlugin(sid, pluginId, [skill])
        else await remote.toggleSkill(sid, pluginId, skill, false)
      } catch (e) { setError(String((e as Error).message)) }
      // 后台拉最新一致
      void loadInstalled(sid)
    })()
  }, [view, remote, optimisticPatch, loadInstalled])

  /** 一键开启/关闭插件下所有技能:即时翻转,后台批量执行。 */
  const onToggleAll = useCallback((pluginId: string, on: boolean) => {
    if (view.kind !== 'detail') return
    const sid = view.source
    const p = catalogs[sid]?.find((x: PluginBrief) => x.id === pluginId)
    if (!p || p.skills.length === 0) return
    const allNames = p.skills.map((s) => s.name)
    // 乐观:即时更新 installed
    optimisticPatch(sid, pluginId, (cur) => {
      const idx = cur.findIndex((x) => x.pluginId === pluginId && x.sourceId === sid)
      if (on) {
        // 全开:该插件所有技能
        if (idx === -1) {
          return [...cur, { pluginId, sourceId: sid, displayName: pluginId, description: '', skills: allNames, commit: null, installedAt: new Date().toISOString() }]
        }
        const next = [...cur]
        next[idx] = { ...next[idx], skills: Array.from(new Set([...next[idx].skills, ...allNames])) }
        return next
      }
      // 全关:移除整个插件
      if (idx === -1) return cur
      const next = [...cur]
      next.splice(idx, 1)
      return next
    })
    void (async () => {
      try {
        if (on) await remote.installPlugin(sid, pluginId, allNames)
        else await remote.uninstallPlugin(sid, pluginId)
      } catch (e) { setError(String((e as Error).message)) }
      void loadInstalled(sid)
    })()
  }, [view, remote, optimisticPatch, loadInstalled, catalogs])

  const installedSet = (sid: string, pluginId: string): Set<string> => {
    const p = installedBySource[sid]?.find((x) => x.pluginId === pluginId)
    return new Set(p?.skills ?? [])
  }
  const t = (k: string) => L[k] ?? k

  const sourceName = (source: MarketSource): string => {
    const clean = source.url.replace(/\.git$/, '').replace(/\/$/, '')
    return clean.split(/[/:]/).filter(Boolean).pop() || source.id
  }

  const pluginCards = (sid: string) => (catalogs[sid] ?? []).map((p) => (
    <div key={p.id} style={styles.plug as CSSN} onClick={() => openDetail(sid, p.id)}>
      <p style={styles.plugTitle as CSSN}>{p.displayName || p.id}</p>
      <p style={styles.plugDesc as CSSN}>{p.description}</p>
      <div style={styles.plugFoot as CSSN}>
        <span style={styles.badge as CSSN}>{p.skills.length} {t('skillCount')}</span>
        <span style={(installedSet(sid, p.id).size > 0 ? styles.badgeSuccess : styles.badge) as CSSN}>{installedSet(sid, p.id).size} {t('installedCount')}</span>
      </div>
    </div>
  ))

  return (
    <div style={styles.root as CSSN}>
      <style>{'@keyframes dsh-skills-spin{to{transform:rotate(360deg)}}'}</style>
      {error && <div style={styles.err as CSSN}>{t('error')}: {error}</div>}

      {view.kind === 'sources' && (
        <>
          <div style={styles.head as CSSN}>
            <h2 style={styles.title as CSSN}>{t('myMarkets')}</h2>
            <Button variant="outline" size="sm" style={styles.configAction as CSSN} onClick={() => { setAdding(!adding); setEditing(null); setForm({ url: '', ref: '', sparsePath: '' }) }}>{t('addMarket')}</Button>
          </div>

          {/* CodeX 式添加表单:纵向卡片,每个字段带 label */}
          {adding && (
            <div style={styles.addCard as CSSN}>
              <div style={styles.field as CSSN}>
                <label style={styles.fieldLabel as CSSN}>{t('source')}</label>
                <Input
                  style={styles.fieldInput as CSSN}
                  placeholder="org/repo 或 git@github.com:org/repo.git"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
                <p style={styles.fieldHelp as CSSN}>{t('sourceHint')}</p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ ...styles.field as CSSN, flex: 1, minWidth: 140 }}>
                  <label style={styles.fieldLabel as CSSN}>{t('gitRef')}</label>
                  <Input style={styles.fieldInput as CSSN} placeholder="留空则自动检测" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
                  <p style={styles.fieldHelp as CSSN}>{t('gitRefHint')}</p>
                </div>
                <div style={{ ...styles.field as CSSN, flex: 1.2, minWidth: 160 }}>
                  <label style={styles.fieldLabel as CSSN}>{t('sparsePath')}</label>
                  <Input style={styles.fieldInput as CSSN} placeholder="plugins" value={form.sparsePath} onChange={(e) => setForm({ ...form, sparsePath: e.target.value })} />
                  <p style={styles.fieldHelp as CSSN}>{t('sparsePathHint')}</p>
                </div>
              </div>
              <div style={styles.formActions as CSSN}>
                <Button variant="outline" size="sm" style={styles.configAction as CSSN} onClick={addSource} disabled={busy}>{busy ? <span style={styles.loadingLabel as CSSN}><span style={styles.loadingSpinner as CSSN}><IconLoadingOutline16 /></span>保存</span> : editing ? t('saveBtn') : t('addBtn')}</Button>
                <Button variant="ghost" size="md" style={styles.actionButton as CSSN} onClick={() => { setAdding(false); setEditing(null); setForm({ url: '', ref: '', sparsePath: '' }) }}>{t('cancel')}</Button>
              </div>
            </div>
          )}

          {sources.length === 0 ? <div style={styles.empty as CSSN}>{t('none')}</div> : sources.map((s) => {
            const open = expandedSource === s.id
            return (
              <div
                key={s.id}
                style={styles.capiCard as CSSN}
              >
                {/* 卡片头:点击在卡片内部展开/收起插件清单 */}
                <div
                  style={{ ...styles.capiHead as CSSN, ...(hoveredSource === s.id ? styles.capiHeadHover : null) }}
                  role="button"
                  aria-expanded={open}
                  tabIndex={0}
                  onClick={() => openCatalog(s.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openCatalog(s.id) } }}
                  onMouseEnter={() => setHoveredSource(s.id)}
                  onMouseLeave={() => setHoveredSource(null)}
                >
                  <div style={styles.capiHeadLeft as CSSN}>
                    <p style={styles.capiName as CSSN}>{sourceName(s)}</p>
                    <p style={styles.capiUrl as CSSN}>{s.url}</p>
                    <div style={styles.tags as CSSN}>
                      <Pill style={styles.sourcePill as CSSN}>ref {s.ref}</Pill>
                      {s.sparsePath && <Pill style={styles.sourcePill as CSSN}>{s.sparsePath}</Pill>}
                    </div>
                  </div>
                  <div style={styles.capiTrailing as CSSN} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" style={styles.actionButton as CSSN} onClick={() => editSource(s)}>{t('edit')}</Button>
                    <Button variant="outline" size="sm" style={styles.actionButton as CSSN} disabled={removing === s.id} onClick={() => removeSource(s.id)}>{removing === s.id ? <span style={styles.loadingLabel as CSSN}><span style={styles.loadingSpinner as CSSN}><IconLoadingOutline16 /></span>{t('removeSource')}</span> : t('removeSource')}</Button>
                    <button
                      type="button"
                      aria-label={open ? t('collapse') : t('pluginCatalog')}
                      style={styles.capiChevron as CSSN}
                      onClick={(e) => { e.stopPropagation(); void openCatalog(s.id) }}
                    ><IconChevronDownOutline14 style={{ ...styles.capiChevronIcon as CSSN, ...(open ? styles.capiChevronOpen : null) }} /></button>
                  </div>
                </div>
                {/* 卡片内展开区:插件清单位于同一卡片内部,不再与市场源割裂 */}
                {open && (
                  <div style={styles.capiDetails as CSSN}>
                    {catalogLoading === s.id
                      ? <div style={styles.catalogLoading as CSSN}><span style={styles.loadingSpinner as CSSN}><IconLoadingOutline16 /></span><span>{t('catalogLoading')}</span></div>
                      : (catalogs[s.id] ?? []).length === 0
                        ? <div style={styles.empty as CSSN}>{t('emptyCatalog')}</div>
                        : <div style={styles.grid as CSSN}>{pluginCards(s.id)}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {view.kind === 'detail' && (
        <>
          {(() => {
            const p = (catalogs[view.source] ?? []).find((x) => x.id === view.plugin)
            if (!p) return <div style={styles.empty as CSSN}>{t('emptyCatalog')}</div>
            const on = installedSet(view.source, p.id)
            return (
              <>
                {/* 顶部只保留带边框的返回按钮，插件名称下移到原元信息区域 */}
                <div style={styles.headerRow as CSSN}>
                  <BackButton onClick={() => setView({ kind: 'sources' })} />
                </div>
                <div>
                  <h2 style={{ ...styles.title as CSSN, marginTop: 12 }}>{p.displayName || p.id}</h2>
                  <p style={styles.sub as CSSN}>{p.description}</p>
                </div>
                {/* 一键开启/关闭所有技能 */}
                <div style={styles.allRow as CSSN}>
                  <div>
                    <p style={styles.allLabel as CSSN}>{t('allSkills')}</p>
                    <p style={styles.allCount as CSSN}>{t('enabledPrefix')}{on.size}/{p.skills.length}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on.size === p.skills.length}
                    aria-label={t('allSkills')}
                    disabled={busy}
                    style={{ ...styles.switchBase as CSSN, ...(on.size === p.skills.length ? { background: T.success, borderColor: T.success } : null) }}
                    onClick={() => onToggleAll(p.id, on.size !== p.skills.length)}
                  >
                    <span style={{ ...styles.switchKnob as CSSN, ...(on.size === p.skills.length ? { left: 18 } : null) }} />
                  </button>
                </div>
                {p.skills.map((s) => {
                  const checked = on.has(s.name)
                  return (
                    <div key={s.name} style={styles.skill as CSSN}>
                      <div style={styles.skillText as CSSN}>
                        <p style={styles.skillName as CSSN}>{s.name}</p>
                        {s.description && <p style={styles.skillDesc as CSSN}>{s.description}</p>}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        aria-label={s.name}
                        disabled={busy}
                        style={{ ...styles.switchBase as CSSN, ...(checked ? { background: T.success, borderColor: T.success } : null) }}
                        onClick={() => onToggle(p.id, s.name, !checked)}
                      >
                        <span style={{ ...styles.switchKnob as CSSN, ...(checked ? { left: 18 } : null) }} />
                      </button>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
