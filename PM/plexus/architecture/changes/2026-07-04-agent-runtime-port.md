---
status: accepted
review_status: reviewed
---

# AI 编排层依赖注入端口（AgentRuntime）架构变更 Design

Last updated: 2026-07-04

Status: accepted

Level: L3

Primary module: `ai-agent-loop`

Impacted modules: `ai-context-tools`（Stage 3 迁移 `systemPrompt`/`stateSnapshot` 去 store 直连）、`ai-chat-surface`（`ChatPanel` 作组合根注入 agentTemplate，caller 兼容更新）、`ui-state-stores`（约束级：默认工厂经 `getState()` 接线，不改 store 代码）

> 规划期修正（autopilot 2026-07-04）：impacted 增列 `ai-chat-surface`——设计正文已指明 `ChatPanel` 为 `runAgent`/`buildSystemPrompt` 组合根，此处补齐 frontmatter 以匹配正文。另：`materializeImages.ts` 为孤儿路径，closeout 归入 `ai-agent-loop`。`AgentRuntime` 端口纳入 `snapshot`/`notify`（agentLoop 内部构造 summarizer / 调 materializeImages 所需），仍满足「编排文件不 import store、单一 seam」不变量。import-lint 以 vitest guard 测试实现（项目无 eslint）。

Requirement ID: REQ-20260704-agent-runtime-port

Source: `docs/modularization/2026-07-04-assessment.md`（评估 P1）

Related task: project-management.md → Change Backlog `REQ-20260704-agent-runtime-port`

Related ADR: `architecture/adrs/ADR-2026-07-04-agent-runtime-port.md`

Design status: accepted

Review status: reviewed（modular-review 2026-07-04：内部一致，已修正 Stage 3 lint 范围矛盾；Q1–Q4 已由用户裁定，无遗留阻塞）

Accepted by: 用户于 2026-07-04 会话内接受 L3 方向并裁定 Q1（一并完成 4 个编排文件）、Q2（ai-core/ai-orchestration 落为正式子层，仍在 AI 大范围内）、Q3（落 ADR）、Q4（实施后同步图，实施前不覆盖当前图）

Accepted date: 2026-07-04

Implementation status: implemented-in-branch, pending-merge（代码已在隔离分支落地并全绿，但**未合并**；基线/PM 完成待合并后再落。设计状态保持 accepted，未置 implemented）

Implementation evidence（pending merge）:
- 分支 `worktree-agent-runtime-port`（基于 origin/main `55c69b8`），worktree `.claude/worktrees/agent-runtime-port`。
- 8 次提交 `55c69b8..3079189`：7c959b3(端口) 4ec18b2(agentLoop) 895098e(隔离测试) 4ace1ea(stateSnapshot) 7643bc9(materializeImages) ebb731d(systemPrompt) bcad392(guard) 3079189(guard 加固)。
- 验证：`npx vitest run` 649/649 通过、`npx tsc --noEmit` 无错、`npm run build` 成功；guard 3/3；4 个编排文件不再 import store（`src/ai/**` 除 runtime.ts 外零 store 引用）。
- 决策日志/进度：`architecture/plans/archive/2026-07-04-agent-runtime-port-decisions.md`、`-progress.md`。
- SDD 评审：每 task spec✅+quality Approved；最终全分支评审（opus）READY TO MERGE，无 Critical/Important，3 个 Minor 已修（guard 加固 2 项 + runtime export 位置）。

> 角色声明：本文档由 modular-architect 起草并经 modular-review。用户已接受 L3 方向。**尚未实施、尚未更新基线（main-design/module docs/graph）**——待实现阶段落地后再更新基线。

## Background

评估报告 P1 指出：`ai/agentLoop.ts`（及编排同层 `systemPrompt`/`stateSnapshot`/`materializeImages`）在运行时硬依赖 6 个具体的全局 store 单例，通过 `.getState()` 直接读写：

- `useSessionsStore` — `sessions[id]` 读取、`setMessages`、`persist`、`autoTitleFromInput`
- `useAgentStatusStore` — `setPhase`/`recordActivity`/`recordOutput`/`setUsage`/`setContext`/`startApiCall`/`finishApiCall`/`recordTool`
- `useProvidersStore` — `providers[]`、`active`
- `useAiConfigStore` — `activeAgentTemplate(state)`（loop/model/tools/context 配置）
- `useConfirmStore` — `ask(name, args, preview)`（在 `buildDispatcher` 内）
- `useTabsStore` — `rename(id, title)`

后果：`runAgent` 无法在不启动 6 个 store 的前提下隔离测试；编排逻辑与 store 形状强耦合，任一 store 形状变更可波及编排层。

### 对评估措辞的更正（重要）

评估初稿称此处存在「ai↔stores 运行时**环**」。经核对（`ai/tokenEstimate.ts`、`ai/toolPreview.ts`、`ai/tools/*` 均**不** import stores/components），**不存在真正的 import 环**。真实结构是模块级 DAG：

```
ai-core (tokenEstimate / tools / toolPreview)  ←  ui-state-stores  ←  ai-orchestration (agentLoop / systemPrompt / stateSnapshot / materializeImages)  →  ai-core
```

`src/ai` 与 `src/stores` 之间的双向边只在「文件夹粒度」成立（naive import-lint 会误报），本质无害。**唯一值得修的缺陷是编排层对具体 store 单例的穿透**（隔离可测性 + 爆炸半径），本提案只针对它。

## Requirement

> 打破 `agentLoop` 对 6 个具体 store 单例的硬依赖，使 AI 编排层依赖抽象端口而非 store 内部，从而可隔离测试、单向依赖。对外行为保持不变。

## Pre-Implementation State（verified）

- `runAgent` 仅有一个调用点：`src/components/AIChat/ChatPanel.tsx:141`。`buildDispatcher` 由 `runAgent` 内部默认构造（`opts.dispatcher ?? buildDispatcher()`），也可外部注入。→ 注入接线成本低。
- `agentLoop` 对 `useAgentStatusStore.getState()` / `useAiConfigStore.getState()` 在流事件回调与每次 attempt 内**反复实时读取**（如 line 248/252/276/277 等）。→ 端口方法必须保持「每次访问读最新」语义，不能一次快照后复用（否则引入行为回归）。
- 已存在 `src/ai/agentLoop.test.ts`，当前依赖对真实 store 打桩。

## Design：AgentRuntime 端口（方案 A，单一注入对象）

新增一个由调用方注入的 `AgentRuntime` 端口，收拢 `agentLoop`/`buildDispatcher` 实际用到的全部 store 操作。`runAgent`/`buildDispatcher` 接受可选 `runtime`，默认由工厂用现有 store 接线。

```ts
// src/ai/runtime.ts（新增，端口 + 默认工厂）
export interface AgentRuntime {
  sessions: {
    get(id: string): SessionData | undefined;
    setMessages(id: string, msgs: Message[]): void;
    persist(id: string): Promise<void>;
    autoTitleFromInput(id: string, input: string): Promise<string | null>;
  };
  status: {
    setPhase(id: string, phase: AgentPhase): void;
    recordActivity(id: string, text: string): void;
    recordOutput(id: string, len: number): void;
    setUsage(id: string, usage: Usage): void;
    setContext(id: string, ctx: ContextInfo): void;
    startApiCall(id: string, bytes: number): void;
    finishApiCall(id: string, outcome: 'done' | 'error'): void;
    recordTool(id: string, name: string, argsPreview: string): void;
  };
  /** 每次调用读最新 activeAgentTemplate 快照（保持实时读语义）。 */
  config(): AgentConfigSnapshot;
  provider(id?: string): Provider | undefined;
  confirm(name: string, args: Record<string, unknown>, preview: string): Promise<boolean>;
  renameTab(id: string, title: string): void;
}

export function defaultAgentRuntime(): AgentRuntime {
  // 每个方法内部 use*Store.getState()，保持「读最新」而非构造期快照
  return { /* 用现有 6 个 store 接线 */ };
}
```

- `runAgent(opts, runtime = defaultAgentRuntime())`；`buildDispatcher(options, runtime = defaultAgentRuntime())`。
- `agentLoop.ts` 移除对 `use*Store` 的直接 import，改为经 `runtime.*`。
- `ChatPanel` 调用不变（用默认工厂），或显式传 `defaultAgentRuntime()`。
- `notesService`/`webSearchService`/`invoke` 已经过 `ToolContext` 注入（services 接缝），**不在本次范围**，保持不变。

### 依赖方向与文件夹边界

- 澄清 `src/ai` 两个子层：**ai-core**（纯，无上行依赖）= `tokenEstimate`/`tools`/`toolPreview`/`contextBuilder`；**ai-orchestration**（编排）= `agentLoop`/`systemPrompt`/`stateSnapshot`/`materializeImages`。
- 引入**模块粒度** import-lint：
  - 禁止 `src/stores/*` import `ai-orchestration` 文件；
  - 允许 `src/stores/*` import `ai-core`（下行，合法）；
  - `ai-orchestration` 不再直接 import `use*Store`（改经 `AgentRuntime`）。

## Staged Roadmap（每阶段一个闭环，独立提交）

**Stage 0 — 行为基线**：补齐/确认 `agentLoop.test.ts` 覆盖等价性锚点：正常工具调用回合、流重试、abort、空回复提示、写工具 confirm 拒绝、auto-title。作为重构前后行为对照 oracle。验证信号：基线用例全绿。

**Stage 1 — 定义端口 + 默认工厂**：新增 `src/ai/runtime.ts`（`AgentRuntime` + `defaultAgentRuntime`）。`runAgent`/`buildDispatcher` 接受可选 `runtime`，默认工厂接线现有 store；内部 `.getState()` 全部替换为 `runtime.*`（保持读最新语义）。调用点不改。验证：全量 vitest 绿、`tsc`、`build`；行为无差异。

**Stage 2 — 隔离测试**：`agentLoop.test.ts` 改注入 fake `AgentRuntime`，移除对真实 store 的打桩。验证：agentLoop 测试在**零真实 store**下运行通过。

**Stage 3 — 迁移 3 个编排 sibling 去 store 直连（Q1：本次一并做）**：
- `systemPrompt.buildSystemPrompt`（现内部读 `useAiConfigStore`；调用方为 `ChatPanel`——组合根，合法持有状态）→ 改为由调用方把 active agent template 作为**显式参数**传入，`systemPrompt.ts` 不再 import store。
- `stateSnapshot`（现读 `useSnapshotStore`）→ 由 `makeSnapshotSummarizer` 的调用方（`agentLoop`，已持 runtime）注入 snapshot 读写句柄；`stateSnapshot.ts` 不再 import store。
- `materializeImages`（现读 `useUiStore` 仅用于日志/提示）→ 把所需 ui 输入作为参数下传，不 import store。
- 设计原则：sibling 用**普通参数注入**（由组合根 `ChatPanel`/`agentLoop` 供给），**不**扩张 `AgentRuntime` 端口去背 uiStore/snapshotStore 等无关关切——保持端口聚焦。
- 验证：三文件不再 import `use*Store`；全量 vitest 绿、`tsc`、`build`；行为无差异。

**Stage 4 — 通用 lint + 正式子层（Q2：落为正式子层）+ 文档**：
- 把 import-lint 从「限定 agentLoop」放宽为 **ai-orchestration 通用**：ai-orchestration 文件一律禁止直连 `use*Store`；`stores/*` 禁止 import 任何 ai-orchestration 文件；`stores/*` 仍可 import ai-core（下行合法）。
- 在 `architecture/main-design.md` 与相关 module 文档正式登记 **ai-core / ai-orchestration 子层**（仍隶属现有 AI 大范围模块 `ai-agent-loop`/`ai-context-tools`，不新建顶层模块——Q2 用户裁定）。`systemPrompt`/`stateSnapshot` 归属仍在 `ai-context-tools`，只是标注为其 orchestration 子层。
- 基线更新（含子层登记、图更新 Q4）在实施验证通过后进行，实施前不覆盖 `graphs/current-project.arch.json`。

## Data Ownership 迁移

无数据迁移。核心数据归属**不变**：session 消息仍归 `sessions` store、AI 运行态仍归 `agentStatus` store、配置仍归 `aiConfig` store。本次只改「编排层如何访问它们」（经端口而非直连单例），不改「谁拥有」。

## ADR 方向（待接受时定稿，勿视为已定）

- 决策：**AI 编排层依赖注入端口，而非直接依赖具体 store 单例**。
- 备选：(a) 维持 `.getState()` 直连（现状，不可隔离测试）；(b) 每协作者一个独立接口（6 个端口，过度抽象，超当前需要）；(c) 仅加 lint+文档不注入（不解决可测性）。
- 影响未来：所有新增 AI 编排流程都必须经 `AgentRuntime` 端口取用状态，不得新增 `use*Store` 直连。这是一条会约束未来工作的持久规则，故值 ADR。

## Risks / Rollback

- **风险①（读最新语义回归）**：端口方法若在构造期快照而非每次 `getState()`，会改变 `activeAgentTemplate`/status 的实时读行为。缓解：默认工厂方法内部实时 `getState()`；Stage 0 基线用例覆盖「回合中途配置/状态变化」。
- **风险②（端口面偏宽）**：单一 `AgentRuntime` 含 6 组操作。缓解：只暴露 agentLoop 实际调用的方法，不预留未用能力（YAGNI）；不拆成 6 个独立接口。
- **风险③（异步顺序）**：`persist`/`setMessages` 时序须与现状一致。缓解：Stage 1 逐处等价替换，不合并调用。
- **Rollback**：每 Stage 独立提交，可单独 revert；Stage 1 完成前对外行为零变化，回退无副作用。

## Verification Plan（总）

- 每 Stage：`npx vitest run` 全绿、`npx tsc --noEmit` 无错、`npm run build` 成功。
- 终态验收信号：`agentLoop.test.ts` 在注入 fake runtime、**不 import 任何真实 store**的前提下通过；`agentLoop.ts` 不再 import `use*Store`；import-lint 生效拦截回归。

## Open Questions（已由用户 2026-07-04 裁定，RESOLVED）

- **Q1 → RESOLVED：一并完成**。本次同时迁移 `agentLoop` + `systemPrompt` + `stateSnapshot` + `materializeImages`（见 Stage 3）。通用 lint 在四者全部迁移后于 Stage 4 开启。
- **Q2 → RESOLVED：落为正式子层**。ai-core / ai-orchestration 作为正式子层登记，但仍隶属现有 AI 大范围模块（`ai-agent-loop`/`ai-context-tools`），**不新建顶层模块**；`systemPrompt`/`stateSnapshot` 归属不变，仅标注为 `ai-context-tools` 的 orchestration 子层。
- **Q3 → RESOLVED：落 ADR**。已创建 `architecture/adrs/ADR-2026-07-04-agent-runtime-port.md`。
- **Q4 → RESOLVED：实施后同步图**。实施前不覆盖 `graphs/current-project.arch.json`；基线与图更新在实施验证通过后进行。

## 交接（架构师不落地）

本提案 status: proposed。后续路径：`modular-review` → 决策摘要（3–8 条）→ 人工接受（L3 方向确认，阻塞点）→ 实现计划 → 实施 → 验证 → 更新基线（`ai-agent-loop.md` 等）→ PM complete。架构师不自行标记 accepted/implemented，不更新基线。
