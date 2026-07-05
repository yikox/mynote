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
| `BUG-20260704-editor-input-scroll-jump` | 输入时视口被动往下跳、光标被甩到页面下方(尤其表格/列表连续输入) | `markdown-module-engine` | 无 | L1 | done | P1 | 无;根因与修复见下方 Recent Updates 与 knowledge-summary |
| `REQ-20260704-agent-runtime-port` | AI 编排层依赖注入端口（AgentRuntime）：打破 4 个编排文件对 store 单例的穿透，使编排层依赖抽象端口/参数注入、可隔离测试；正式区分 ai-core/ai-orchestration 子层 + guard 测试 | `ai-agent-loop` | `ai-context-tools`, `ai-chat-surface`, `ui-state-stores`(约束级) | L3 | **implemented**（2026-07-05） | P2 | 完成：8 提交经合并 `6273593` 落 `fix/editor-external-banner-false-positive`、已推 origin、用户测试确认；合并后 682/682+tsc+build 绿，worktree 已清理。设计标 implemented，ADR accepted。剩余可选：main-design 正式登记 ai-core/ai-orchestration 子层 + materializeImages 归属、图刷新。设计/ADR 见 Design Index |
| `REQ-20260705-ai-git-readonly-tools` | AI 只读 Git 检视工具集：`git_log`/`read_note_at`/`git_diff`/`git_status`/`git_show_commit`（全只读、git2、工作区内、无 shell/透传）；恢复靠组合 read_note_at+update_note，不加任何 git 写工具 | `ai-context-tools` | `git-local-history`, `tauri-service-adapters`, `ai-agent-loop`, AIConfig | L2 | accepted · implemented-in-branch, pending-merge | P2 | **待用户合并** `feat/ai-git-tools`（6 提交 dc3c605..da109dd；合并后需回 fix/editor-... 分支）。SDD 每 task spec✅+quality Approved，opus 终评 READY TO MERGE；worktree 内 vitest 699/699、cargo 87/87、tsc、build 绿。计划 `.../plans/2026-07-05-ai-git-readonly-tools-plan.md`，决策/进度存 plans/archive/。合并后落基线+PM complete |
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
| 模块化评估（前端） | 仓库 `docs/modularization/2026-07-04-assessment.md` | 证据快照 2026-07-04 |
| L3 架构变更 · AgentRuntime 端口 | `architecture/changes/2026-07-04-agent-runtime-port.md` | accepted（未实施） |
| ADR · AgentRuntime 端口 | `architecture/adrs/ADR-2026-07-04-agent-runtime-port.md` | accepted |

### 6.2 当前模块文档

| Module ID                   | 名称                    | 类型                      | 状态                 | 路径                                                |
| --------------------------- | ----------------------- | ------------------------- | -------------------- | --------------------------------------------------- |
| `frontend-shell-state`      | 前端 Shell 与状态组合   | composite / layout-style  | draft / not-reviewed | `architecture/modules/frontend-shell-state.md`      |
| `note-authoring-module`     | 笔记作者体验组合        | composite / function-flow | draft / not-reviewed | `architecture/modules/note-authoring-module.md`     |
| `ai-agent-workbench`        | AI Agent 工作台组合     | composite / function-flow | draft / not-reviewed | `architecture/modules/ai-agent-workbench.md`        |
| `backend-workspace-runtime` | 后端工作区运行时组合    | composite / adapter-io    | draft / not-reviewed | `architecture/modules/backend-workspace-runtime.md` |
| `sync-config-runtime`       | 同步与配置运行时组合    | composite / event-message | draft / not-reviewed | `architecture/modules/sync-config-runtime.md`       |
| `app-shell-layout`          | 应用 Shell 布局         | atomic / layout-style     | draft / not-reviewed | `architecture/modules/app-shell-layout.md`          |
| `ui-state-stores`           | 前端状态 stores         | atomic / data-state       | draft / not-reviewed | `architecture/modules/ui-state-stores.md`           |
| `tauri-service-adapters`    | Tauri 前端服务适配      | atomic / interface-object | draft / not-reviewed | `architecture/modules/tauri-service-adapters.md`    |
| `note-tree-search`          | 笔记树与搜索流          | atomic / function-flow    | draft / not-reviewed | `architecture/modules/note-tree-search.md`          |
| `editor-draft-lifecycle`    | 编辑器草稿生命周期      | atomic / data-state       | draft / not-reviewed | `architecture/modules/editor-draft-lifecycle.md`    |
| `markdown-module-engine`    | Markdown 模块编辑引擎   | atomic / function-flow    | draft / not-reviewed | `architecture/modules/markdown-module-engine.md`    |
| `ai-chat-surface`           | AI 聊天界面             | atomic / layout-style     | draft / not-reviewed | `architecture/modules/ai-chat-surface.md`           |
| `ai-agent-loop`             | AI Agent 循环           | atomic / function-flow    | draft / not-reviewed | `architecture/modules/ai-agent-loop.md`             |
| `ai-context-tools`          | 上下文与工具注册        | atomic / config-rule      | draft / not-reviewed | `architecture/modules/ai-context-tools.md`          |
| `provider-config-proxy`     | Provider 配置与流式代理 | atomic / adapter-io       | draft / not-reviewed | `architecture/modules/provider-config-proxy.md`     |
| `workspace-lifecycle`       | 工作区生命周期          | atomic / interface-object | draft / not-reviewed | `architecture/modules/workspace-lifecycle.md`       |
| `note-file-repository`      | 笔记文件仓储            | atomic / adapter-io       | draft / not-reviewed | `architecture/modules/note-file-repository.md`      |
| `asset-image-pipeline`      | 图片资产管线            | atomic / adapter-io       | draft / not-reviewed | `architecture/modules/asset-image-pipeline.md`      |
| `session-artifact-store`    | 会话与内部资源存储      | atomic / resource-file    | draft / not-reviewed | `architecture/modules/session-artifact-store.md`    |
| `git-local-history`         | 本地 Git 历史           | atomic / adapter-io       | draft / not-reviewed | `architecture/modules/git-local-history.md`         |
| `git-remote-sync-pusher`    | 远端 Git 同步调度器     | atomic / event-message    | draft / not-reviewed | `architecture/modules/git-remote-sync-pusher.md`    |
| `event-bridge`              | Tauri 事件桥            | atomic / event-message    | draft / not-reviewed | `architecture/modules/event-bridge.md`              |
| `app-config-rules`          | 应用配置规则            | atomic / config-rule      | draft / not-reviewed | `architecture/modules/app-config-rules.md`          |

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
| ADR-20260704-agent-runtime-port | AI 编排层依赖注入端口而非直连 store 单例；正式区分 ai-core/ai-orchestration 子层 | accepted |

## 13. Archive

| 类型 | 路径 | 说明 |
| --- | --- | --- |
| 旧 PM | `archives/legacy-project-management-before-modular-2026-07-02.md` | 迁移前状态、版本、历史记录 |
| 旧知识 | `archives/legacy-knowledge-summary-before-modular-2026-07-02.md` | 迁移前命令、故障、决策记录 |
| 旧主架构 | `archives/legacy-architecture-main-before-modular-2026-07-02.md` | 旧 6 模块架构总览 |
| 旧模块索引 | `archives/legacy-module-doc-index-before-modular-2026-07-02.md` | 旧模块文档和 nested change docs 列表 |
| 历史 PM | `archives/project-management-history-2026.md` | 更早的项目历史归档 |

## 14. Recent Updates

- 2026-07-05（REQ-20260705-ai-git-readonly-tools，L2，implemented-in-branch/pending-merge）: modular-autopilot 执行 AI 只读 Git 工具集完成，绿色分支待用户合并。5 只读工具（git_log/read_note_at/git_diff/git_status/git_show_commit），后端 git2 只读函数→Tauri 命令→gitService→tool defs，全 write:false、工作区内、无 shell/透传；恢复靠 read_note_at+update_note 组合，未加 git 写工具。6 提交 `dc3c605..da109dd` 在 `feat/ai-git-tools`（基于 fix/editor-... HEAD 的 worktree）。SDD 每 task 双评通过，opus 终评 READY TO MERGE，无 Critical/Important；worktree 内 vitest 699/699、cargo 87/87、tsc、build 全绿。遗留 4 个 cosmetic Minor（status catch-all→modified / git_log limit:0 强制 / gitDiff 本地 8000 与全局 trimResult 冗余 / workspace mutex unwrap 同既有范式）不阻塞。**未 push/merge**（autopilot 规矩）。下一步：用户合并回 fix/editor-... 分支后，我落基线（main-design 加 git 工具/命令）+ 设计置 implemented + PM complete + 清理 worktree。

- 2026-07-05 done（REQ-20260704-agent-runtime-port，L3，implemented）: AgentRuntime 依赖注入端口经 autopilot 执行完成并落地。8 提交（`7c959b3..3079189`）→ `--no-ff` 合并 `6273593` 进 `fix/editor-external-banner-false-positive`，已推 origin，用户测试确认行为正常。合并后全量 682/682、`tsc`、`build` 绿；guard 3/3。worktree/临时分支已清理。设计置 `implemented`，`ADR-20260704` accepted。剩余可选收尾（不阻塞）：`main-design.md` 正式登记 ai-core/ai-orchestration 子层与 `materializeImages.ts` 归 `ai-agent-loop`、刷新架构图。

- 2026-07-05 done（PERF-20260705-chat-stream-render，L1，primary `ai-chat-surface`，commit 5ca076d）: 修复 AI 流式回复时消息渲染断裂/空白/卡顿。诊断=性能为主：`agentLoop` 每 token `setMessages` 整表刷新 + `MessageItem` 未 memo + `ReactMarkdown`/rehype 高亮每次对整条消息重跑（含已完成代码块）→ O(n²)；叠加自动贴底只在消息条数变化触发（不跟随同一条流式增长）。修复（全在组件层、不动 agentLoop，规避原地修改消息对象致引用相等的 memo 坑）：①抽 `MarkdownBody=memo(按 text 字符串值比较)`——已完成消息等值 text 跳过重高亮，只流式那条重渲染；②`ChatMarkdown` 用 `useDeferredValue` 节流；③`MessageList` 贴底依赖加最后一条内容长度，跟随流式增长。验证 674/674、tsc、build。前序链接修复见 BUG-20260705；提交序列 9f90d17/8cfe21e/2149a5c/c136a00/5ca076d。

- 2026-07-05 done（BUG-20260705-link-fullpage-nav，L1，primary `markdown-module-engine`，impacted `app-shell-layout`/`ai-chat-surface`）: 修复点击笔记内**列表项**里的相对链接（`- [xxx](./README.md)`）导致 webview 整页跳转、SPA 被原始乱码替换。**真正根因**（前两次误诊，靠用户精确复现路径定位）：`ModuleMarkdownEditor.renderListNodes` 里列表项文本外的 `<span onClick>` 为「点列表项进入编辑」调用了 `event.stopPropagation()`——链接 `<a>` 就在该 span 内，点链接时 stopPropagation 把事件掐死，既不冒泡到容器 `handleClick`（那里才 `preventDefault`+路由）也不到 document（全局守卫），而它**只 stopPropagation 未 preventDefault**，`<a>` 原生跳转照常发生。教训：应先按精确复现路径定位，勿臆断/逐 surface 猜（systematic-debugging）。**修复（真正的一行）**：列表项 onClick 若 `event.target.closest('a')` 则直接 return，不激活编辑、不阻断冒泡，交给容器/守卫正常拦截路由（编辑器按当前笔记路径解析，正确）。另保留两层防御补强：`useLinkNavigationGuard`（`AppShell`，document 冒泡兜底任何未拦截 `<a>`）+ 聊天 `MessageItem` 的 `MarkdownAnchor`。已核实编辑器内仅列表项这一处 stopPropagation 吞链接（checkbox 那处无链接）。改动：`ModuleMarkdownEditor.tsx(.test.tsx +1 复现回归)`、`Layout/useLinkNavigationGuard.ts(.test.tsx)`、`AppShell.tsx`、`AIChat/MessageItem.tsx(.test.tsx)`。验证：674/674、`tsc`、`build` 通过。**未提交**（主工作区有编辑器 WIP）；需重载 app 生效。遗留（低）：`resolveLink` 被三处 import（现居 `Editor/linkClickExtension`），宜移共享位置。

- 2026-07-04: 用户接受 `REQ-20260704-agent-runtime-port` L3 方向并裁定 4 个开放问题：Q1 一并完成 4 个编排文件（agentLoop+systemPrompt+stateSnapshot+materializeImages）；Q2 ai-core/ai-orchestration 落为正式子层但仍隶属现有 AI 模块（不新建顶层）；Q3 落 ADR；Q4 图/基线实施后再更新、实施前不覆盖当前图。已据此更新 change 设计（status: accepted、restage 为 4 阶段、sibling 用参数注入不扩张端口）、创建 ADR-20260704-agent-runtime-port（accepted）。**未实施、未动基线**。下一步：`writing-plans` 出实现计划 → `modular-change`/`modular-autopilot` 实施。
- 2026-07-04: modular-review 评审 `REQ-20260704-agent-runtime-port` 提案。结论：内部一致、L3 六项要素齐全、PM/设计/索引状态同步。修正 1 处内部矛盾（Stage 3 通用 import-lint 会打断同样穿透 store 的 `systemPrompt`/`stateSnapshot`/`materializeImages`，已把 Stage 3 lint 收窄为仅 agentLoop，通用化推迟至 Stage 4 后）。记录 4 个开放问题（Q1 lint 排序 / Q2 ai-core-orchestration 子层横切 `ai-context-tools` 边界 / Q3 接受时落 ADR / Q4 图更新）。未置 reviewed：留 L3 人工接受 + Q1/Q2 待决。不越权接受 L3 方向。
- 2026-07-04: 起草 P1 重构提案（modular-architect，仅提案，未接受/未实施）。L3 架构变更「AgentRuntime 端口」：为 `agentLoop` 引入注入式 `AgentRuntime` 端口（方案 A，单一对象），收拢其对 sessions/agentStatus/providers/aiConfig/confirm/tabs 6 个 store 的穿透，使编排层可隔离测试且单向依赖；分 4 阶段（基线→端口+默认工厂→隔离测试→收口+lint+文档），数据归属不变。核对更正评估措辞：非真 import 环（ai-core 不 import stores），真实缺陷是编排层穿透具体 store 单例。提案：`architecture/changes/2026-07-04-agent-runtime-port.md`（status: proposed）。下一步：`modular-review` → 人工接受。
- 2026-07-04: 完成前端整体模块化评估（modular-architect，仅评估）。整体成熟度 Medium–High：接缝（Tauri invoke 隔离于 services/、无全局可变单例、store 间无静态互 import）成立；风险集中于少数承重边界。Top 痛点：P1 `ai/agentLoop.ts` 穿透 6+ store 单例 + ai↔stores 双向 runtime 耦合；P2 `ModuleMarkdownEditor.tsx` 1456 LOC 巨型组件；P3 AI 笔记工具旁路 `services/notes` 接缝。报告：`docs/modularization/2026-07-04-assessment.md`（证据快照，非基线）。

- 2026-07-04 done（BUG-20260704-editor-external-banner-false-positive，L1，primary `Editor`）: 修复「文件已被外部修改」banner 在纯本地打字时偶发误弹并挤压正文造成闪烁/跳动。
  - 根因①（误报）：后端 `watcher.rs` 对所有写入（含应用自身保存）都发 `notes://changed`，无回声抑制；`useNoteDraft.reconcile` 原来只在 `磁盘===当前草稿` 才认作自写回声，一旦保存后又继续打字（草稿领先磁盘、dirty）就把应用自身写盘的事件误判为 conflict。修复：新增判据 `磁盘 === lastSavedRef(上次我们成功写盘的内容)` 即为自写回声，直接忽略（与 dirty 无关），并顺带清除残留冲突提示。
  - 根因②（闪烁/位移）：`.editor-external-banner` 原为 in-flow 块，插在 `.editor-statusbar` 与 `.markdown-editor__scroll` 之间，出现/消失挤压正文。修复：改为 `position:absolute; top:0` 顶部浮层（z-index:6、elevated 背景 + shadow-md），不再进入正文流；对齐既有 `.editor-statusbar`/`.editor-find-bar` 浮层做法。
  - 改动文件：`src/components/Editor/useNoteDraft.ts`、`src/styles/shell.css`、`src/components/Editor/useNoteDraft.test.tsx`（新增回归「本地打字领先磁盘时应用自身保存事件不误弹冲突」）。
  - 验证：668/668 测试通过（+1）、`tsc --noEmit`、`npm run build` 均通过。
  - 遗留风险（低）：极窄竞态——短时间内两次保存（v1→v2），若 watcher 事件对应的回读恰好取到 v1 而 `lastSavedRef` 已是 v2，仍可能误判一次；受 150ms reconcile 防抖 + 800ms 保存防抖收敛，实际概率极低。若仍复现，可改为「最近自写内容集合」匹配。
- 2026-07-04（BUG-20260704-editor-input-scroll-jump，L1）: 修复 rich 编辑器「输入时视口被动往下跳、光标被甩到页面下方」,并确立「仅换行时自动滚动」的滚动模型。
  - 第一步(消除被动滚动):根因是 `ModuleTextarea` 的命令式 DOM 操作在滚动容器 `.markdown-editor__scroll` 里引发被动滚动——①自适应高度先把 `height` 置 `'auto'` 再读 `scrollHeight`,这次重排会钳制容器 `scrollTop` 且恢复 `height` 不还原它(每次按键都发生,主因);②`focus()`/`setSelectionRange()` 未用 `preventScroll`。均为既有代码,非 WYSIWYG 重构引入。修复:`withNeutralScroll()` 包装三处 useLayoutEffect(挂载聚焦/caretNonce 重定位/自适应高度)先记录再还原 `scrollTop`,并 `focus({ preventScroll: true })`。
  - 第二步(唯一自动滚动=换行):按用户要求确立滚动时机——**只有回车换行**才自动滚动,且仅当光标落点越过「阈值线」(可调变量 `NEWLINE_SCROLL_CARET_RATIO`,默认 0.75,即距视口顶 3/4 / 距底约 1/4)才向下滚回到该线;光标在上 3/4 内回车不滚。实现:`ModuleTextarea` 在回车 keydown 上报 `onNewline` → 父组件置 `pendingNewlineScrollRef` → 父组件 `useLayoutEffect([active])`(在子布局副作用之后运行,能读到最终光标位置)消费该标记,调用 `scrollCaretIntoNewlineZone`;纯计算 `newlineScrollDelta(caretY, viewportH, ratio)` 落在 `caretMapping.ts`。
  - 验证:新增回归(preventScroll 聚焦 x2、被动滚动被还原 x1、`newlineScrollDelta` 单测 x4、换行滚/普通不滚/阈值以上不滚 x3),667/667 测试、`tsc --noEmit`、`npm run build` 均通过。
- 2026-07-04: 完成编辑器 WYSIWYG 分层重构（L2，primary `markdown-module-engine`）。块模型层显式建模「尾随空行吸收」（`contentEndOffset`/`moduleContent`），`findModuleByDocumentOffset` 重写为确定性单次遍历;`listTree.ts`+`subModules.ts` 合并为 `listModel.ts`;新增 `EditableUnit` 契约移除活动列表项伪造 `MarkdownModuleRange` 的写法;`ModuleTextarea.handleKeyDown` 新增 IME 合成态守卫（修复候选确认键被结构逻辑误拦截）;`renderedOffsetMapping.ts` 改名 `caretMapping.ts` 并新增 `caretForVerticalEntry` 去重跨块列位计算;`handleModuleChange`/`handleBoundaryDelete` 收拢到统一 `commitAndReposition`。详见 `architecture/modules/markdown-module-engine/changes/2026-07-04-editor-wysiwyg-refactor.md` 与仓库内 `docs/superpowers/specs/2026-07-04-editor-wysiwyg-refactor-design.md`。验证:658/658 测试、`tsc --noEmit`、`npm run build` 均通过。
- 2026-07-02: 迁移旧 PM 管理方式到模块化工作流；从 `PMAD` 当前架构图同步 5 个复合模块、18 个原子模块、28 条依赖关系；保留旧 PM/知识/架构快照。
