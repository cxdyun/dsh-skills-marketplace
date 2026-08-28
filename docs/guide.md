# DSH Skills Marketplace · 详细指南

> 本文是 [README](../README.md) 的详细版：工作原理、安装方式、CLI、HTTP API、DSH 集成、构建与安全设计。

## 目录

- [工作原理](#工作原理)
- [安装详解](#安装详解)
- [使用详解](#使用详解)
- [CLI 完整用法](#cli-完整用法)
- [HTTP API](#http-api)
- [如何与 DSH 集成](#如何与-dsh-集成)
- [构建](#构建)
- [安全设计](#安全设计)

---

## 工作原理

### 为什么需要

DSH 的 `@deepseek-ai/dsh-skill-filesystem` 原生扫描以下技能根，并读取 `<name>/SKILL.md` 的 front-matter：

| rank | 作用域 scope | 路径 path |
|------|------|-------|
| 100 | 项目 project | `<project>/.dsh/skills` |
| 200 | 项目 project | `<project>/.agents/skills` |
| 400 | 用户 user | `~/.dsh/skills` ← **本管理器的安装目标 install target** |
| 500 | 用户 user | `~/.agents/skills`（与 Codex/Claude 共用 shared） |

因此 **`SKILL.md` 本身就是共同标准**。DSH **不解析** Codex/Claude 的**包装层**（`marketplace.json` / `plugin.json` / `agents/openai.yaml` / MCP 清单）。本管理器负责补齐这一层：

1. **拉取 / Fetching** —— `git sparse-checkout`，只取所需稀疏路径。
2. **清单解析 / Catalog resolution** —— A) 显式 `dsh.market.json`；或 B) 约定式扫 `plugins/*/skills/*/SKILL.md`（**零改造**即可适配现有 Codex/Claude 仓库）。
3. **扁平落盘 / Flattening** —— 每个技能摊平到 `~/.dsh/skills/<skill-name>/`（一层深；剥离 Codex 专属 `agents/openai.yaml`）。
4. **插件维度管理 / Plugin-dimension management** —— 本地 manifest（`plugin ↔ skills ↔ source ↔ commit`）驱动插件优先的 GUI。

同一份 `SKILL.md` 是各生态之间的通用标准——一套技能库，可被 **DSH、Codex、Claude 三端同时复用**。

### 特性一览

- **仓库 → 技能 / Repository → skills** —— 把任意 Git 技能仓库作为 *来源 source* 添加（`url + ref + sparsePath`）。
- **插件维度 / Plugin dimension** —— 技能按**插件**分组展示，而非扁平列表。
- **逐技能开关 / Per-skill toggle** —— 单独启用/停用技能，安装进 `~/.dsh/skills`。
- **安全卸载与清理 / Safe uninstall & prune** —— 只删除本管理器安装过的技能（经「墓碑 tombstone」集合记录）；绝不触碰你自建的技能。
- **增量更新 / Refresh** —— 增量拉取 + 孤立清理，保留逐技能开关的选择。
- **双前端 / Dual front-ends** —— 自包含 HTML GUI（`client/market.html`），以及**无依赖的 CLI**（核心逻辑纯 Node，不依赖 DSH 即可验证整条链路）。
- **同源校验 / Same-origin enforced** —— 所有变更类端点强制 same-origin。

---

## 安装详解

前置要求：已安装 DSH、Node.js 22+、pnpm 10+，并具备修改 DSH profile 的权限。

### 方式一：从 GitHub 安装

```bash
dsh plugin --profile <profile> add github:cxdyun/dsh-skills-marketplace
```

也可以固定到某个 commit，避免远端后续变更：

```bash
dsh plugin --profile <profile> add github:cxdyun/dsh-skills-marketplace#<commit-sha>
```

### 方式二：从 npm 安装

发布包安装不需要 GitHub 构建许可，推荐用于日常使用：

```bash
dsh plugin --profile <profile> add dsh-skills-marketplace
```

`dsh plugin` 会在对应 profile 目录中调用 pnpm；等价的底层命令是：

```bash
cd "$DSH_HOME/profiles/<profile>"
pnpm add dsh-skills-marketplace
```

> ⚠️ 不要在项目源码目录中执行上面的 `pnpm add`，否则只会把它作为普通项目依赖安装，不会加入 DSH profile 的 bundle 列表。

### 方式三：从源码构建

```bash
git clone https://github.com/cxdyun/dsh-skills-marketplace.git
cd dsh-skills-marketplace
pnpm install
pnpm run check        # 类型检查 + 构建（产出 lib/）
```

按照 DSH 安装其他 Cordis 插件的方式，将本项目加入 DSH profile 并启用。

> DSH profile 的目录和启用方式由 DSH 宿主决定，本项目不覆盖宿主的插件安装配置；请沿用宿主安装其他 Cordis 插件的流程。

### 验证安装

安装后启动对应 profile：

```bash
dsh --profile <profile>
```

打开 **设置 → Skill 插件市场**，能看到 **Skill 插件市场** 设置项，即表示插件加载成功。添加技能来源并安装插件后，技能会写入 `~/.dsh/skills/`，随后可被 DSH 智能体使用。

---

## 使用详解

### 1. 添加插件市场

打开 **设置 → Skill 插件市场**，点击「添加插件市场」。填写技能仓库地址和 Git 引用；稀疏路径为可选项，仓库根目录就是技能市场时保持为空。

![添加插件市场](./images/add-marketplace.png)

### 2. 展开插件列表

保存后，点击市场卡片右侧的展开按钮，即可在同一张市场卡片中查看插件列表和每个插件的技能数量。

![展开插件列表](./images/expand-plugin-list.png)

### 3. 管理技能

点击插件卡片进入详情页，可通过顶部总开关或各技能右侧开关安装、启用或停用技能。

![管理技能](./images/manage-skills.png)

### 4. 更新插件市场

市场卡片上点击「更新」，即按该来源的用户配置（仓库地址 + Git 引用 + 稀疏路径）增量拉取 ref 的最新内容：

- 已启用技能的落盘文件更新为最新版本；
- 逐技能开关的选择完整保留（停用的技能不会被强行开启，新增技能不自动安装）；
- 远端已删除的技能被安全清理（只清理本管理器受管的技能）。

### 5. 移除插件市场

点击「移除」会先弹出二次确认；确认后仅删除该来源配置，已安装技能保留在 `~/.dsh/skills/`，不会被删除。

### GUI 布局说明

打开 `client/market.html`（或在 DSH **设置 → Skill 插件市场** 中使用）：

- **我的市场 / My markets** —— 来源卡片（显示 `ref`/`sparse`），带「添加插件市场」表单（来源 / 分支 / 稀疏路径），以及「更新 / 编辑 / 移除」操作。
- **插件目录 / Plugin catalog** —— 与来源整合在**同一张卡片**内（对齐 DSH 内置插件列表的内联展开卡片）：点击市场卡头部即在卡片内部展开/收起插件网格；展开时高亮边框 + 阴影 + chevron 旋转。每个插件徽标显示其技能数与已安装数。
- **插件详情 / Plugin details** —— 逐技能开关：开 = 安装进 `~/.dsh/skills`，关 = 从 manifest 剔除并卸载。

---

## CLI 完整用法

CLI 不依赖 DSH，可先验证核心链路；安装结果写入 `~/.dsh/skills/`。

```bash
git clone https://github.com/cxdyun/dsh-skills-marketplace.git
cd dsh-skills-marketplace
pnpm install
node cli.mjs --help
```

```bash
# 添加来源（仓库 + 分支 + 稀疏路径）
node cli.mjs add "https://github.com/you/your-skills-repo.git" --ref main --path plugins

node cli.mjs list                            # 列出已添加来源
node cli.mjs catalog                         # 查看远端插件/技能目录
node cli.mjs install my-plugin               # 安装插件（默认第一个来源）
node cli.mjs install-all                     # 安装全部插件
node cli.mjs view                            # 插件维度查看（默认第一个来源）
node cli.mjs uninstall my-plugin             # 卸载，只删受管技能
node cli.mjs refresh my-source               # 增量更新 + 孤儿清理（保留技能选择）
node cli.mjs prune                           # 清理墓碑
```

可用命令：`add`, `list`, `catalog`, `install`, `install-all`, `uninstall`, `refresh`, `prune`, `view`。

---

## HTTP API

所有路由挂载在 `/skills-marketplace` 前缀下（same-origin）：

| Method 方法 | Path 路径 | 说明 |
|---|---|---|
| GET | `/skills-marketplace/sources` | 来源列表 list sources |
| POST | `/skills-marketplace/sources` | 添加 add `{url, ref?, sparsePath?}` |
| PUT | `/skills-marketplace/sources/:id` | 编辑来源（保持 id 与已装记录） |
| DELETE | `/skills-marketplace/sources/:id` | 移除来源（保留已装技能）remove a source |
| GET | `/skills-marketplace/catalog?source=<id>` | 远端插件/技能目录（插件优先，带磁盘缓存）remote catalog |
| GET | `/skills-marketplace/installed?source=<id>` | 已安装视图 installed view |
| POST | `/skills-marketplace/install` | 安装 install `{sourceId, pluginId, skills?}` |
| POST | `/skills-marketplace/uninstall` | 卸载 uninstall `{sourceId, pluginId}` |
| POST | `/skills-marketplace/skill-toggle` | 技能开关 `{sourceId, pluginId, skill, on}` |
| POST | `/skills-marketplace/refresh/<sourceId>` | 增量更新到配置 ref 的最新（只重装已启用技能，保留用户选择）incremental update |

`refresh` 响应：`{ ok, updated[], pruned[], commit, pluginCount, skillCount }`。

所有非 GET 端点强制**同源**校验（已验证跨域返回 403）。

---

## 如何与 DSH 集成

构建产物是一个 **DSH（cordis）插件**，分 host 与 client 两半区：

- **Host 半区 / Host side**（`lib/index.js`）
  - 声明 `inject = ['settings', 'webServer']`；
  - 注册 `skillMarket` 设置命名空间（`installRoot`、`autoInstall`），使其持久化到 DSH 设置页；
  - 挂载 `/skills-marketplace/*` HTTP 路由供 GUI 与 CLI 使用。
- **Client 半区 / Client side**（`lib/client.js`）
  - 在 DSH 设置页注册名为 **「Skill 插件市场 / Skills Marketplace」** 的 **`settings.section`**（`SkillMarketSection`）；
  - 提供插件列表、插件详情与逐技能开关。

**安装后 / After install**：技能被摊平写入 `~/.dsh/skills/`，内置 `dsh-skill-filesystem` 会自动监听该目录——**无需重载或额外加载配置**，技能立即可被 DSH 智能体使用。

---

## 构建

```bash
pnpm install
pnpm run check        # 类型检查 + 构建 + 测试（产出 lib/）
```

`pnpm run build` 运行 `node build.mjs`，用 esbuild 产出：

- `lib/index.js` —— host（cordis）bundle；
- `lib/client.js` —— 浏览器 client（单文件 `__ModuleLoader__` 手握手协议）；
- `lib/{manifest,remote,sync,http,routes}.js` —— CLI 与测试复用的纯 ESM 核心；
- `.d.ts` 类型声明（via `tsc`）。

测试：`pnpm run test`（`node --test test/*.test.mjs`）。

---

## 安全设计

- **安全卸载 / Safe uninstall** —— 只删除 manifest 登记的受管技能；清理只作用于「墓碑」集合（曾安装、现已失效）。绝不触碰你自建的技能。
- **移除二次确认 / Remove confirmation** —— GUI 移除来源前弹出确认弹窗，防止误删。
- **跨域拒绝 / Cross-origin denied** —— 变更类端点强制 same-origin。
- **Codex 专属文件剥离 / Codex-only files stripped** —— `agents/openai.yaml` 从不落盘（DSH 不读，且会污染一层结构）。
- **MCP 依赖提示 / MCP caveat** —— 依赖外部 MCP 的技能在 DSH 侧只有 `SKILL.md` 指令文本（DSH 不拉起 `agents/openai.yaml` MCP 服务）；此类技能会在 UI 中标出。
