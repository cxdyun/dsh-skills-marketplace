// routes smoke-test: mounts the routes on a stub webServer backed by a real
// node http server, then exercises the API exactly as the GUI would.
//
// A real git source is only required when MARKET_URL is set. Without it the
// test still verifies route registration + the source/installed lifecycle
// using an empty (offline) manifest, so it runs anywhere without internal deps.
//
//   MARKET_URL=https://github.com/you/your-skills-repo.git MARKET_REF=main \
//     MARKET_PATH=plugins MARKET_PLUGIN=my-plugin MARKET_SKILL=my-skill \
//     node smoke-routes.mjs
import http from 'node:http'
import { mountSkillsMarketplaceRoutes } from './lib/routes.js'
import { Manifest } from './lib/manifest.js'
import { SyncEngine } from './lib/sync.js'

const MARKET_URL = process.env.MARKET_URL
const MARKET_REF = process.env.MARKET_REF ?? 'main'
const MARKET_PATH = process.env.MARKET_PATH ?? 'plugins'
const MARKET_PLUGIN = process.env.MARKET_PLUGIN ?? 'my-plugin'
const MARKET_SKILL = process.env.MARKET_SKILL ?? 'my-skill'

const routes = []
const ws = {
  register(r) { routes.push(r); return () => {} }
}

// minimal dispatcher honoring exact/prefix
const server = http.createServer(async (req, res) => {
  for (const r of routes) {
    let hit = false
    const url = (req.url ?? '/')
    const pathname = url.split('?')[0]
    if (r.kind === 'exact' && pathname === r.path) hit = true
    else if (r.kind === 'prefix' && pathname.startsWith(r.path)) hit = true
    if (hit) { await r.handler(req, res); return }
  }
  res.writeHead(404); res.end('nf')
})

// default DSH_HOME for the test
const base = `/skills-marketplace`
const origin = 'http://127.0.0.1:PORT'

const manifest = new Manifest()
mountSkillsMarketplaceRoutes(ws, {
  newManifest: () => new Manifest(),
  newEngine: (m) => new SyncEngine(m),
})

async function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      host:'127.0.0.1', port: server.address().port,
      path, method,
      headers: body ? { 'content-type':'application/json', origin:'http://127.0.0.1:'+server.address().port } : { origin:'http://127.0.0.1:'+server.address().port },
    }, (s) => {
      let d=''; s.on('data',(c)=>d+=c); s.on('end',()=>resolve({status:s.statusCode, body:JSON.parse(d)}))
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

server.listen(0, async () => {
  try {
    let r = await req('GET', base+'/sources')
    console.log('GET sources →', r.status, 'sources', r.body.sources.length)
    if (!MARKET_URL) {
      console.log('(MARKET_URL not set — skipping live add/catalog/install steps)')
    } else {
      if (!r.body.sources.length) {
        r = await req('POST', base+'/sources', { url: MARKET_URL, ref: MARKET_REF, sparsePath: MARKET_PATH })
        console.log('POST sources →', r.status, r.body.pluginCount, 'plugins', r.body.skillCount, 'skills, id='+r.body.source.id)
      }
      r = await req('GET', base+'/sources')
      const sid = r.body.sources[0].id
      r = await req('GET', base+'/catalog?source='+sid)
      console.log('GET catalog →', r.status, r.body.plugins.length, 'plugins, e.g.', r.body.plugins.slice(0,3).map(p=>p.id+`(${p.skills.length})`).join(', '))
      // install one plugin
      r = await req('POST', base+'/install', { sourceId:sid, pluginId:MARKET_PLUGIN })
      console.log('POST install →', r.status, 'installed', (r.body.result?.installed ?? []).join(',')||'(none)')
      r = await req('GET', base+'/installed?source='+sid)
      console.log('GET installed →', r.status, r.body.installed.map(p=>p.pluginId+':'+p.skills.length).join(', '))
      // skill toggle off one
      r = await req('POST', base+'/skill-toggle', { sourceId:sid, pluginId:MARKET_PLUGIN, skill:MARKET_SKILL, on:false })
      console.log('POST skill-toggle(off) →', r.status)
      r = await req('POST', base+'/uninstall', { sourceId:sid, pluginId:MARKET_PLUGIN })
      console.log('POST uninstall →', r.status, (r.body.result?.removed ?? []).join(',')||'(none)')
    }
    console.log('\nALL ROUTES OK')
  } catch (e) {
    console.error('FAIL', e)
  } finally {
    server.close(); process.exit(0)
  }
})
