# Plexus 模块架构主设计

> 迁移时间：2026-07-02  
> 来源：由当前代码与 `PMAD/architecture/graphs/current-project.arch.json` 迁移为模块化工作流基线。  
> 状态：current baseline / migrated from legacy PM。

## 1. 架构总览

Plexus 是一个 Tauri 2 + React 19 桌面笔记应用，核心形态是“本地 Markdown 知识库 + 可视化编辑 + 本地 Git 同步 + AI Agent 协作”。当前架构按模块化工作流拆分为 5 个复合主模块与 18 个原子模块。

| 复合模块 | 名称 | 边界摘要 |
| --- | --- | --- |
| `frontend-shell-state` | 前端 Shell 与状态组合 | 组织应用框架、全局状态恢复和 Tauri 前端适配的组合模块 |
| `note-authoring-module` | 笔记作者体验组合 | 覆盖笔记树、搜索、自动保存草稿和模块化 Markdown 编辑体验 |
| `ai-agent-workbench` | AI Agent 工作台组合 | 组织聊天界面、上下文预算、工具执行、provider 配置和流式代理 |
| `backend-workspace-runtime` | 后端工作区运行时组合 | 管理 Tauri 命令、工作区打开、文件仓储、图片资产和会话资源 |
| `sync-config-runtime` | 同步与配置运行时组合 | 覆盖本地 Git、远端同步调度、事件桥和应用配置规则 |

## 2. 当前模块基线

### 2.1 复合主模块

| ID | 名称 | 类型 | 描述 | 文档 |
| --- | --- | --- | --- | --- |
| `frontend-shell-state` | 前端 Shell 与状态组合 | composite / layout-style | 组织应用框架、全局状态恢复和 Tauri 前端适配的组合模块 | [frontend-shell-state](modules/frontend-shell-state.md) |
| `note-authoring-module` | 笔记作者体验组合 | composite / function-flow | 覆盖笔记树、搜索、自动保存草稿和模块化 Markdown 编辑体验 | [note-authoring-module](modules/note-authoring-module.md) |
| `ai-agent-workbench` | AI Agent 工作台组合 | composite / function-flow | 组织聊天界面、上下文预算、工具执行、provider 配置和流式代理 | [ai-agent-workbench](modules/ai-agent-workbench.md) |
| `backend-workspace-runtime` | 后端工作区运行时组合 | composite / adapter-io | 管理 Tauri 命令、工作区打开、文件仓储、图片资产和会话资源 | [backend-workspace-runtime](modules/backend-workspace-runtime.md) |
| `sync-config-runtime` | 同步与配置运行时组合 | composite / event-message | 覆盖本地 Git、远端同步调度、事件桥和应用配置规则 | [sync-config-runtime](modules/sync-config-runtime.md) |

### 2.2 原子模块

| ID | 名称 | 类型 | 描述 | 文档 |
| --- | --- | --- | --- | --- |
| `app-shell-layout` | 应用 Shell 布局 | atomic / layout-style | 组合顶栏、活动栏、侧栏、标签栏、主区域、状态栏和全局弹窗 | [app-shell-layout](modules/app-shell-layout.md) |
| `ui-state-stores` | 前端状态 stores | atomic / data-state | 用 Zustand 管理 workspace、tabs、settings、sessions、AI run 和同步状态 | [ui-state-stores](modules/ui-state-stores.md) |
| `tauri-service-adapters` | Tauri 前端服务适配 | atomic / interface-object | 将前端调用封装为稳定的 invoke/listen 服务对象 | [tauri-service-adapters](modules/tauri-service-adapters.md) |
| `note-tree-search` | 笔记树与搜索流 | atomic / function-flow | 加载目录树、缓存子目录、执行全文搜索并定位编辑器结果 | [note-tree-search](modules/note-tree-search.md) |
| `editor-draft-lifecycle` | 编辑器草稿生命周期 | atomic / data-state | 管理笔记加载、草稿变更、防抖保存、脏标记、外部变更和卸载 flush | [editor-draft-lifecycle](modules/editor-draft-lifecycle.md) |
| `markdown-module-engine` | Markdown 模块编辑引擎 | atomic / function-flow | 将 Markdown 解析为可编辑块并处理预览、列表、表格、数学、Mermaid 和图片 | [markdown-module-engine](modules/markdown-module-engine.md) |
| `ai-chat-surface` | AI 聊天界面 | atomic / layout-style | 展示会话消息、输入、附件、上下文预算和 agent 状态窗口 | [ai-chat-surface](modules/ai-chat-surface.md) |
| `ai-agent-loop` | AI Agent 循环 | atomic / function-flow | 构造模型请求、消费流式事件、聚合工具调用并执行多轮 agent loop | [ai-agent-loop](modules/ai-agent-loop.md) |
| `ai-context-tools` | 上下文与工具注册 | atomic / config-rule | 管理 agent 模板、上下文预算、状态快照、工具 schema 和工具执行配置 | [ai-context-tools](modules/ai-context-tools.md) |
| `provider-config-proxy` | Provider 配置与流式代理 | atomic / adapter-io | 连接前端 provider 元数据、后端密钥读取和外部 OpenAI/Anthropic 风格 API | [provider-config-proxy](modules/provider-config-proxy.md) |
| `workspace-lifecycle` | 工作区生命周期 | atomic / interface-object | 打开工作区、确保 Git 与内部目录、恢复 active workspace 并启动 watcher/pusher | [workspace-lifecycle](modules/workspace-lifecycle.md) |
| `note-file-repository` | 笔记文件仓储 | atomic / adapter-io | 以工作区安全相对路径读写、移动、删除、列出和搜索 Markdown 笔记 | [note-file-repository](modules/note-file-repository.md) |
| `asset-image-pipeline` | 图片资产管线 | atomic / adapter-io | 处理编辑器和聊天图片的捕获、压缩、解码、嗅探、写入和 data URL 读取 | [asset-image-pipeline](modules/asset-image-pipeline.md) |
| `session-artifact-store` | 会话与内部资源存储 | atomic / resource-file | 管理 workspace 内部 .plexus 会话、workspace 状态、chat assets 和历史清理 | [session-artifact-store](modules/session-artifact-store.md) |
| `git-local-history` | 本地 Git 历史 | atomic / adapter-io | 初始化工作区 Git 仓库、提交全部文件改动并计算本地/远端差异 | [git-local-history](modules/git-local-history.md) |
| `git-remote-sync-pusher` | 远端 Git 同步调度器 | atomic / event-message | 基于 commit/config/foreground/sync 信号调度 fetch/push 并发布同步状态 | [git-remote-sync-pusher](modules/git-remote-sync-pusher.md) |
| `event-bridge` | Tauri 事件桥 | atomic / event-message | 在 Rust 后端异步事件和前端 stores/components 之间传递 watcher、AI stream、Git sync 与菜单事件 | [event-bridge](modules/event-bridge.md) |
| `app-config-rules` | 应用配置规则 | atomic / config-rule | 定义 localStorage、~/.plexus 和工作区 .plexus 中配置的归属、默认值与迁移规则 | [app-config-rules](modules/app-config-rules.md) |

### 2.3 复合模块包含关系

- `frontend-shell-state`（前端 Shell 与状态组合）：`app-shell-layout`, `ui-state-stores`, `tauri-service-adapters`
- `note-authoring-module`（笔记作者体验组合）：`note-tree-search`, `editor-draft-lifecycle`, `markdown-module-engine`
- `ai-agent-workbench`（AI Agent 工作台组合）：`ai-chat-surface`, `ai-agent-loop`, `ai-context-tools`, `provider-config-proxy`
- `backend-workspace-runtime`（后端工作区运行时组合）：`workspace-lifecycle`, `note-file-repository`, `asset-image-pipeline`, `session-artifact-store`
- `sync-config-runtime`（同步与配置运行时组合）：`git-local-history`, `git-remote-sync-pusher`, `event-bridge`, `app-config-rules`

## 3. 依赖边界

当前依赖图以 `graphs/current-project.arch.json` 为机器可校验来源，渲染文件位于 `rendered/current-project-architecture.html` 与 `rendered/current-project-architecture.svg`。

- `app-shell-layout` -> `ui-state-stores` (`solid`)：读取布局和激活状态
- `app-shell-layout` -> `note-tree-search` (`solid`)：挂载笔记空间
- `app-shell-layout` -> `ai-chat-surface` (`solid`)：挂载 AI 空间
- `ui-state-stores` -> `tauri-service-adapters` (`solid`)：异步动作调用服务
- `tauri-service-adapters` -> `workspace-lifecycle` (`solid`)：invoke 工作区命令
- `tauri-service-adapters` -> `note-file-repository` (`solid`)：invoke 笔记命令
- `tauri-service-adapters` -> `session-artifact-store` (`solid`)：读写会话状态
- `note-tree-search` -> `note-file-repository` (`solid`)：list/search/reveal
- `markdown-module-engine` -> `editor-draft-lifecycle` (`solid`)：提交 Markdown 变更
- `editor-draft-lifecycle` -> `note-file-repository` (`solid`)：read/update 自动保存
- `markdown-module-engine` -> `asset-image-pipeline` (`solid`)：渲染/插入图片
- `ai-chat-surface` -> `ai-agent-loop` (`solid`)：启动或中止 runAgent
- `ai-chat-surface` -> `session-artifact-store` (`solid`)：加载保存会话
- `ai-agent-loop` -> `ai-context-tools` (`solid`)：构建上下文和工具
- `ai-context-tools` -> `note-file-repository` (`solid`)：工具读写检索笔记
- `ai-agent-loop` -> `provider-config-proxy` (`solid`)：请求流式模型
- `provider-config-proxy` -> `event-bridge` (`solid`)：emit ai://stream
- `provider-config-proxy` -> `app-config-rules` (`solid`)：读取 provider 和密钥
- `workspace-lifecycle` -> `git-local-history` (`solid`)：初始化仓库并提交
- `workspace-lifecycle` -> `event-bridge` (`solid`)：启动 watcher
- `note-file-repository` -> `git-local-history` (`solid`)：写操作后 commit
- `asset-image-pipeline` -> `note-file-repository` (`solid`)：复用安全路径
- `git-local-history` -> `git-remote-sync-pusher` (`solid`)：提供 ahead/behind
- `note-file-repository` -> `git-remote-sync-pusher` (`solid`)：发送 CommitMade
- `git-remote-sync-pusher` -> `app-config-rules` (`solid`)：读取 git.json 和 secret
- `git-remote-sync-pusher` -> `event-bridge` (`solid`)：emit git-sync-status
- `event-bridge` -> `ui-state-stores` (`solid`)：事件更新前端状态
- `app-config-rules` -> `ui-state-stores` (`dashed`)：hydrate UI 配置

## 4. 模块修改门禁

所有非平凡修改必须先完成模块门禁：

| 字段 | 要求 |
| --- | --- |
| Primary module | 选择一个主模块作为入口；PM 只记录选择，不重新定义边界 |
| Impacted modules | 列出跨模块影响与原因 |
| Change level | L0/L1/L2/L3；L1+ 必须登记 PM 开始和完成记录 |
| Expected artifact | 说明是否需要模块变更设计、架构变更、ADR 或仅 PM 记录 |
| Validation | 记录构建、测试、架构图校验或人工验收证据 |

## 5. 旧 PM 迁移说明

本目录沿用原有外部 PM 根目录 `/Users/zyc/notes/PM/plexus/`。旧 PM 中的状态、命令、风险与历史已迁入 `project-management.md`、`knowledge-summary.md` 与本架构基线；旧文件快照保存在 `archives/`：

- `archives/legacy-project-management-before-modular-2026-07-02.md`
- `archives/legacy-knowledge-summary-before-modular-2026-07-02.md`
- `archives/legacy-architecture-main-before-modular-2026-07-02.md`
- `archives/legacy-module-doc-index-before-modular-2026-07-02.md`

旧版 6 个大模块文档仍保留用于追溯，但不再作为当前模块边界的来源。后续建议运行 `modular-audit`，确认旧文档是否需要归档、重命名或并入新模块文档。

## 6. 校验记录

- 图谱对象数：18 个原子模块、5 个复合模块、28 条依赖关系。
- 每个图谱对象均有对应模块文档，模块文档均带 `review_status` 字段。
- 复合模块文档包含禁止依赖边界，原子模块文档包含职责、文件范围、API/事件、风险与自检清单。
- 渲染 HTML/SVG 由 `render_modular_graph.py` 从 JSON 图谱生成。
- 新版渲染器提示 18 条跨复合模块原子依赖关系；该提醒不否定当前代码依赖事实，已作为 migration gap 记录在 `project-management.md`。
