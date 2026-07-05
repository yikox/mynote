---
status: implemented
review_status: reviewed
---

> Implemented 2026-07-05：6 提交 `dc3c605..da109dd` 已 fast-forward 合并进 `fix/editor-external-banner-false-positive`；主工作区 vitest 699/699、cargo 87/87、tsc、build 全绿。未 push（本地领先 origin 7）。

# AI 只读 Git 检视工具集（L2 模块变更）

Level: L2

Primary module: `ai-context-tools`

Impacted modules: `git-local-history`（后端 git2 只读函数+命令）、`tauri-service-adapters`（gitService）、`ai-agent-loop`（ToolContext.git 接线）、AIConfig（工具开关面）

Accepted by: 用户于 2026-07-05 经 brainstorming 逐项裁定并 invoke modular-autopilot 授权执行

Review: modular-autopilot intake 折叠评审（内部一致、模块图对齐 main-design、命令就绪）

完整设计（权威、含全部工具 schema/后端函数/安全边界/测试）: 仓库 `docs/superpowers/specs/2026-07-05-ai-git-readonly-tools-design.md`（commit dc3c605）

## 摘要

给 AI 一组**只读** Git 检视工具（基于后端已有的 git2 库，工作区内，无 shell、无 `git <任意参数>` 透传）。恢复笔记不新增写工具——靠组合 `read_note_at`（读回历史内容）+ 现有 `update_note`（带确认+diff 写回）。

工具（5 个，全 `write:false`）：
- `git_log(path?, limit?)` — 提交历史，可按笔记过滤。
- `read_note_at(path, rev)` — 某历史版本完整内容。
- `git_diff(path?, from?, to?)` — 两版本 / 版本↔工作区 / 工作区↔HEAD 差异（超长截断）。
- `git_status()` — 工作区改动 + 分支/HEAD。
- `git_show_commit(rev, includeDiff?)` — 提交元信息 + 改动文件（+可选 diff）。

## 契约影响（均为新增、additive）

- 后端 `git-local-history`：新增只读命令 `git_log`/`git_show_file`/`git_diff`/`git_status`/`git_show_commit`（git2，工作区内安全路径）。
- `ToolContext` 增 `git`；`ToolDomain` 增 `'git'`；`ToolCategory` 增 `'history'`。
- `TOOL_REGISTRY` 增 5 个 def；`buildDispatcher` 的 ctx 增 `git: gitService`。
- 不改任何既有工具/命令的对外契约。

## 安全边界（Global Constraints，实施须逐条守）

- 全只读：仅用 git2 读 API，不改仓库/工作区/索引；无写工具。
- 工作区内：`path` 走现有笔记命令的安全路径解析，拒绝越界。
- 无透传：`rev` 交 `git2::revparse_single`（解析 ref/hash，无 hook/`-c`/shell 面）。
- 输出有界：diff/内容按 `MAX_TOOL_RESULT_CHARS` 截断并注明。
- 排除：restore/commit/push/branch/merge/reset/checkout、`git config`/remote、任意参数透传。

## 验证

Rust 临时仓 git2 单测（log 含 path 过滤 / show_file / diff 三语义 / status / show_commit）；前端 def 测试 mock gitService；`npm run test:run`、`npm run build`、`npm run rust:test`。

## 交接

modular-autopilot 执行：writing-plans → HEAD 基 worktree SDD → pending-merge 报告。基线/PM 完成待用户合并后落。
