// src/manifest.ts
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
function defaultDshHome() {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? ".", ".dsh");
}
var Manifest = class {
  dshHome;
  state;
  constructor(dshHome = defaultDshHome()) {
    this.dshHome = dshHome;
    this.state = this.load();
  }
  stateFile() {
    return join(this.dshHome, "markets.json");
  }
  load() {
    const empty = { version: 1, sources: [], installed: [], removed: [] };
    const f = this.stateFile();
    if (existsSync(f)) {
      try {
        const raw = JSON.parse(readFileSync(f, "utf8"));
        return {
          version: 1,
          sources: Array.isArray(raw.sources) ? raw.sources : [],
          installed: Array.isArray(raw.installed) ? raw.installed : [],
          removed: Array.isArray(raw.removed) ? raw.removed : []
        };
      } catch {
      }
    }
    return empty;
  }
  persist() {
    mkdirSync(this.dshHome, { recursive: true });
    writeFileSync(this.stateFile(), JSON.stringify(this.state, null, 2));
  }
  // ---- sources ----
  listSources() {
    return [...this.state.sources];
  }
  getSource(id) {
    return this.state.sources.find((s) => s.id === id);
  }
  addSource(src) {
    const full = { ...src, addedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.state.sources = this.state.sources.filter((s) => s.id !== full.id);
    this.state.sources.push(full);
    this.persist();
    return full;
  }
  removeSource(id) {
    this.state.sources = this.state.sources.filter((s) => s.id !== id);
    this.persist();
  }
  /** 更新来源配置但保持 id 与已安装技能的来源关联不变。 */
  updateSource(id, patch) {
    const index = this.state.sources.findIndex((s) => s.id === id);
    if (index === -1) return void 0;
    const source = { ...this.state.sources[index], ...patch, id };
    this.state.sources[index] = source;
    this.persist();
    return source;
  }
  // ---- installed ----
  listInstalled() {
    return [...this.state.installed];
  }
  listInstalledBySource(sourceId) {
    return this.state.installed.filter((p) => p.sourceId === sourceId);
  }
  /** 记录一个已安装插件(含其技能、来源 commit)。 */
  recordInstalled(p) {
    this.state.installed = this.state.installed.filter((x) => x.pluginId !== p.pluginId || x.sourceId !== p.sourceId);
    this.state.installed.push(p);
    this.persist();
  }
  /** 从清单剔除一个插件(卸载)。返回被剔除项,并把其技能记入墓碑,供后续安全清理。 */
  removeInstalled(pluginId, sourceId) {
    const i = this.state.installed.findIndex((x) => x.pluginId === pluginId && x.sourceId === sourceId);
    if (i === -1) return void 0;
    const [removed] = this.state.installed.splice(i, 1);
    for (const name2 of removed.skills) this.tombstone(name2);
    this.persist();
    return removed;
  }
  /** 记录一个技能名到墓碑(已由本管理器安装过、现已失效)。 */
  tombstone(name2) {
    if (!this.state.removed.includes(name2)) this.state.removed.push(name2);
  }
  /** 安装成功后从墓碑清除(技能再次受管)。 */
  clearTombstone(name2) {
    this.state.removed = this.state.removed.filter((n) => n !== name2);
  }
  /** 同名技能仍由另一个插件或来源托管时，不应删除其落盘目录。 */
  isManagedElsewhere(name2, sourceId, pluginId) {
    return this.state.installed.some(
      (p) => (p.sourceId !== sourceId || p.pluginId !== pluginId) && p.skills.includes(name2)
    );
  }
  /**
   * 返回可安全清理的孤立技能:曾由本管理器安装(在墓碑里)但当前不再受管、
   * 且仍残留在 skills 根的目录。绝不触碰用户自建或从未受管的技能。
   */
  orphanSkills() {
    const managed = new Set(this.state.installed.flatMap((p) => p.skills));
    const dest = join(this.dshHome, "skills");
    if (!existsSync(dest)) return [];
    return this.state.removed.filter((n) => !managed.has(n)).filter((n) => !n.startsWith(".")).filter((n) => existsSync(join(dest, n)) && statSync(join(dest, n)).isDirectory());
  }
  /** 清理后从墓碑移除(技能目录已删除)。 */
  clearTombstones(names) {
    const set = new Set(names);
    this.state.removed = this.state.removed.filter((n) => !set.has(n));
    this.persist();
  }
};
function copySkillBundle(srcDir, destRoot, name2) {
  const dest = join(destRoot, name2);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(destRoot, { recursive: true });
  copyRecursive(srcDir, dest);
}
function copyRecursive(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const s = join(from, entry);
    const t = join(to, entry);
    if (entry === "agents") {
      const hasOther = readdirSync(s).some((n) => n !== "openai.yaml");
      if (!hasOther) continue;
      copyRecursiveFiltered(s, t, (n) => n !== "openai.yaml");
      continue;
    }
    if (statSync(s).isDirectory()) {
      copyRecursive(s, t);
    } else {
      copyFileSync(s, t);
    }
  }
}
function copyRecursiveFiltered(from, to, skip) {
  for (const entry of readdirSync(from)) {
    if (skip(entry)) continue;
    const s = join(from, entry);
    const t = join(to, entry);
    if (statSync(s).isDirectory()) {
      copyRecursiveFiltered(s, t, skip);
    } else {
      mkdirSync(to, { recursive: true });
      copyFileSync(s, t);
    }
  }
}

// src/sync.ts
import { join as join2 } from "node:path";
import { rmSync as rmSync2, existsSync as existsSync2 } from "node:fs";
var SyncEngine = class {
  constructor(manifest) {
    this.manifest = manifest;
  }
  get skillsRoot() {
    return join2(this.manifest.dshHome, "skills");
  }
  /**
   * 安装一个插件及其技能到 ~/.dsh/skills。
   * @param sourceId   所属市场来源 id
   * @param plugin     解析出的插件
   * @param onlySkills 可选:只装其中某些技能(对应 GUI 技能开关 '开')
   */
  installPlugin(sourceId, plugin, onlySkills) {
    const res = { installed: [], skipped: [], errors: [] };
    const target = new Set(onlySkills ?? plugin.skills.map((s) => s.name));
    const previous = this.manifest.listInstalled().find((p) => p.pluginId === plugin.id && p.sourceId === sourceId);
    for (const skill of plugin.skills) {
      if (!target.has(skill.name)) continue;
      try {
        copySkillBundle(skill.dir, this.skillsRoot, skill.name);
        this.manifest.clearTombstone(skill.name);
        res.installed.push(skill.name);
      } catch (e) {
        res.errors.push(`${skill.name}: ${e.message}`);
      }
    }
    const available = new Set(plugin.skills.map((skill) => skill.name));
    const retained = previous?.skills.filter((name2) => available.has(name2)) ?? [];
    for (const name2 of previous?.skills ?? []) {
      if (!available.has(name2)) this.manifest.tombstone(name2);
    }
    this.manifest.recordInstalled({
      pluginId: plugin.id,
      sourceId,
      displayName: plugin.displayName,
      description: plugin.description,
      category: plugin.category,
      skills: Array.from(/* @__PURE__ */ new Set([...retained, ...res.installed])),
      commit: null,
      // caller 可在 resolve 后回填
      installedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res;
  }
  /** 回填 commit(git HEAD),便于"更新"比对。 */
  setCommit(sourceId, pluginId, commit) {
    const cur = this.manifest.listInstalled().find((p) => p.pluginId === pluginId && p.sourceId === sourceId);
    if (cur) {
      this.manifest.recordInstalled({ ...cur, commit });
    }
  }
  /**
   * 卸载插件:删除其受管技能目录 + 从清单剔除。
   * 严格按清单删,绝不整目录删除。
   */
  uninstallPlugin(sourceId, pluginId) {
    const p = this.manifest.listInstalled().find((x) => x.pluginId === pluginId && x.sourceId === sourceId);
    const removed = [];
    if (p) {
      for (const name2 of p.skills) {
        const d = join2(this.skillsRoot, name2);
        if (existsSync2(d) && !this.manifest.isManagedElsewhere(name2, sourceId, pluginId)) {
          rmSync2(d, { recursive: true, force: true });
          removed.push(name2);
        }
      }
      this.manifest.removeInstalled(pluginId, sourceId);
    }
    return { removed };
  }
  /**
   * 卸载单个技能(对应 GUI 技能开关 '关')。
   * 从该插件已装集合剔除;若集合清空则整插件从清单移除。
   */
  uninstallSkill(sourceId, pluginId, skill) {
    const p = this.manifest.listInstalled().find((x) => x.pluginId === pluginId && x.sourceId === sourceId);
    if (!p) return { removed: false };
    if (!p.skills.includes(skill)) return { removed: false };
    const d = join2(this.skillsRoot, skill);
    if (existsSync2(d) && !this.manifest.isManagedElsewhere(skill, sourceId, pluginId)) rmSync2(d, { recursive: true, force: true });
    const rest = p.skills.filter((n) => n !== skill);
    if (rest.length === 0) {
      this.manifest.removeInstalled(pluginId, sourceId);
    } else {
      this.manifest.recordInstalled({ ...p, skills: rest });
      this.manifest.tombstone(skill);
    }
    return { removed: true };
  }
  /**
   * 移除孤立技能:曾由本管理器安装(在墓碑)、当前不再受管、且残留在 skills 根的目录。
   * 绝不触碰用户自建/从未受管的技能。幂等,可安全在每次 boot/update 后调用。
   */
  pruneOrphans() {
    const removed = [];
    const gone = [];
    for (const name2 of this.manifest.orphanSkills()) {
      const d = join2(this.skillsRoot, name2);
      if (existsSync2(d)) {
        rmSync2(d, { recursive: true, force: true });
        removed.push(name2);
        gone.push(name2);
      }
    }
    this.manifest.clearTombstones(gone);
    return removed;
  }
  /** 返回当前 GUI 展示所需的"插件维度"聚合视图(从 manifest 还原)。 */
  pluginView(sourceId) {
    return this.manifest.listInstalledBySource(sourceId);
  }
};

// src/http.ts
function sendJson(response, status, payload) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}
function sameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin === void 0 || host === void 0) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
async function readJsonBody(request, maxBytes = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// src/remote.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync as mkdirSync2, existsSync as existsSync3, readFileSync as readFileSync2, readdirSync as readdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3, basename as basename2 } from "node:path";
function runGit(cwd, args) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 3e4,
    killSignal: "SIGTERM",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
  });
  const err = r.error?.message ?? r.stderr ?? "";
  return { ok: r.status === 0, out: r.stdout ?? "", err };
}
function sourceIdFor(url) {
  const clean = url.replace(/\.git$/, "").replace(/\/$/, "");
  const last = clean.split(/[/:]/).filter(Boolean).pop() ?? "market";
  const slug = last.replace(/[^a-zA-Z0-9_-]/g, "-") || "market";
  return `${slug}-${createHash("sha256").update(clean).digest("hex").slice(0, 10)}`;
}
function cacheDirFor(sourceId) {
  const home = process.env.DSH_HOME ?? join3(process.env.HOME ?? ".", ".dsh");
  return join3(home, "markets-cache", sourceId);
}
function defaultBranch(url) {
  const r = spawnSync("git", ["ls-remote", "--symref", url, "HEAD"], { encoding: "utf8", timeout: 3e4, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const m = /HEAD\s+ref:\s+refs\/heads\/([^\s]+)/.exec(r.stdout ?? "");
  return m ? m[1] : "master";
}
function cloneMarket(src) {
  const id = src.id ?? sourceIdFor(src.url);
  const cacheDir = join3(process.env.DSH_HOME ?? join3(process.env.HOME ?? ".", ".dsh"), "markets-cache", id);
  mkdirSync2(cacheDir, { recursive: true });
  const ref = src.ref.trim() || defaultBranch(src.url);
  const sparsePath = src.sparsePath.trim();
  const sparse = sparsePath || ".";
  const hasOrigin = runGit(cacheDir, ["remote"]).out.includes("origin");
  if (!hasOrigin) {
    let r2 = runGit(cacheDir, ["init", "-q"]);
    if (!r2.ok) throw new Error(`git init failed: ${r2.err}`);
    r2 = runGit(cacheDir, ["remote", "add", "origin", src.url]);
    if (!r2.ok) throw new Error(`git remote add failed: ${r2.err}`);
  } else {
    const origin = runGit(cacheDir, ["remote", "get-url", "origin"]);
    if (!origin.ok) throw new Error(`git remote get-url failed: ${origin.err}`);
    if (origin.out.trim() !== src.url) {
      const r2 = runGit(cacheDir, ["remote", "set-url", "origin", src.url]);
      if (!r2.ok) throw new Error(`git remote set-url failed: ${r2.err}`);
    }
  }
  let r = runGit(cacheDir, hasOrigin ? ["fetch", "--depth=1", "origin", ref] : ["fetch", "--filter=blob:none", "--depth=1", "origin", ref]);
  if (!r.ok) throw new Error(`git fetch failed: ${r.err}`);
  if (sparsePath) {
    r = runGit(cacheDir, ["sparse-checkout", "init", "--cone"]);
    if (!r.ok) throw new Error(`sparse-checkout init failed: ${r.err}`);
    r = runGit(cacheDir, ["sparse-checkout", "set", sparse]);
    if (!r.ok) throw new Error(`sparse-checkout set ${sparse} failed: ${r.err}`);
  } else {
    r = runGit(cacheDir, ["sparse-checkout", "disable"]);
    if (!r.ok) throw new Error(`sparse-checkout disable failed: ${r.err}`);
  }
  r = runGit(cacheDir, ["checkout", ref]);
  if (!r.ok) throw new Error(`git checkout ${ref} failed: ${r.err}`);
  return { id, cacheDir };
}
function resolveMarket(cacheDir, sparsePath) {
  const explicitFile = join3(cacheDir, sparsePath, "dsh.market.json");
  const fsTryExplicit = tryReadJson(explicitFile);
  if (fsTryExplicit) {
    return resolveExplicit(fsTryExplicit, cacheDir);
  }
  return resolveConvention(cacheDir, sparsePath);
}
function tryReadJson(p) {
  try {
    return JSON.parse(readFileSync2(p, "utf8"));
  } catch {
    return null;
  }
}
function resolveExplicit(markets, cacheDir) {
  const plugins = [];
  for (const p of markets.plugins ?? []) {
    const skillRoot = join3(cacheDir, p.skills ?? "");
    const skills = collectSkillBundles(skillRoot, p.id);
    plugins.push({
      id: p.id,
      displayName: p.displayName ?? p.id,
      description: p.description ?? "",
      category: p.category,
      skills
    });
  }
  return { plugins, commit: headCommit(cacheDir) };
}
function resolveConvention(cacheDir, sparsePath) {
  const root = join3(cacheDir, sparsePath);
  const plugins = [];
  if (isPluginDir(root)) {
    const p = pluginFromDir(root);
    if (p && p.skills.length) plugins.push(p);
    return { plugins, commit: headCommit(cacheDir) };
  }
  const seen = /* @__PURE__ */ new Set();
  for (const pd of listDirs(root)) {
    const p = pluginFromDir(pd);
    if (p && p.skills.length) {
      plugins.push(p);
      seen.add(p.id);
    }
  }
  for (const p of collectNestedPlugins(root)) {
    if (!seen.has(p.id)) {
      plugins.push(p);
      seen.add(p.id);
    }
  }
  return { plugins, commit: headCommit(cacheDir) };
}
function collectNestedPlugins(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const child of listDirs(cur)) {
      if (isPluginDir(child)) {
        const p = pluginFromDir(child);
        if (p && p.skills.length) out.push(p);
      } else {
        stack.push(child);
      }
    }
  }
  return out;
}
function isPluginDir(dir) {
  return existsSync3(join3(dir, "skills"));
}
function pluginFromDir(pd) {
  const skillsDir = join3(pd, "skills");
  if (!existsSync3(skillsDir)) return null;
  const pid = basename2(pd);
  const skills = collectSkillBundles(skillsDir, pid);
  if (skills.length === 0) return null;
  const meta = pluginMeta(pd);
  return {
    id: pid,
    displayName: meta.displayName ?? pid,
    description: meta.description ?? "",
    category: meta.category,
    skills
  };
}
function pluginMeta(pd) {
  const codex = tryReadJson(join3(pd, ".codex-plugin", "plugin.json"));
  if (codex) {
    const itf = codex.interface;
    return {
      displayName: itf?.displayName ?? codex.name,
      description: itf?.shortDescription ?? codex.description,
      category: itf?.category
    };
  }
  const flat = tryReadJson(join3(pd, "plugin.json"));
  if (flat) {
    return {
      displayName: flat.displayName ?? flat.name,
      description: flat.description,
      category: flat.category
    };
  }
  const claude = tryReadJson(join3(pd, "..", ".claude-plugin", "marketplace.json"));
  if (claude && Array.isArray(claude.plugins)) {
    const match = claude.plugins.find((x) => basename2(String(x?.source ?? "").replace(/^\.?\//, "")) === basename2(pd));
    if (match) return { description: match.description, category: match.category };
  }
  return {};
}
function collectSkillBundles(root, pluginId) {
  const out = [];
  for (const skillDir of listDirs(root)) {
    const skillMd = join3(skillDir, "SKILL.md");
    if (exists(skillMd)) {
      out.push({
        name: basename2(skillDir),
        pluginId,
        dir: skillDir,
        description: frontmatterDescription(skillMd)
      });
    }
  }
  return out;
}
function frontmatterDescription(skillMd) {
  try {
    const txt = readFileSync2(skillMd, "utf8");
    const m = /^---\n([\s\S]*?)\n---/.exec(txt);
    const fm = m ? m[1] : "";
    const dm = /^description\s*:\s*(.+)$/m.exec(fm);
    return dm ? dm[1].trim().replace(/^["']|["']$/g, "") : void 0;
  } catch {
    return void 0;
  }
}
function listDirs(root) {
  if (!existsSync3(root)) return [];
  return readdirSync2(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => join3(root, d.name));
}
function exists(p) {
  return existsSync3(p);
}
function headCommit(cacheDir) {
  const r = runGit(cacheDir, ["rev-parse", "HEAD"]);
  return r.ok && r.out.trim() ? r.out.trim() : null;
}
function fetchAndResolve(url, ref, sparsePath, sourceId) {
  const resolvedRef = ref?.trim() || defaultBranch(url);
  const src = { id: sourceId, url, ref: resolvedRef, sparsePath: sparsePath?.trim() ?? "" };
  const { cacheDir } = cloneMarket(src);
  const market = resolveMarket(cacheDir, src.sparsePath);
  return { id: src.id ?? sourceIdFor(url), ref: resolvedRef, cacheDir, market };
}
function resolveMarketCached(sourceId, cacheDir, sparsePath) {
  const cacheFile = join3(cacheDir, ".catalog.json");
  const disk = tryReadJson(cacheFile);
  let head = null;
  let resolved = null;
  if (disk && disk.commit && exists(cacheDir)) {
    head = headCommit(cacheDir);
    if (head === disk.commit) {
      resolved = { plugins: disk.plugins ?? [], commit: head };
    }
  }
  if (resolved) {
    return { market: resolved, fromCache: true, commit: head };
  }
  const fresh = resolveMarket(cacheDir, sparsePath);
  try {
    writeFileSync2(cacheFile, JSON.stringify({ commit: fresh.commit, plugins: fresh.plugins }, null, 2));
  } catch {
  }
  return { market: fresh, fromCache: false, commit: fresh.commit };
}

// src/routes.ts
function parseJson(request) {
  return readJsonBody(request);
}
function mountSkillsMarketplaceRoutes(webServer, ctx) {
  const disposers = [];
  const mount = (kind, path, handler) => {
    disposers.push(webServer.register({ kind, path, handler }));
  };
  const fresh = () => {
    const m = ctx.newManifest();
    return { m, engine: ctx.newEngine(m) };
  };
  mount("prefix", "/skills-marketplace/sources", async (req, res) => {
    const pathname = (req.url ?? "").split("?")[0];
    const idMatch = pathname.match(/^\/skills-marketplace\/sources\/([^/]+)$/);
    const method = req.method ?? "";
    if (!idMatch) {
      if (pathname !== "/skills-marketplace/sources") return sendJson(res, 404, { ok: false, error: "not found" });
      if (method === "GET") {
        const { m: m2 } = fresh();
        return sendJson(res, 200, { ok: true, sources: m2.listSources() });
      }
      if (method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
      if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
      try {
        const body = await parseJson(req);
        if (!body?.url?.trim()) return sendJson(res, 400, { ok: false, error: "url required" });
        const { id: id2, ref, market } = await fetchAndResolve(body.url.trim(), body.ref, body.sparsePath);
        const { m: m2 } = fresh();
        const src = {
          id: id2,
          url: body.url.trim(),
          ref,
          sparsePath: body.sparsePath?.trim() ?? "",
          addedAt: (/* @__PURE__ */ new Date()).toISOString(),
          cacheDir: ""
        };
        m2.addSource(src);
        return sendJson(res, 201, {
          ok: true,
          source: src,
          pluginCount: market.plugins.length,
          skillCount: market.plugins.reduce((a, p) => a + p.skills.length, 0)
        });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    }
    const id = decodeURIComponent(idMatch[1]);
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    if (method === "PUT") {
      try {
        const body = await parseJson(req);
        if (!body?.url?.trim()) return sendJson(res, 400, { ok: false, error: "url required" });
        const url = body.url.trim();
        const { m: m2 } = fresh();
        if (!m2.getSource(id)) return sendJson(res, 404, { ok: false, error: "unknown source" });
        if (m2.listSources().some((source2) => source2.id !== id && source2.url === url)) return sendJson(res, 409, { ok: false, error: "source already exists" });
        const { ref, market } = await fetchAndResolve(url, body.ref, body.sparsePath?.trim() ?? "", id);
        const source = m2.updateSource(id, { url, ref, sparsePath: body.sparsePath?.trim() ?? "" });
        return sendJson(res, 200, { ok: true, source, pluginCount: market.plugins.length });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    }
    if (method !== "DELETE") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const { m } = fresh();
    m.removeSource(id);
    return sendJson(res, 200, { ok: true, id });
  });
  mount("exact", "/skills-marketplace/catalog", async (req, res) => {
    const u = new URL(req.url ?? "", "http://local");
    const sourceId = u.searchParams.get("source") ?? "";
    const { m } = fresh();
    const src = m.getSource(sourceId);
    if (!src) return sendJson(res, 404, { ok: false, error: "unknown source" });
    try {
      const cacheDir = cacheDirFor(sourceId);
      const { market, fromCache } = resolveMarketCached(sourceId, cacheDir, src.sparsePath);
      if (market.plugins.length === 0) {
        const local = resolveMarket(cacheDir, src.sparsePath);
        if (local.plugins.length > 0) {
          return sendJson(res, 200, { ok: true, sourceId, plugins: local.plugins, commit: local.commit, cached: false });
        }
        const fresh2 = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id);
        return sendJson(res, 200, { ok: true, sourceId, plugins: fresh2.market.plugins, commit: fresh2.market.commit, cached: false });
      }
      return sendJson(res, 200, {
        ok: true,
        sourceId,
        plugins: market.plugins,
        commit: market.commit,
        cached: fromCache
      });
    } catch (e) {
      try {
        const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id);
        return sendJson(res, 200, { ok: true, sourceId, plugins: market.plugins, commit: market.commit, cached: false });
      } catch (e2) {
        return sendJson(res, 500, { ok: false, error: e2.message });
      }
    }
  });
  mount("exact", "/skills-marketplace/installed", async (req, res) => {
    const u = new URL(req.url ?? "", "http://local");
    const sourceId = u.searchParams.get("source") ?? "";
    const { m } = fresh();
    const installed = sourceId ? m.listInstalledBySource(sourceId) : m.listInstalled();
    return sendJson(res, 200, { ok: true, installed });
  });
  mount("exact", "/skills-marketplace/install", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    try {
      const body = await parseJson(req);
      const { m, engine } = fresh();
      const src = m.getSource(body.sourceId);
      if (!src) return sendJson(res, 404, { ok: false, error: "unknown source" });
      const cached = resolveMarketCached(body.sourceId, cacheDirFor(body.sourceId), src.sparsePath).market;
      const local = cached.plugins.length ? cached : resolveMarket(cacheDirFor(body.sourceId), src.sparsePath);
      const market = local.plugins.length ? local : cached;
      const plugin = market.plugins.find((p) => p.id === body.pluginId);
      if (!plugin) return sendJson(res, 404, { ok: false, error: `plugin '${body.pluginId}' not found` });
      const result = engine.installPlugin(body.sourceId, plugin, body.skills);
      engine.setCommit(body.sourceId, plugin.id, market.commit);
      return sendJson(res, 200, { ok: true, result });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  });
  mount("exact", "/skills-marketplace/uninstall", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    try {
      const body = await parseJson(req);
      const { engine } = fresh();
      const result = engine.uninstallPlugin(body.sourceId, body.pluginId);
      return sendJson(res, 200, { ok: true, result });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  });
  mount("exact", "/skills-marketplace/skill-toggle", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    try {
      const body = await parseJson(req);
      const { m, engine } = fresh();
      const src = m.getSource(body.sourceId);
      if (!src) return sendJson(res, 404, { ok: false, error: "unknown source" });
      const cached = resolveMarketCached(body.sourceId, cacheDirFor(body.sourceId), src.sparsePath).market;
      const local = cached.plugins.length ? cached : resolveMarket(cacheDirFor(body.sourceId), src.sparsePath);
      const market = local.plugins.length ? local : cached;
      const plugin = market.plugins.find((p) => p.id === body.pluginId);
      if (!plugin) return sendJson(res, 404, { ok: false, error: "plugin not found" });
      if (body.on) {
        engine.installPlugin(body.sourceId, plugin, [body.skill]);
      } else {
        engine.uninstallSkill(body.sourceId, body.pluginId, body.skill);
      }
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  });
  mount("prefix", "/skills-marketplace/refresh", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    const sourceId = decodeURIComponent((req.url ?? "").split("/").filter(Boolean).pop() ?? "");
    if (!sourceId) return sendJson(res, 400, { ok: false, error: "sourceId required" });
    const { m, engine } = fresh();
    const src = m.getSource(sourceId);
    if (!src) return sendJson(res, 404, { ok: false, error: "unknown source" });
    try {
      const { market } = await fetchAndResolve(src.url, src.ref, src.sparsePath, src.id);
      const updated = [];
      for (const p of market.plugins) {
        const already = m.listInstalledBySource(sourceId).find((i) => i.pluginId === p.id);
        if (already) {
          engine.installPlugin(sourceId, p);
          engine.setCommit(sourceId, p.id, market.commit);
          updated.push(p.id);
        }
      }
      const pruned = engine.pruneOrphans();
      return sendJson(res, 200, { ok: true, updated, pruned });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  });
  return () => {
    for (const d of disposers) d();
  };
}

// src/settings.ts
var SKILL_MARKET_NAMESPACE = "skillMarket";
async function buildSchema() {
  const mod = await import("@deepseek-ai/schemastery");
  const z = mod.z ?? mod.default;
  if (!z) throw new Error("schemastery z unavailable");
  return z.object({
    installRoot: z.string(),
    autoInstall: z.boolean()
  });
}
var MarketSettings = class {
  constructor(settingsProvider) {
    this.settingsProvider = settingsProvider;
  }
  scope;
  /** 在 ctx 上注册命名空间(经 inject 传入 host 的 settings)。幂等。 */
  async register(ctx) {
    const existing = ctx.settings;
    if (!existing) throw new Error("dsh-skills-marketplace: settings provider unavailable");
    this.settingsProvider = existing;
    const schema = await buildSchema();
    this.scope = existing.register(SKILL_MARKET_NAMESPACE, schema, { applies: "live" });
    return this.scope;
  }
  get scopeOrNull() {
    return this.scope;
  }
  read() {
    if (!this.scope) return {};
    return this.scope.get() ?? {};
  }
  async write(patch) {
    if (!this.scope) throw new Error("dsh-skills-marketplace: settings not registered");
    const next = await this.scope.update(patch);
    return next ?? {};
  }
};

// src/index.ts
var name = "dsh-skills-marketplace";
function apply(ctx) {
  ctx.inject(["settings"], (host) => {
    const provider = host.settings;
    if (!provider) {
      console.warn("[dsh-skills-marketplace] settings provider unavailable; settings namespace skipped");
      return;
    }
    void new MarketSettings(provider).register(host).catch((e) => {
      console.error("[dsh-skills-marketplace] settings register failed:", e.message);
    });
  });
  ctx.inject(["webServer"], (host) => {
    const webServer = host.webServer;
    if (!webServer) return;
    const dispose = mountSkillsMarketplaceRoutes(webServer, {
      newManifest: () => new Manifest(),
      newEngine: (m) => new SyncEngine(m)
    });
    ctx.on("dispose", dispose);
  });
}
var inject = ["settings", "webServer"];
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
