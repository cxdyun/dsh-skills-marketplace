import { readJsonBody, sameOrigin, sendJson } from "./http.js";
import { fetchAndResolve, resolveMarket, resolveMarketCached, cacheDirFor } from "./remote.js";
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
          const available = new Set(p.skills.map((s) => s.name));
          engine.installPlugin(sourceId, p, already.skills.filter((n) => available.has(n)));
          engine.setCommit(sourceId, p.id, market.commit);
          updated.push(p.id);
        }
      }
      const pruned = engine.pruneOrphans();
      return sendJson(res, 200, {
        ok: true,
        updated,
        pruned,
        commit: market.commit,
        pluginCount: market.plugins.length,
        skillCount: market.plugins.reduce((a, p) => a + p.skills.length, 0)
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  });
  return () => {
    for (const d of disposers) d();
  };
}
export {
  mountSkillsMarketplaceRoutes
};
//# sourceMappingURL=routes.js.map
