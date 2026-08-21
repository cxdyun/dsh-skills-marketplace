// host smoke test: mounts the built host entry (lib/index.js apply) against a
// stub cordis-context providing settings + webServer, and exercises the routes.
// A real git source is only required when MARKET_URL is set.
import { createRequire } from 'node:module'
import http from 'node:http'
const require = createRequire(import.meta.url)

const MARKET_URL = process.env.MARKET_URL
const MARKET_REF = process.env.MARKET_REF ?? 'main'
const MARKET_PATH = process.env.MARKET_PATH ?? 'plugins'
const MARKET_PLUGIN = process.env.MARKET_PLUGIN ?? 'my-plugin'

const routes = []
const scopeStore = {}
const stubSettings = {
  register(ns, schema, opts) { console.log('[host] settings.register →', ns, 'applies=', opts?.applies); return { get: () => scopeStore[ns] ?? {}, update: async (p) => { scopeStore[ns] = { ...(scopeStore[ns] ?? {}), ...p }; return scopeStore[ns] } } },
}
const stubContext = {
  settings: stubSettings,
  inject(services, cb) { if (services.includes('webServer')) cb(stubContext) },
  on() { return () => {} },
  get() { return undefined },
}

// fake webServer that collects registrations
const _r = []
stubContext.webServer = { register: (route) => { _r.push(route); return () => {} } }

const { apply } = await import('./lib/index.js')
apply(stubContext)

// Build an http dispatcher over collected routes
const server = http.createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  for (const r of _r) {
    const hit = r.kind === 'exact' ? path === r.path : path.startsWith(r.path)
    if (hit) { await r.handler(req, res); return }
  }
  res.writeHead(404); res.end('nf')
})

function call(P, method, path, body) {
  return new Promise((resolve, reject) => {
    const origin = `http://127.0.0.1:${P}`
    const r = http.request({ host: '127.0.0.1', port: P, path, method, headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}) } }, (s) => {
      let d = ''; s.on('data', c => d += c); s.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

server.listen(0, async () => {
  const P = server.address().port
  console.log('== host apply() mounted routes:', _r.length)
  let j = await call(P, 'GET', '/skills-marketplace/sources')
  console.log('GET sources → ok=', j.ok, 'sources=', j.sources.length)
  if (MARKET_URL) {
    j = await call(P, 'POST', '/skills-marketplace/sources', { url: MARKET_URL, ref: MARKET_REF, sparsePath: MARKET_PATH })
    console.log('POST sources → ok=', j.ok, 'plugins=', j.pluginCount, 'skills=', j.skillCount)
    const sid = j.source?.id ?? 'market'
    j = await call(P, 'GET', '/skills-marketplace/catalog?source='+sid)
    console.log('GET catalog → ok=', j.ok, 'plugins=', j.plugins.length)
    const wd = j.plugins.find(p => p.id === MARKET_PLUGIN)
    console.log('  skill desc present →', wd && wd.skills.every(s => s.description?.length > 0))
  } else {
    console.log('(MARKET_URL not set — skipping live add/catalog steps)')
  }
  console.log('\nHOST RUNTIME OK')
  process.exit(0)
})
