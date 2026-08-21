window.__ModuleLoader__.load({ id: 'dsh-skills-marketplace', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/Section.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/remote.ts
var BASE = "/skills-marketplace";
var MarketRemote = class {
  async listSources() {
    const j = await this.getJson(`${BASE}/sources`);
    return j.sources ?? [];
  }
  async addSource(input) {
    const j = await this.postJson(`${BASE}/sources`, input);
    if (!j.ok) throw new Error(j.error || "add failed");
    return j;
  }
  async updateSource(id, input) {
    const j = await this.putJson(`${BASE}/sources/${encodeURIComponent(id)}`, input);
    if (!j.ok) throw new Error(j.error || "update failed");
    return j.source;
  }
  async removeSource(id) {
    const j = await this.delete(`${BASE}/sources/${encodeURIComponent(id)}`);
    if (!j.ok) throw new Error(j.error || "remove failed");
  }
  async catalog(sourceId) {
    const j = await this.getJson(`${BASE}/catalog?source=${encodeURIComponent(sourceId)}`);
    return { plugins: j.plugins ?? [], commit: j.commit ?? null };
  }
  async installed(sourceId) {
    const j = await this.getJson(`${BASE}/installed?source=${encodeURIComponent(sourceId)}`);
    return j.installed ?? [];
  }
  async installPlugin(sourceId, pluginId, skills) {
    const j = await this.postJson(`${BASE}/install`, { sourceId, pluginId, skills });
    if (!j.ok) throw new Error(j.error || "install failed");
  }
  async uninstallPlugin(sourceId, pluginId) {
    const j = await this.postJson(`${BASE}/uninstall`, { sourceId, pluginId });
    if (!j.ok) throw new Error(j.error || "uninstall failed");
  }
  async toggleSkill(sourceId, pluginId, skill, on) {
    const j = await this.postJson(`${BASE}/skill-toggle`, { sourceId, pluginId, skill, on });
    if (!j.ok) throw new Error(j.error || "toggle failed");
  }
  async getJson(path) {
    const r = await fetch(path, { headers: { accept: "application/json" } });
    return this.maybeJson(r);
  }
  async postJson(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return this.maybeJson(r);
  }
  async delete(path) {
    const r = await fetch(path, { method: "DELETE" });
    return this.maybeJson(r);
  }
  async putJson(path, body) {
    const r = await fetch(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return this.maybeJson(r);
  }
  async maybeJson(r) {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: `HTTP ${r.status}: ${text}` };
    }
  }
};

// src/client/Section.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var T = {
  bg1: "var(--dsw-alias-bg-layer-1,#fff)",
  bg2: "var(--dsw-alias-bg-layer-2,#f3f4f6)",
  bg3: "var(--dsw-alias-bg-layer-3,#fafafa)",
  bgPlatform: "var(--dsw-alias-bg-module-platform,#f7f8fa)",
  interactiveHover: "var(--dsw-alias-interactive-bg-hover,rgba(79,110,247,.06))",
  border2: "var(--dsw-alias-border-l2,#e5e7eb)",
  // 更柔和的卡片边框:宿主 token 加透明度,深浅主题都不过亮
  borderSoft: "color-mix(in srgb, var(--dsw-alias-bg-layer-3,#343536) 92%, var(--dsw-alias-label-primary,#fff))",
  l1: "var(--dsw-alias-label-primary,#1f2328)",
  l2: "var(--dsw-alias-label-secondary,#6b7280)",
  l3: "var(--dsw-alias-label-tertiary,#8b93a1)",
  success: "var(--dsw-alias-state-success-primary,#16a34a)",
  error: "var(--dsw-alias-state-error-primary,#dc2626)"
};
var L = {
  myMarkets: "\u63D2\u4EF6\u5E02\u573A",
  none: "\u5C1A\u672A\u6DFB\u52A0\u4EFB\u4F55\u63D2\u4EF6\u5E02\u573A",
  addMarket: "\u6DFB\u52A0\u63D2\u4EF6\u5E02\u573A",
  edit: "\u7F16\u8F91",
  source: "\u6765\u6E90",
  sourceHint: "\u4ED3\u5E93\u5730\u5740 \xB7 org/repo \u6216 https/git \u94FE\u63A5",
  gitRef: "Git \u5F15\u7528",
  gitRefHint: "\u5206\u652F\u3001Tag \u6216 commit",
  sparsePath: "\u7A00\u758F\u8DEF\u5F84",
  sparsePathHint: "\u53EF\u9009\uFF0C\u63D2\u4EF6\u5B50\u76EE\u5F55\uFF0C\u5982 plugins/",
  addBtn: "\u4FDD\u5B58",
  saveBtn: "\u4FDD\u5B58",
  loading: "\u5904\u7406\u4E2D\u2026",
  cancel: "\u53D6\u6D88",
  pluginCatalog: "\u63D2\u4EF6\u5217\u8868",
  collapse: "\u6536\u8D77",
  install: "\u5B89\u88C5",
  removeSource: "\u79FB\u9664",
  emptyCatalog: "\u8BE5\u6765\u6E90\u4E0B\u672A\u53D1\u73B0\u63D2\u4EF6",
  back: "\u8FD4\u56DE",
  catalogLoading: "\u6B63\u5728\u52A0\u8F7D\u63D2\u4EF6\u6E05\u5355",
  allSkills: "\u5168\u90E8\u6280\u80FD",
  enabledPrefix: "\u5DF2\u542F\u7528 ",
  skillCount: "\u6280\u80FD",
  installedCount: "\u5DF2\u5B89\u88C5",
  error: "\u5931\u8D25"
};
var styles = {
  root: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0, fontFamily: "inherit" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 2px 6px" },
  // 二三级页面顶部条:返回按钮居左,标题紧随其后,左对齐
  headerRow: { display: "flex", alignItems: "center", gap: 2, minWidth: 0 },
  title: { fontSize: 17, lineHeight: "24px", fontWeight: 600, margin: 0, color: T.l1 },
  sub: { fontSize: 12, lineHeight: "18px", color: T.l3, margin: 0 },
  tags: { display: "flex", gap: 6, flexWrap: "wrap" },
  sourcePill: { background: T.bg2, color: T.l2, border: "0" },
  // 官方式内联展开卡片(对齐 dsh 内置「插件列表」):市场源卡片 + 卡片内展开插件清单
  capiCard: { background: T.bg3, border: `1px solid ${T.borderSoft}`, borderRadius: 10, overflow: "hidden", marginBottom: 10, transition: "box-shadow .14s ease,border-color .14s ease" },
  capiHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", cursor: "pointer", minHeight: 52, transition: "background .14s ease" },
  capiHeadHover: { background: T.interactiveHover },
  capiHeadLeft: { flex: 1, minWidth: 0 },
  capiName: { fontWeight: 600, fontSize: 14, lineHeight: "20px", color: T.l1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  capiUrl: { fontSize: 11, color: T.l3, fontFamily: "ui-monospace,Menlo,monospace", overflowWrap: "anywhere", margin: "2px 0 6px" },
  capiTrailing: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 150 },
  capiChevron: { display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px", width: 28, height: 28, padding: 0, margin: 0, border: 0, borderRadius: 6, background: "transparent", color: T.l3, cursor: "pointer", appearance: "none" },
  capiChevronIcon: { flex: "none", transition: "transform .16s var(--ds-ease-in-out,ease)" },
  capiChevronOpen: { transform: "rotate(180deg)" },
  capiDetails: { borderTop: `1px solid ${T.borderSoft}`, background: T.bgPlatform, padding: "12px 14px 14px" },
  // CodeX 式添加表单:纵向卡片,每个字段带 label
  addCard: { background: T.bg1, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: T.l2, margin: 0 },
  fieldHelp: { fontSize: 11, color: T.l3, margin: 0 },
  fieldInput: { width: "100%", minWidth: 0 },
  formActions: { display: "flex", gap: 8, marginTop: 4 },
  actionButton: { flexShrink: 0, minWidth: 64, whiteSpace: "nowrap" },
  configAction: { boxSizing: "border-box", minWidth: "auto", height: 32, padding: "0 14px", border: `1px solid ${T.border2}`, borderRadius: 999, background: "transparent", color: T.l1, fontSize: 13, lineHeight: "20px", fontWeight: 400, boxShadow: "none" },
  loadingLabel: { display: "inline-flex", alignItems: "center", gap: 6 },
  loadingSpinner: { display: "inline-flex", flex: "0 0 16px", width: 16, height: 16, animation: "dsh-skills-spin 0.8s linear infinite", transformOrigin: "50% 50%" },
  // 插件网格卡
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: 10 },
  plug: { background: T.bg2, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" },
  plugTitle: { fontWeight: 600, fontSize: 14, lineHeight: "20px", color: T.l1, margin: 0 },
  plugDesc: { fontSize: 12, lineHeight: "18px", color: T.l3, margin: 0, minHeight: 36 },
  plugFoot: { display: "flex", alignItems: "center", gap: 6 },
  badge: { display: "inline-flex", alignItems: "center", height: 18, padding: "0 8px", borderRadius: 9, background: T.bg3, color: T.l2, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" },
  badgeSuccess: { display: "inline-flex", alignItems: "center", height: 18, padding: "0 8px", borderRadius: 9, background: T.success, color: "#fff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" },
  allLabel: { fontWeight: 500, fontSize: 13, color: T.l1, margin: 0 },
  allCount: { fontSize: 12, color: T.l2, margin: 0 },
  // 技能详情行
  skill: { background: T.bg1, border: `1px solid ${T.borderSoft}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  skillText: { flex: 1, minWidth: 0 },
  skillName: { fontWeight: 600, fontSize: 13, lineHeight: "20px", color: T.l1, margin: 0 },
  skillDesc: { fontSize: 12, lineHeight: "18px", color: T.l3, margin: 0 },
  // 全部技能开关行:无底色、无卡片包裹,视觉上是标题行,与下方技能卡区分
  allRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 0 10px", marginBottom: 2, borderBottom: `1px solid ${T.border2}` },
  // 官方 switch(按钮式,38x22)
  switchBase: { position: "relative", width: 38, height: 22, borderRadius: 99, border: `1px solid ${T.border2}`, background: T.bg2, cursor: "pointer", padding: 0, flexShrink: 0, transition: "background .15s ease,border-color .15s ease" },
  switchKnob: { position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: 99, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "left .15s ease" },
  empty: { display: "flex", alignItems: "center", justifyContent: "center", color: T.l2, fontSize: 13, padding: "24px 16px", textAlign: "center", width: "100%", boxSizing: "border-box" },
  catalogLoading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: T.l2, fontSize: 13, padding: 32 },
  err: { color: T.error, fontSize: 12, margin: "8px 0", whiteSpace: "pre-wrap" }
};
function BackButton({ onClick }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick, children: L.back });
}
function SkillMarketSection(props) {
  const remote = props.remote ?? new MarketRemote();
  const [view, setView] = (0, import_react.useState)({ kind: "sources" });
  const [sources, setSources] = (0, import_react.useState)([]);
  const [catalogs, setCatalogs] = (0, import_react.useState)({});
  const [installedBySource, setInstalledBySource] = (0, import_react.useState)({});
  const [adding, setAdding] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [editing, setEditing] = (0, import_react.useState)(null);
  const [removing, setRemoving] = (0, import_react.useState)(null);
  const [expandedSource, setExpandedSource] = (0, import_react.useState)(null);
  const [hoveredSource, setHoveredSource] = (0, import_react.useState)(null);
  const [catalogLoading, setCatalogLoading] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [form, setForm] = (0, import_react.useState)({ url: "", ref: "", sparsePath: "" });
  const loadSources = (0, import_react.useCallback)(async () => {
    try {
      const s = await remote.listSources();
      setSources(s);
      if (s.length === 0) setView((v) => v.kind === "sources" ? { kind: "sources" } : v);
    } catch (e) {
      setError(String(e.message));
    }
  }, [remote]);
  const loadInstalled = (0, import_react.useCallback)(async (sid) => {
    try {
      const installed = await remote.installed(sid);
      setInstalledBySource((current) => ({ ...current, [sid]: installed }));
    } catch {
    }
  }, [remote]);
  (0, import_react.useEffect)(() => {
    void loadSources();
  }, [loadSources]);
  const openCatalog = (0, import_react.useCallback)(async (sid, forceOpen = false) => {
    const cached = catalogs[sid];
    setError("");
    if (expandedSource === sid && !forceOpen) {
      setExpandedSource(null);
      return;
    }
    setExpandedSource(sid);
    setView({ kind: "sources" });
    if (!cached) setCatalogLoading(sid);
    try {
      const c = await remote.catalog(sid);
      setCatalogs((current) => ({ ...current, [sid]: c.plugins }));
      void loadInstalled(sid);
    } catch (e) {
      if (!cached) setError(String(e.message));
    } finally {
      setCatalogLoading((current) => current === sid ? null : current);
    }
  }, [remote, loadInstalled, catalogs, expandedSource]);
  const openDetail = (0, import_react.useCallback)(async (sid, pluginId) => {
    setView({ kind: "detail", source: sid, plugin: pluginId });
    void loadInstalled(sid);
  }, [loadInstalled]);
  const addSource = async () => {
    if (!form.url.trim()) return;
    setBusy(true);
    setError("");
    try {
      let added;
      if (editing) added = await remote.updateSource(editing, { url: form.url.trim(), ref: form.ref.trim() || void 0, sparsePath: form.sparsePath.trim() });
      else added = (await remote.addSource({ url: form.url.trim(), ref: form.ref.trim() || void 0, sparsePath: form.sparsePath.trim() })).source;
      setForm({ url: "", ref: "", sparsePath: "" });
      setEditing(null);
      setAdding(false);
      await loadSources();
      if (added) await openCatalog(added.id, true);
    } catch (e) {
      setError(String(e.message));
    } finally {
      setBusy(false);
    }
  };
  const editSource = (s) => {
    setForm({ url: s.url, ref: s.ref, sparsePath: s.sparsePath });
    setEditing(s.id);
    setAdding(true);
    setError("");
  };
  const removeSource = async (id) => {
    setRemoving(id);
    setError("");
    try {
      await remote.removeSource(id);
      setCatalogs((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setInstalledBySource((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setExpandedSource((current) => current === id ? null : current);
      await loadSources();
    } catch (e) {
      setError(String(e.message));
    } finally {
      setRemoving(null);
    }
  };
  const optimisticPatch = (0, import_react.useCallback)((sid, pluginId, fn) => {
    setInstalledBySource((current) => ({ ...current, [sid]: fn(current[sid] ?? []) }));
  }, []);
  const onToggle = (0, import_react.useCallback)((pluginId, skill, on) => {
    if (view.kind !== "detail") return;
    const sid = view.source;
    optimisticPatch(sid, pluginId, (cur) => {
      const idx = cur.findIndex((p) => p.pluginId === pluginId && p.sourceId === sid);
      if (on) {
        if (idx === -1) {
          return [...cur, { pluginId, sourceId: sid, displayName: pluginId, description: "", skills: [skill], commit: null, installedAt: (/* @__PURE__ */ new Date()).toISOString() }];
        }
        const next2 = [...cur];
        next2[idx] = { ...next2[idx], skills: Array.from(/* @__PURE__ */ new Set([...next2[idx].skills, skill])) };
        return next2;
      }
      if (idx === -1) return cur;
      const rest = cur[idx].skills.filter((s) => s !== skill);
      const next = [...cur];
      if (rest.length === 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], skills: rest };
      return next;
    });
    void (async () => {
      try {
        if (on) await remote.installPlugin(sid, pluginId, [skill]);
        else await remote.toggleSkill(sid, pluginId, skill, false);
      } catch (e) {
        setError(String(e.message));
      }
      void loadInstalled(sid);
    })();
  }, [view, remote, optimisticPatch, loadInstalled]);
  const onToggleAll = (0, import_react.useCallback)((pluginId, on) => {
    if (view.kind !== "detail") return;
    const sid = view.source;
    const p = catalogs[sid]?.find((x) => x.id === pluginId);
    if (!p || p.skills.length === 0) return;
    const allNames = p.skills.map((s) => s.name);
    optimisticPatch(sid, pluginId, (cur) => {
      const idx = cur.findIndex((x) => x.pluginId === pluginId && x.sourceId === sid);
      if (on) {
        if (idx === -1) {
          return [...cur, { pluginId, sourceId: sid, displayName: pluginId, description: "", skills: allNames, commit: null, installedAt: (/* @__PURE__ */ new Date()).toISOString() }];
        }
        const next2 = [...cur];
        next2[idx] = { ...next2[idx], skills: Array.from(/* @__PURE__ */ new Set([...next2[idx].skills, ...allNames])) };
        return next2;
      }
      if (idx === -1) return cur;
      const next = [...cur];
      next.splice(idx, 1);
      return next;
    });
    void (async () => {
      try {
        if (on) await remote.installPlugin(sid, pluginId, allNames);
        else await remote.uninstallPlugin(sid, pluginId);
      } catch (e) {
        setError(String(e.message));
      }
      void loadInstalled(sid);
    })();
  }, [view, remote, optimisticPatch, loadInstalled, catalogs]);
  const installedSet = (sid, pluginId) => {
    const p = installedBySource[sid]?.find((x) => x.pluginId === pluginId);
    return new Set(p?.skills ?? []);
  };
  const t = (k) => L[k] ?? k;
  const sourceName = (source) => {
    const clean = source.url.replace(/\.git$/, "").replace(/\/$/, "");
    return clean.split(/[/:]/).filter(Boolean).pop() || source.id;
  };
  const pluginCards = (sid) => (catalogs[sid] ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.plug, onClick: () => openDetail(sid, p.id), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.plugTitle, children: p.displayName || p.id }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.plugDesc, children: p.description }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.plugFoot, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: styles.badge, children: [
        p.skills.length,
        " ",
        t("skillCount")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: installedSet(sid, p.id).size > 0 ? styles.badgeSuccess : styles.badge, children: [
        installedSet(sid, p.id).size,
        " ",
        t("installedCount")
      ] })
    ] })
  ] }, p.id));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: "@keyframes dsh-skills-spin{to{transform:rotate(360deg)}}" }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.err, children: [
      t("error"),
      ": ",
      error
    ] }),
    view.kind === "sources" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.head, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: styles.title, children: t("myMarkets") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", style: styles.configAction, onClick: () => {
          setAdding(!adding);
          setEditing(null);
          setForm({ url: "", ref: "", sparsePath: "" });
        }, children: t("addMarket") })
      ] }),
      adding && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.addCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.fieldLabel, children: t("source") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Input,
            {
              style: styles.fieldInput,
              placeholder: "org/repo \u6216 git@github.com:org/repo.git",
              value: form.url,
              onChange: (e) => setForm({ ...form, url: e.target.value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.fieldHelp, children: t("sourceHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...styles.field, flex: 1, minWidth: 140 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.fieldLabel, children: t("gitRef") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { style: styles.fieldInput, placeholder: "\u7559\u7A7A\u5219\u81EA\u52A8\u68C0\u6D4B", value: form.ref, onChange: (e) => setForm({ ...form, ref: e.target.value }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.fieldHelp, children: t("gitRefHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...styles.field, flex: 1.2, minWidth: 160 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: styles.fieldLabel, children: t("sparsePath") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { style: styles.fieldInput, placeholder: "plugins", value: form.sparsePath, onChange: (e) => setForm({ ...form, sparsePath: e.target.value }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.fieldHelp, children: t("sparsePathHint") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.formActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", style: styles.configAction, onClick: addSource, disabled: busy, children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: styles.loadingLabel, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.loadingSpinner, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconLoadingOutline16, {}) }),
            "\u4FDD\u5B58"
          ] }) : editing ? t("saveBtn") : t("addBtn") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "md", style: styles.actionButton, onClick: () => {
            setAdding(false);
            setEditing(null);
            setForm({ url: "", ref: "", sparsePath: "" });
          }, children: t("cancel") })
        ] })
      ] }),
      sources.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.empty, children: t("none") }) : sources.map((s) => {
        const open = expandedSource === s.id;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: styles.capiCard,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: { ...styles.capiHead, ...hoveredSource === s.id ? styles.capiHeadHover : null },
                  role: "button",
                  "aria-expanded": open,
                  tabIndex: 0,
                  onClick: () => openCatalog(s.id),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openCatalog(s.id);
                    }
                  },
                  onMouseEnter: () => setHoveredSource(s.id),
                  onMouseLeave: () => setHoveredSource(null),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.capiHeadLeft, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.capiName, children: sourceName(s) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.capiUrl, children: s.url }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.tags, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_dsh_client_ui_primitives.Pill, { style: styles.sourcePill, children: [
                          "ref ",
                          s.ref
                        ] }),
                        s.sparsePath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Pill, { style: styles.sourcePill, children: s.sparsePath })
                      ] })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.capiTrailing, onClick: (e) => e.stopPropagation(), children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", style: styles.actionButton, onClick: () => editSource(s), children: t("edit") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", style: styles.actionButton, disabled: removing === s.id, onClick: () => removeSource(s.id), children: removing === s.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: styles.loadingLabel, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.loadingSpinner, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconLoadingOutline16, {}) }),
                        t("removeSource")
                      ] }) : t("removeSource") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          type: "button",
                          "aria-label": open ? t("collapse") : t("pluginCatalog"),
                          style: styles.capiChevron,
                          onClick: (e) => {
                            e.stopPropagation();
                            void openCatalog(s.id);
                          },
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutline14, { style: { ...styles.capiChevronIcon, ...open ? styles.capiChevronOpen : null } })
                        }
                      )
                    ] })
                  ]
                }
              ),
              open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.capiDetails, children: catalogLoading === s.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.catalogLoading, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.loadingSpinner, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconLoadingOutline16, {}) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("catalogLoading") })
              ] }) : (catalogs[s.id] ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.empty, children: t("emptyCatalog") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.grid, children: pluginCards(s.id) }) })
            ]
          },
          s.id
        );
      })
    ] }),
    view.kind === "detail" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: (() => {
      const p = (catalogs[view.source] ?? []).find((x) => x.id === view.plugin);
      if (!p) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.empty, children: t("emptyCatalog") });
      const on = installedSet(view.source, p.id);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.headerRow, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackButton, { onClick: () => setView({ kind: "sources" }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { ...styles.title, marginTop: 12 }, children: p.displayName || p.id }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.sub, children: p.description })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.allRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.allLabel, children: t("allSkills") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: styles.allCount, children: [
              t("enabledPrefix"),
              on.size,
              "/",
              p.skills.length
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              role: "switch",
              "aria-checked": on.size === p.skills.length,
              "aria-label": t("allSkills"),
              disabled: busy,
              style: { ...styles.switchBase, ...on.size === p.skills.length ? { background: T.success, borderColor: T.success } : null },
              onClick: () => onToggleAll(p.id, on.size !== p.skills.length),
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...styles.switchKnob, ...on.size === p.skills.length ? { left: 18 } : null } })
            }
          )
        ] }),
        p.skills.map((s) => {
          const checked = on.has(s.name);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.skill, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.skillText, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.skillName, children: s.name }),
              s.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.skillDesc, children: s.description })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                role: "switch",
                "aria-checked": checked,
                "aria-label": s.name,
                disabled: busy,
                style: { ...styles.switchBase, ...checked ? { background: T.success, borderColor: T.success } : null },
                onClick: () => onToggle(p.id, s.name, !checked),
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...styles.switchKnob, ...checked ? { left: 18 } : null } })
              }
            )
          ] }, s.name);
        })
      ] });
    })() })
  ] });
}

// src/client/index.ts
function apply(ctx) {
  ctx.locale?.register("dsh-skills-marketplace", {
    zh: { nav: "Skill \u63D2\u4EF6\u5E02\u573A" },
    en: { nav: "Skills Marketplace" }
  });
  const slots = ctx.slots;
  if (!slots) {
    console.warn("[dsh-skills-marketplace] slots unavailable; settings section not registered");
    return;
  }
  const section = SkillMarketSection;
  slots.inject(
    "settings.section",
    () => slots.register(
      {
        name: "settings.section",
        id: "skills-marketplace",
        order: 60,
        label: () => "Skill \u63D2\u4EF6\u5E02\u573A",
        inject: () => ({ hooks: {} })
      },
      section
    )
  );
}
var inject = ["slots", "locale"];
return module.exports; } });
//# sourceMappingURL=client.js.map
