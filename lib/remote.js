import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
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
  const home = process.env.DSH_HOME ?? join(process.env.HOME ?? ".", ".dsh");
  return join(home, "markets-cache", sourceId);
}
function defaultBranch(url) {
  const r = spawnSync("git", ["ls-remote", "--symref", url, "HEAD"], { encoding: "utf8", timeout: 3e4, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const m = /HEAD\s+ref:\s+refs\/heads\/([^\s]+)/.exec(r.stdout ?? "");
  return m ? m[1] : "master";
}
function cloneMarket(src) {
  const id = src.id ?? sourceIdFor(src.url);
  const cacheDir = join(process.env.DSH_HOME ?? join(process.env.HOME ?? ".", ".dsh"), "markets-cache", id);
  mkdirSync(cacheDir, { recursive: true });
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
  r = runGit(cacheDir, ["reset", "--hard", "FETCH_HEAD"]);
  if (!r.ok) throw new Error(`git reset failed: ${r.err}`);
  return { id, cacheDir };
}
function resolveMarket(cacheDir, sparsePath) {
  const explicitFile = join(cacheDir, sparsePath, "dsh.market.json");
  const fsTryExplicit = tryReadJson(explicitFile);
  if (fsTryExplicit) {
    return resolveExplicit(fsTryExplicit, cacheDir);
  }
  return resolveConvention(cacheDir, sparsePath);
}
function tryReadJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
function resolveExplicit(markets, cacheDir) {
  const plugins = [];
  for (const p of markets.plugins ?? []) {
    const skillRoot = join(cacheDir, p.skills ?? "");
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
  const root = join(cacheDir, sparsePath);
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
  return existsSync(join(dir, "skills"));
}
function pluginFromDir(pd) {
  const skillsDir = join(pd, "skills");
  if (!existsSync(skillsDir)) return null;
  const pid = basename(pd);
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
  const codex = tryReadJson(join(pd, ".codex-plugin", "plugin.json"));
  if (codex) {
    const itf = codex.interface;
    return {
      displayName: itf?.displayName ?? codex.name,
      description: itf?.shortDescription ?? codex.description,
      category: itf?.category
    };
  }
  const flat = tryReadJson(join(pd, "plugin.json"));
  if (flat) {
    return {
      displayName: flat.displayName ?? flat.name,
      description: flat.description,
      category: flat.category
    };
  }
  const claude = tryReadJson(join(pd, "..", ".claude-plugin", "marketplace.json"));
  if (claude && Array.isArray(claude.plugins)) {
    const match = claude.plugins.find((x) => basename(String(x?.source ?? "").replace(/^\.?\//, "")) === basename(pd));
    if (match) return { description: match.description, category: match.category };
  }
  return {};
}
function collectSkillBundles(root, pluginId) {
  const out = [];
  for (const skillDir of listDirs(root)) {
    const skillMd = join(skillDir, "SKILL.md");
    if (exists(skillMd)) {
      out.push({
        name: basename(skillDir),
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
    const txt = readFileSync(skillMd, "utf8");
    const m = /^---\n([\s\S]*?)\n---/.exec(txt);
    const fm = m ? m[1] : "";
    const dm = /^description\s*:\s*(.+)$/m.exec(fm);
    return dm ? dm[1].trim().replace(/^["']|["']$/g, "") : void 0;
  } catch {
    return void 0;
  }
}
function listDirs(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => join(root, d.name));
}
function exists(p) {
  return existsSync(p);
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
  const cacheFile = join(cacheDir, ".catalog.json");
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
    writeFileSync(cacheFile, JSON.stringify({ commit: fresh.commit, plugins: fresh.plugins }, null, 2));
  } catch {
  }
  return { market: fresh, fromCache: false, commit: fresh.commit };
}
function isCheckoutReady(cacheDir) {
  return existsSync(cacheDir) && existsSync(join(cacheDir, ".git")) && headCommit(cacheDir) !== null;
}
export {
  cacheDirFor,
  cloneMarket,
  collectSkillBundles,
  defaultBranch,
  fetchAndResolve,
  frontmatterDescription,
  isCheckoutReady,
  resolveMarket,
  resolveMarketCached,
  sourceIdFor
};
//# sourceMappingURL=remote.js.map
