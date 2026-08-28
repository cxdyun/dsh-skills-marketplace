# DSH Skills Marketplace

![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-4c8bf5?style=flat-square)
![Skills](https://img.shields.io/badge/Skills-Codex%20%7C%20Claude-6366f1?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/github/license/cxdyun/dsh-skills-marketplace?style=flat-square)

![DSH Skills Marketplace](./docs/images/hero.png)

简体中文 | **[English](./README.en.md)**

> 把任意 Codex / Claude 技能仓库，变成按插件管理的 DSH 原生技能市场。

给定技能仓库（`Git 地址 + 分支 + 稀疏路径`），自动拉取插件与技能、摊平安装到 `~/.dsh/skills/`，并在设置页以**插件维度**管理（DSH 默认只有扁平技能列表）。同一份 `SKILL.md` 可被 **DSH、Codex、Claude 三端复用**。

## 快速开始

要求：DSH、Node.js 22+、pnpm 10+。

```bash
# 安装（<profile> 替换为你的 profile 名，如 web）
dsh plugin --profile <profile> add github:cxdyun/dsh-skills-marketplace
# 日常使用推荐 npm 源（无需 GitHub 构建许可）
dsh plugin --profile <profile> add dsh-skills-marketplace

# 启动并打开 设置 → Skill 插件市场
dsh --profile <profile>
```

看到 **Skill 插件市场** 设置项，即安装成功。

## 在 DSH Desktop 中添加插件市场

### 1. 添加插件市场

打开 **设置 → Skill 插件市场**，点击「添加插件市场」。填写技能仓库地址和 Git 引用；稀疏路径为可选项，仓库根目录就是技能市场时保持为空。

![添加插件市场](./docs/images/add-marketplace.png)

### 2. 展开插件列表

保存后，点击市场卡片右侧的展开按钮，即可在同一张市场卡片中查看插件列表和每个插件的技能数量。

![展开插件列表](./docs/images/expand-plugin-list.png)

### 3. 管理技能

点击插件卡片进入详情页，可通过顶部总开关或各技能右侧开关安装、启用或停用技能。

![管理技能](./docs/images/manage-skills.png)

## 使用

1. **更新** —— 市场卡片点「更新」，按你的配置拉取 ref 最新内容：已启用技能更新到最新，逐技能选择完整保留，远端删除的技能安全清理。

2. **编辑 / 移除** —— 编辑修改来源配置；移除需二次确认，只删来源配置，已安装技能保留。

## 文档

详细说明见 **[docs/guide.md](./docs/guide.md)**：

- [安装详解](./docs/guide.md#安装详解) —— GitHub / npm / 固定 commit / 源码构建
- [工作原理](./docs/guide.md#工作原理) —— 稀疏拉取、清单解析、扁平落盘、插件维度管理
- [CLI 完整用法](./docs/guide.md#cli-完整用法) · [HTTP API](./docs/guide.md#http-api)
- [与 DSH 集成](./docs/guide.md#如何与-dsh-集成) · [构建](./docs/guide.md#构建) · [安全设计](./docs/guide.md#安全设计)

## 许可证

[MIT](./LICENSE)
