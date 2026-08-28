/**
 * refresh.test.mjs — 「更新」操作端到端测试。
 *
 * 用本地 bare 仓库模拟市场来源,验证完整链路:
 *   1. 添加来源(v1) → 安装插件 → 停用部分技能(用户选择);
 *   2. 远端推进到 v2(改动技能内容 + 新增技能);
 *   3. POST /refresh/<id> 后:
 *      - 已启用技能的落盘内容更新为 v2(增量 fetch 真正前进,checkout 不再是 no-op);
 *      - 用户逐技能选择保留(停用的不被迫开启,新技能不自动安装);
 *      - catalog 磁盘缓存随 HEAD 前进自动失效,返回最新清单;
 *      - 响应带 commit/pluginCount/skillCount 供 GUI 展示。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 隔离的 DSH_HOME:manifest/markets.json、skills 安装根、markets-cache 全在临时目录。
const TMP = mkdtempSync(join(tmpdir(), 'dsh-market-refresh-'))
process.env.DSH_HOME = join(TMP, 'home')

const { mountSkillsMarketplaceRoutes } = await import('../lib/routes.js')
const { Manifest } = await import('../lib/manifest.js')
const { SyncEngine } = await import('../lib/sync.js')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
}

function makeSkill(root, name, body) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\n${body}\n`)
  return dir
}

/** 准备 bare origin + work 克隆,推 v1(p1 含 s1/s2),返回 work 目录。 */
function setupOriginV1() {
  const origin = join(TMP, 'origin.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  const work = join(TMP, 'work')
  execFileSync('git', ['clone', '-q', origin, work], { encoding: 'utf8' })
  git(work, 'config', 'user.email', 't@t')
  git(work, 'config', 'user.name', 't')
  makeSkill(join(work, 'plugins', 'p1', 'skills'), 's1', 'content-v1')
  makeSkill(join(work, 'plugins', 'p1', 'skills'), 's2', 'content-v1')
  git(work, 'add', '-A')
  git(work, 'commit', '-qm', 'v1')
  git(work, 'push', '-q', 'origin', 'main')
  return work
}

/** 把 origin 推进到 v2:改 s1 内容,新增 s3。 */
function pushV2(work) {
  writeFileSync(join(work, 'plugins', 'p1', 'skills', 's1', 'SKILL.md'), `---\nname: s1\ndescription: s1\n---\ncontent-v2\n`)
  makeSkill(join(work, 'plugins', 'p1', 'skills'), 's3', 'content-v2')
  git(work, 'add', '-A')
  git(work, 'commit', '-qm', 'v2')
  git(work, 'push', '-q', 'origin', 'main')
}

test('更新市场:增量拉取最新且保留用户已启用的技能选择', async (t) => {
  t.after(() => rmSync(TMP, { recursive: true, force: true }))
  const work = setupOriginV1()

  // 起真实 http 服务挂载路由(同 GUI 调用方式)
  const routes = []
  const ws = { register(r) { routes.push(r); return () => {} } }
  mountSkillsMarketplaceRoutes(ws, {
    newManifest: () => new Manifest(),
    newEngine: (m) => new SyncEngine(m),
  })
  const server = http.createServer(async (req, res) => {
    const pathname = (req.url ?? '/').split('?')[0]
    for (const r of routes) {
      const hit = r.kind === 'exact' ? pathname === r.path : pathname.startsWith(r.path)
      if (hit) { await r.handler(req, res); return }
    }
    res.writeHead(404); res.end('nf')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())

  const base = '/skills-marketplace'
  async function req(method, path, body) {
    return new Promise((resolve, reject) => {
      const r = http.request({
        host: '127.0.0.1', port: server.address().port, path, method,
        headers: { origin: `http://127.0.0.1:${server.address().port}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      }, (s) => {
        let d = ''; s.on('data', (c) => d += c)
        s.on('end', () => resolve({ status: s.statusCode, body: JSON.parse(d) }))
      })
      r.on('error', reject)
      if (body) r.write(JSON.stringify(body))
      r.end()
    })
  }

  // 1. 添加来源(v1)
  let r = await req('POST', `${base}/sources`, { url: join(TMP, 'origin.git'), ref: 'main', sparsePath: 'plugins' })
  assert.equal(r.status, 201)
  const sid = r.body.source.id
  assert.equal(r.body.pluginCount, 1)
  assert.equal(r.body.skillCount, 2)

  // 2. 安装 p1,再停用 s2 → 用户选择仅保留 s1
  r = await req('POST', `${base}/install`, { sourceId: sid, pluginId: 'p1' })
  assert.equal(r.status, 200)
  r = await req('POST', `${base}/skill-toggle`, { sourceId: sid, pluginId: 'p1', skill: 's2', on: false })
  assert.equal(r.status, 200)
  const skillsRoot = join(process.env.DSH_HOME, 'skills')
  assert.equal(readFileSync(join(skillsRoot, 's1', 'SKILL.md'), 'utf8').includes('content-v1'), true)

  // 3. 远端推进 v2,触发「更新」
  const commitV1 = (await req('GET', `${base}/catalog?source=${encodeURIComponent(sid)}`)).body.commit
  pushV2(work)
  r = await req('POST', `${base}/refresh/${encodeURIComponent(sid)}`)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.updated, ['p1'])
  assert.equal(r.body.pluginCount, 1)
  assert.equal(r.body.skillCount, 3)
  assert.notEqual(r.body.commit, commitV1)

  // 4. 已启用技能内容更新到 v2;停用的 s2 与新增的 s3 都不落盘(保留选择)
  assert.equal(readFileSync(join(skillsRoot, 's1', 'SKILL.md'), 'utf8').includes('content-v2'), true)

  // 5. catalog 缓存随 HEAD 前进失效,返回最新清单(s1/s2/s3)
  r = await req('GET', `${base}/catalog?source=${encodeURIComponent(sid)}`)
  const names = r.body.plugins[0].skills.map((s) => s.name).sort()
  assert.deepEqual(names, ['s1', 's2', 's3'])

  // 6. installed 视图:仅 s1 受管;commit 已回填为 v2
  r = await req('GET', `${base}/installed?source=${encodeURIComponent(sid)}`)
  const p1 = r.body.installed.find((x) => x.pluginId === 'p1')
  assert.deepEqual(p1.skills, ['s1'])
  assert.notEqual(p1.commit, null)
})
