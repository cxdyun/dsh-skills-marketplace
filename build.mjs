/**
 * build.mjs — esbuild 双包构建(dsh-skills-marketplace)
 *
 * 镜像 dsh-at-file 的构建方式:
 *   - host(lib/index.js):Node ESM,用于 cordis bundle 加载;
 *     外部化 @deepseek-ai/dsh-* 与 cordis(由宿主提供)。
 *   - client(lib/client.js):浏览器 CJS,包在 __ModuleLoader__ 手握手协议里,
 *     以 single-file 供宿主 web server 在 /plugins/dsh-skills-marketplace/client.js 提供;
 *     外部化 @deepseek-ai/dsh-*、react 等运行期依赖。
 *   - 额外把 CLI 可复用的核心逻辑也产出 lib/manifest.js 等纯 ESM(无 cordis 依赖)。
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*', '@deepseek-ai/schemastery']

// 1) host 入口(cordis bundle)
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: dshExternal,
  logLevel: 'info',
})

// 2) 可复用核心逻辑(manifest/remote/sync/http/routes 不依赖 cordis,纯 ESM 供 CLI/测试)
for (const [entry, out] of [
  ['src/manifest.ts', 'lib/manifest.js'],
  ['src/remote.ts', 'lib/remote.js'],
  ['src/sync.ts', 'lib/sync.js'],
  ['src/http.ts', 'lib/http.js'],
  ['src/routes.ts', 'lib/routes.js'],
]) {
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: ['node22'],
    sourcemap: true,
    logLevel: 'error',
  })
}

// 3) client 入口(浏览器,__ModuleLoader__ 手握手)
await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: [
    ...dshExternal,
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'scheduler',
  ],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-skills-marketplace', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

// 4) declare 类型(供消费方 / 自省);这里用 tsc 产出 .d.ts
const { execFileSync } = await import('node:child_process')
execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' })
