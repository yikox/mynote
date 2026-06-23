# AI Agent 模块设计

Last updated: 2026-06-23

Status: implemented

## 目的

编排 Plexus 的 AI 会话：驱动「调用模型 → 执行工具 → 回灌结果」的 agent loop，管理上下文构建、按模型窗口的预算与压缩、状态快照、系统提示分层、模型限额，并经 Rust 端代理流式对接 OpenAI 兼容 provider。

## 职责

- Agent loop（`src/ai/agentLoop.ts`）：发起补全、解析工具调用、调度 AI Tools 执行、把结果回灌为下一轮上下文，直到无更多工具调用。
- 上下文构建与预算（`contextBuilder.ts`）：`contextBudgetTokens(limits, config)` —— 设了模型窗口就用「窗口 − `maxOutputTokens` − `marginTokens`」，**不被默认上限封顶**；无窗口时退回 `budgetCapTokens`（默认 256*1024）。
- 压缩与状态快照（`completion.ts`/`stateSnapshot.ts`/`snapshotStore`）：超 `snapshotTriggerRatio`（默认 0.8）阈值时，裁切旧轮前先注入模型蒸馏的「状态快照」（任务目标/关键决定/笔记最新状态/待办）。
- 系统提示分层（`systemPrompt.ts`）：`buildSystemPrompt` 把工作区 `.plexus/system-prompt.md` 作为全局规则，追加到预设非空 `systemPromptTemplate` 之后；`default-agent`（null prompt）仍以该文件为角色、不双重追加。
- 预设 agent 与配置（`aiConfigStore`）：内置 4 个预设（通用/研究/笔记管家/写作），按版本批次播种、按 id 恢复默认。
- 模型限额（`modelLimits.ts`）：上下文窗口/输出上限等。

## 边界

- In scope：会话编排、上下文/预算/压缩/快照、系统提示组装、AI 配置与预设、token 估算（`tokenEstimate.ts`）、上下文变换（`contextTransforms.ts`，含 `foldNoteReads` 等结果折叠）。
- Out of scope：工具的具体实现与 schema（属 AI Tools 模块）；流式 HTTP 与 SSE 解析（Rust `core::ai_proxy`，本模块经 `services/ai.ts` 消费）；聊天 UI 组件（属 UI Shell / AIChat）。

## 接口与契约

- `services/ai.ts` → Tauri `ai_chat`（流式）、`ai_model_info`；Rust `core::ai_proxy` 用 reqwest + eventsource-stream 转发到用户 provider。
- 工具调度：通过 AI Tools 的 `TOOL_REGISTRY`/`WRITE_TOOLS` 取 schema 与执行器；写工具按执行策略（`ExecPolicy`，`perToolWriteAutoAllow`）决定是否弹确认。
- 持久化：会话经 `services/sessions.ts` → Rust `sessions` 落 `<workspace>/.plexus/sessions/*.json`（完整 messages + tool_calls.arguments）。

## 数据与状态

- `aiConfigStore`：模型/温度/工具集/联网开关/预算配置 + 预设模板 + 播种版本（`presetSeedVersion`）+ 迁移（`aiConfigStore.migration.test.ts`）。
- `sessionsStore`：会话列表与当前会话。`snapshotStore`：状态快照缓存（带增量扩展）。`chatDraftsStore`：按 sessionId 键控的输入草稿（纯内存）。`providersStore`：provider 配置。`agentStatusStore`/`aiRunsStore`：运行态/进度。

## 运行流程

1. 发送：UI 收集用户输入（含 `@` 引用笔记、图片）→ 组装消息。
2. 上下文：系统提示分层 + 历史 + 快照（必要时）→ 按 `contextBudgetTokens` 估算，超预算先快照后裁旧轮。
3. 补全：`ai_chat` 流式拉取 → 解析增量与工具调用。
4. 工具：调度 AI Tools 执行；写操作按策略确认，成功返回 Diff 回执回灌历史。
5. 循环：有工具调用则带结果再进一轮；无则结束。
6. 持久化：落 sessions。

## 依赖

- AI Tools（工具 schema + 执行器）。
- Rust `core::ai_proxy`（流式补全）、`core::providers`/`core::secrets_store`（provider 与 API key）。
- Notes（工具最终读写笔记）。

## Planned Changes

> 仅列已写 spec、尚未实现的设计变更；当前无此类条目（无 spec 的想法/待办见 PM `待办`）。

| Date | Change | Status | Spec | Detail |
| --- | --- | --- | --- | --- |
| — | （暂无） | — | — | — |

## 风险与开放问题

- **占位串回写死循环（已根除）**：旧「活动工作集」`foldWriteArgs` 折叠写工具参数会被模型照抄回写覆盖笔记，已整体移除。原则：绝不折叠会被回传的、长得像正文/参数的占位串；只折叠工具结果安全。
- 上下文预算依赖 provider 上报的模型窗口；窗口缺失时退回 `budgetCapTokens` 默认上限。
