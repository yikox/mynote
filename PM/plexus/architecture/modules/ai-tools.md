# AI 工具 AI Tools 模块设计

Last updated: 2026-06-23

Status: implemented

## 目的

定义并注册供 AI Agent 调用的工具：笔记读写、列举、检索、联网搜索。负责工具 schema、执行器、写操作的确认策略与 Diff 回执。

## 职责

- 工具定义（`src/ai/tools/defs/`）：`readNote`、`listNotes`、`searchNotes`、`createNote`、`updateNote`、`deleteNote`、`moveNote`、`webSearch`，各含 schema + execute。
- 注册表（`registry.ts`/`index.ts`）：聚合为 `TOOL_REGISTRY`、导出 `tools`（schema 数组）、`WRITE_TOOLS`（写工具名集合）。
- 写工具守卫：path 必须显式、非空、`.md` 结尾、不可省略沿用上次；空 path 直接回可执行报错，绝不带空路径下发后端。
- 工具结果展示与预览（`toolPreview.ts`/`toolResultDisplay.ts`）、写成功 Diff 回执（`textDiff.ts` + UI `DiffView`）。

## 边界

- In scope：工具 schema、execute 逻辑、写守卫、结果格式化、Diff 回执生成。
- Out of scope：何时调用工具与确认 UI 调度（属 AI Agent / AIChat 的 `ConfirmToolDialog`）；笔记落盘实现（Notes 模块 / Rust `core::notes`）；联网搜索 HTTP（Rust `web_search`/Tavily）。

## 接口与契约

- 工具 execute 经 `src/services/*`（`notes.ts`/`webSearch.ts`）→ Tauri 命令（`update_note`/`search_notes`/`tavily_search` 等）。
- 写工具描述显式要求 `path` 相对路径、`.md` 结尾、每次必传（v0.4.3 起强化），从描述层降低模型漏传 path。
- 写成功返回「成功 + Diff」JSON 回执，供模型在思维链中合并原文+差异、感知最新状态，免去为确认而重复 `read_note`。

## 数据与状态

- 工具本身无状态；执行结果回灌 AI Agent 的上下文与会话历史。
- 写操作自动放行开关在 `aiConfigStore` 的 `perToolWriteAutoAllow`（默认全 false → 手动确认，而非关闭工具）。

## 运行流程

- 模型发起 tool_call → AI Agent 取对应执行器 → 写工具先过守卫（path 非空校验）→ 写操作按策略弹 `ConfirmToolDialog` → service → Rust 命令 → 成功生成 Diff 回执回灌。

## 依赖

- AI Agent（调度与确认）。
- Notes（`services/notes.ts` → Rust `core::notes`）。
- Rust `web_search`（Tavily 联网搜索）。

## Planned Changes

> 仅列已写 spec、尚未实现的设计变更；当前无此类条目。

| Date | Change | Status | Spec | Detail |
| --- | --- | --- | --- | --- |
| — | （暂无） | — | — | — |

## 风险与开放问题

- **空 path 写入根目录（已防御）**：空相对路径在 `resolve(root,"")` 下塌缩到工作区根目录，对目录 `fs::write` → EISDIR。双层防御：工具层校验非空 + Rust `write_file` 拒绝空/目录目标。
- 工具结果折叠须仅作用于*结果*，绝不折叠会被回传的调用参数（见 ai-agent 模块原则）。
