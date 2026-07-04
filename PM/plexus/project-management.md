# Plexus 项目管理

> 模块化迁移日期：2026-07-02  
> PM 根目录：`/Users/zyc/notes/PM/plexus/`  
> 架构事实来源：`architecture/main-design.md`、`architecture/graphs/current-project.arch.json`、`architecture/modules/`  
> 规则：PM 负责状态、任务、索引和证据，不在本文重新定义模块边界。

## 1. 项目概览

Plexus 是一款 Tauri 2 + React 19 桌面笔记应用，面向本地 Markdown 知识库管理、Git 同步和 AI Agent 辅助写作/修改。项目之前使用传统 PM 文档维护状态与架构摘要，现迁移到模块化工作流：先有架构基线和模块边界，再通过 PM 记录需求、变更、验证和归档。

## 2. 当前状态

| 字段 | 当前值 |
| --- | --- |
| 产品名 | Plexus（2026-06-19 由 GitNote 重命名） |
| 当前代码版本 | v0.4.11 |
| 仓库状态 | GitHub 私有仓库，本地开发与本地 DMG 构建可用 |
| 发布状态 | v0.4.8 为最近 GitHub Release；v0.4.9+ 因 GitHub Actions billing/spending limit 未发布 |
| 模块化状态 | 已迁移当前架构基线；旧 PM 历史已归档 |
| 当前活动任务 | 无；后续 L1/L2/L3 修改需要先登记开始记录 |

## 3. 模块化门禁

每个非平凡修改开始前必须记录：

| 门禁项 | 说明 |
| --- | --- |
| Primary module | 单一主模块入口，来自 `architecture/main-design.md` 或模块文档 |
| Impacted modules | 明确跨模块影响；禁止把 PM 当作模块边界来源 |
| Level | L0 文案/注释；L1 单模块；L2 多模块/架构边界；L3 战略/产品级 |
| Artifact | L1 记录 PM 即可；L2 需要模块/架构变更设计；L3 需要 ADR 或路线图决策 |
| Validation | 至少记录构建；按风险增加测试、架构图校验或人工验收 |

## 4. Active Tasks

当前没有活动中的 L1/L2/L3 任务。

## 5. Change Backlog

| ID | 需求/工作项 | Primary module | Impacted modules | Level | 状态 | 优先级 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `REQ-20260704-editor-wysiwyg-refactor` | 编辑器 WYSIWYG 分层重构:保留 block 主体设计,理清块模型/列表模型/可编辑单元契约/光标映射层,修复列表键盘操作、跨块方向键、IME 输入三类光标问题 | `markdown-module-engine` | `editor-draft-lifecycle` | L2 | done | P1 | 无;详见变更设计 `architecture/modules/markdown-module-engine/changes/2026-07-04-editor-wysiwyg-refactor.md` |
| `REQ-20260702-legacy-modular-audit` | 迁移后审计旧 PM 架构文档、历史变更文档和协作规则是否仍有漂移 | `app-config-rules` | `note-authoring-module`, `ai-context-tools`, `sync-config-runtime` | L1 | backlog | P1 | 使用 `modular-audit` 检查并归档/合并遗留文档 |
| `REQ-20260621-ci-billing` | 恢复 GitHub Actions release pipeline，解决 billing/spending limit 阻塞 | `sync-config-runtime` | `git-local-history`, `git-remote-sync-pusher` | L1 | blocked-external | P1 | 在 GitHub 恢复 Actions 额度后重跑 release workflow |
| `REQ-20260623-code-highlight-performance` | 大型代码块高亮性能优化（可选） | `markdown-module-engine` | `editor-draft-lifecycle`, `note-authoring-module` | L1 | backlog | P3 | 先复现性能瓶颈再定优化范围 |
| `REQ-20260621-state-snapshot-test` | 为 AI 修改后的状态快照门禁补集成测试 | `ai-context-tools` | `ai-agent-loop`, `ai-agent-workbench` | L1 | backlog | P3 | 增加自动化测试覆盖 |
| `REQ-20260613-signing` | macOS/Windows 代码签名和 notarization | `sync-config-runtime` | `git-remote-sync-pusher`, `app-config-rules` | L2 | backlog | P3 | 需要证书和发布策略决策 |

## 6. Modular Design Index

### 6.1 主设计与图谱

| Artifact | 路径 | 状态 |
| --- | --- | --- |
| 主架构设计 | `architecture/main-design.md` | current |
| 架构图 JSON | `architecture/graphs/current-project.arch.json` | current |
| 渲染 HTML | `architecture/rendered/current-project-architecture.html` | current |
| 渲染 SVG | `architecture/rendered/current-project-architecture.svg` | current |

### 6.2 当前模块文档

| Module ID | 名称 | 类型 | 状态 | 路径 |
| --- | --- | --- | --- | --- |
| `frontend-shell-state` | 前端 Shell 与状态组合 | composite / layout-style | draft / not-reviewed | `architecture/modules/frontend-shell-state.md` |
| `note-authoring-module` | 笔记作者体验组合 | composite / function-flow | draft / not-reviewed | `architecture/modules/note-authoring-module.md` |
| `ai-agent-workbench` | AI Agent 工作台组合 | composite / function-flow | draft / not-reviewed | `architecture/modules/ai-agent-workbench.md` |
| `backend-workspace-runtime` | 后端工作区运行时组合 | composite / adapter-io | draft / not-reviewed | `architecture/modules/backend-workspace-runtime.md` |
| `sync-config-runtime` | 同步与配置运行时组合 | composite / event-message | draft / not-reviewed | `architecture/modules/sync-config-runtime.md` |
| `app-shell-layout` | 应用 Shell 布局 | atomic / layout-style | draft / not-reviewed | `architecture/modules/app-shell-layout.md` |
| `ui-state-stores` | 前端状态 stores | atomic / data-state | draft / not-reviewed | `architecture/modules/ui-state-stores.md` |
| `tauri-service-adapters` | Tauri 前端服务适配 | atomic / interface-object | draft / not-reviewed | `architecture/modules/tauri-service-adapters.md` |
| `note-tree-search` | 笔记树与搜索流 | atomic / function-flow | draft / not-reviewed | `architecture/modules/note-tree-search.md` |
| `editor-draft-lifecycle` | 编辑器草稿生命周期 | atomic / data-state | draft / not-reviewed | `architecture/modules/editor-draft-lifecycle.md` |
| `markdown-module-engine` | Markdown 模块编辑引擎 | atomic / function-flow | draft / not-reviewed | `architecture/modules/markdown-module-engine.md` |
| `ai-chat-surface` | AI 聊天界面 | atomic / layout-style | draft / not-reviewed | `architecture/modules/ai-chat-surface.md` |
| `ai-agent-loop` | AI Agent 循环 | atomic / function-flow | draft / not-reviewed | `architecture/modules/ai-agent-loop.md` |
| `ai-context-tools` | 上下文与工具注册 | atomic / config-rule | draft / not-reviewed | `architecture/modules/ai-context-tools.md` |
| `provider-config-proxy` | Provider 配置与流式代理 | atomic / adapter-io | draft / not-reviewed | `architecture/modules/provider-config-proxy.md` |
| `workspace-lifecycle` | 工作区生命周期 | atomic / interface-object | draft / not-reviewed | `architecture/modules/workspace-lifecycle.md` |
| `note-file-repository` | 笔记文件仓储 | atomic / adapter-io | draft / not-reviewed | `architecture/modules/note-file-repository.md` |
| `asset-image-pipeline` | 图片资产管线 | atomic / adapter-io | draft / not-reviewed | `architecture/modules/asset-image-pipeline.md` |
| `session-artifact-store` | 会话与内部资源存储 | atomic / resource-file | draft / not-reviewed | `architecture/modules/session-artifact-store.md` |
| `git-local-history` | 本地 Git 历史 | atomic / adapter-io | draft / not-reviewed | `architecture/modules/git-local-history.md` |
| `git-remote-sync-pusher` | 远端 Git 同步调度器 | atomic / event-message | draft / not-reviewed | `architecture/modules/git-remote-sync-pusher.md` |
| `event-bridge` | Tauri 事件桥 | atomic / event-message | draft / not-reviewed | `architecture/modules/event-bridge.md` |
| `app-config-rules` | 应用配置规则 | atomic / config-rule | draft / not-reviewed | `architecture/modules/app-config-rules.md` |

### 6.3 旧架构文档

旧 6 模块文档与旧 PM 历史已归档或标记为 legacy，不作为当前边界来源。索引见 `archives/legacy-module-doc-index-before-modular-2026-07-02.md`。

## 7. Roadmap

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| M0 | 完成旧 PM 到模块化工作流迁移 | done (2026-07-02) |
| M1 | 对旧文档、历史设计、AI 协作入口做一次 modular-audit | next |
| M2 | 恢复 GitHub Actions release pipeline | blocked by external billing |
| M3 | 针对编辑器与 AI 工具补高价值回归测试 | backlog |

## 8. Milestones

| 日期 | 事件 | 证据 |
| --- | --- | --- |
| 2026-06-13 | 首次 GitHub Release v0.1.0；建立 CI/release 基础 | legacy PM archive |
| 2026-06-19 | GitNote 更名为 Plexus | legacy PM archive |
| 2026-06-21 | v0.4.8 正式 release；后续 release 受 GitHub billing 阻塞 | legacy PM archive |
| 2026-07-02 | 迁移为模块化工作流 | 本文档与架构基线 |

## 9. Testing / Validation

| 场景 | 命令/方法 | 最近结论 |
| --- | --- | --- |
| Web/React 构建 | `npm run build` | 2026-07-04 通过(编辑器重构后复核);2026-07-02 通过；Vite 仅提示部分 chunk 超过 500 kB(既有,与本次改动无关) |
| 编辑器模块测试 | `npx vitest run` | 2026-07-04 通过,99 个测试文件、658 个测试全部通过(含编辑器 WYSIWYG 重构新增的 IME 守卫、跨块空行导航、列表续行回车等回归用例) |
| TypeScript 类型检查 | `npx tsc --noEmit` | 2026-07-04 通过 |
| Tauri/Rust 测试 | `npm run rust:test` | 旧 PM 记录可用；按变更风险执行 |
| 全量测试 | `npm run test:run` | 旧 PM 记录可用；按变更风险执行 |
| 本地 DMG | `npm exec tauri -- build --target universal-apple-darwin` 或项目脚本 | 旧 PM 记录 v0.4.11 本地 DMG 可用 |
| 架构图校验 | 校验 graph JSON、模块文档、rendered HTML/SVG | 2026-07-02 通过；渲染器报告 18 条跨复合模块原子依赖提醒，已记录为 migration gap |

## 10. Migration Gaps

| Gap | 证据 | 处理方式 |
| --- | --- | --- |
| 跨复合模块关系仍直接连接原子模块 | `render_modular_graph.py` 生成 HTML/SVG 时报告 18 条跨层级提醒 | 暂不改写项目事实；后续用 `modular-audit` 或 `modular-architecture` 判断是否引入 group.interface |
| 旧 6 模块文档仍保留在 `architecture/modules/` | 旧 PM 时代模块名与新 23 个模块基线并存 | 已标记 legacy；下一步审计后归档、合并或重定向 |

## 11. Blockers / Risks

| 风险 | 影响 | 当前处理 |
| --- | --- | --- |
| GitHub Actions billing/spending limit | 无法自动产出 v0.4.9+ release artifact | 外部恢复后重跑 workflow |
| 私有仓库 | 用户无法直接下载 release | 公开仓库或提供 release artifact 前仍受限 |
| unsigned package | macOS/Windows 安装体验受影响 | 签名/notarization 作为可选 L2 backlog |
| 旧 PM 文档与新模块边界并存 | 后续 Agent 可能误读旧边界 | 已记录 legacy；建议下一步 `modular-audit` |

## 12. ADR Summary

| ADR | 结论 | 状态 |
| --- | --- | --- |
| ADR-20260613-draft-release | release workflow 默认 draft release，避免公开半成品 | accepted |
| ADR-20260613-universal-macos | macOS 主产物采用 universal target | accepted |
| ADR-20260613-private-repo | 当前阶段保持 GitHub private | accepted |
| ADR-20260619-rename-plexus | 产品名从 GitNote 改为 Plexus | accepted |
| ADR-20260702-modular-workflow | 外部 PM 目录迁移为模块化工作流，架构基线优先 | accepted |

## 13. Archive

| 类型 | 路径 | 说明 |
| --- | --- | --- |
| 旧 PM | `archives/legacy-project-management-before-modular-2026-07-02.md` | 迁移前状态、版本、历史记录 |
| 旧知识 | `archives/legacy-knowledge-summary-before-modular-2026-07-02.md` | 迁移前命令、故障、决策记录 |
| 旧主架构 | `archives/legacy-architecture-main-before-modular-2026-07-02.md` | 旧 6 模块架构总览 |
| 旧模块索引 | `archives/legacy-module-doc-index-before-modular-2026-07-02.md` | 旧模块文档和 nested change docs 列表 |
| 历史 PM | `archives/project-management-history-2026.md` | 更早的项目历史归档 |

## 14. Recent Updates

- 2026-07-04: 完成编辑器 WYSIWYG 分层重构（L2，primary `markdown-module-engine`）。块模型层显式建模「尾随空行吸收」（`contentEndOffset`/`moduleContent`），`findModuleByDocumentOffset` 重写为确定性单次遍历;`listTree.ts`+`subModules.ts` 合并为 `listModel.ts`;新增 `EditableUnit` 契约移除活动列表项伪造 `MarkdownModuleRange` 的写法;`ModuleTextarea.handleKeyDown` 新增 IME 合成态守卫（修复候选确认键被结构逻辑误拦截）;`renderedOffsetMapping.ts` 改名 `caretMapping.ts` 并新增 `caretForVerticalEntry` 去重跨块列位计算;`handleModuleChange`/`handleBoundaryDelete` 收拢到统一 `commitAndReposition`。详见 `architecture/modules/markdown-module-engine/changes/2026-07-04-editor-wysiwyg-refactor.md` 与仓库内 `docs/superpowers/specs/2026-07-04-editor-wysiwyg-refactor-design.md`。验证:658/658 测试、`tsc --noEmit`、`npm run build` 均通过。
- 2026-07-02: 迁移旧 PM 管理方式到模块化工作流；从 `PMAD` 当前架构图同步 5 个复合模块、18 个原子模块、28 条依赖关系；保留旧 PM/知识/架构快照。
