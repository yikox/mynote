---
status: accepted
review_status: reviewed
---

# ADR-2026-07-04：AI 编排层依赖注入端口，而非直连 store 单例

Status: accepted

Date: 2026-07-04

Level: L3

Primary module: `ai-agent-loop`

Related change: `architecture/changes/2026-07-04-agent-runtime-port.md`

Related requirement: `REQ-20260704-agent-runtime-port`

Accepted by: 用户于 2026-07-04 会话内接受

## Context

前端 AI 编排层（`ai-orchestration` 子层：`agentLoop`/`systemPrompt`/`stateSnapshot`/`materializeImages`）在运行时通过 `use*Store.getState()` 直连 6 个具体全局 store 单例（sessions/agentStatus/providers/aiConfig/confirm/tabs）。后果：编排流程无法在不启动这些 store 的前提下隔离测试，且与 store 形状强耦合，任一 store 变更可波及编排层。

（澄清：此处**不存在真正的 import 环**——`ai-core` 子层 `tokenEstimate`/`tools`/`toolPreview` 不 import stores。真实缺陷是编排层对具体 store 单例的**穿透**。）

## Decision

AI 编排层依赖**注入的抽象端口**取用运行态，不再直接依赖具体 store 单例：

- `agentLoop` 经单一 `AgentRuntime` 端口（sessions/status/config/provider/confirm/renameTab）访问状态；默认工厂 `defaultAgentRuntime()` 用现有 store 接线，端口方法内部实时 `getState()` 以保留「读最新」语义。
- 其余编排 sibling（`systemPrompt`/`stateSnapshot`/`materializeImages`）由组合根（`ChatPanel`/`agentLoop`）以**普通参数**下传所需状态，不 import store，也不为无关关切扩张 `AgentRuntime`。
- 正式区分 `ai-core`（纯，无上行依赖）与 `ai-orchestration`（编排）两个子层，以模块粒度 import-lint 固化：ai-orchestration 禁止直连 store；`stores/*` 禁止 import ai-orchestration，但可下行 import ai-core。

## Alternatives Considered

1. **维持 `.getState()` 直连（现状）**——零改动，但编排层不可隔离测试、爆炸半径大。否决。
2. **每协作者一个独立端口接口**（SessionSink/StatusReporter/…共 6 个）——可分别 fake，但接缝与仪式过重，超当前需要（YAGNI）。否决，采用单一 `AgentRuntime` 对象。
3. **仅加 lint + 文档、不做注入**——最省，但不解决核心可测性缺陷（编排层仍穿透 store）。否决。

## Consequences

- 正面：`agentLoop` 可用 fake runtime 在零真实 store 下测试；编排层单向依赖抽象；新增编排流程有明确取用状态的入口。
- 约束（对未来的持久规则）：**所有新增 AI 编排逻辑必须经端口/参数注入取用状态，不得新增 `use*Store` 直连**；import-lint 固化此约束。
- 成本：`AgentRuntime` 端口面含 6 组操作；需保证默认工厂实时 `getState()` 不引入快照回归（已在行为基线用例覆盖）。

## Verification

终态：`agentLoop.test.ts` 注入 fake runtime、不 import 任何真实 store 通过；4 个编排文件均不再 import `use*Store`；ai-orchestration 通用 import-lint 生效。详见关联 change 文档的 Verification Plan。
