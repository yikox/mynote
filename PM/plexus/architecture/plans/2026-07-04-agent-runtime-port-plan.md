---
source_design: architecture/changes/2026-07-04-agent-runtime-port.md
level: L3
---

# AgentRuntime 端口（AI 编排层依赖注入）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AI 编排层（`agentLoop`/`systemPrompt`/`stateSnapshot`/`materializeImages`）不再直连全局 store 单例，改为经单一注入 seam（`src/ai/runtime.ts` 的 `AgentRuntime`）或普通参数取用状态；对外行为完全不变。

**Architecture:** 新增 `src/ai/runtime.ts` 作为 ai 层唯一的 store 接线 seam：定义 `AgentRuntime` 端口 + `defaultAgentRuntime()` 工厂（内部实时 `getState()`，保留「读最新」语义）。编排文件只 import 端口/类型，不 import `../stores/*`。用一个 vitest guard 测试固化「ai-orchestration 不直连 store、stores 不 import ai-orchestration」。

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Vite/tsc（无 eslint —— 架构约束用 vitest guard 测试实现）。

## Global Constraints

以下逐条 copy 自已接受设计 `2026-07-04-agent-runtime-port.md`，每个 task 隐含遵守：

- **端口/参数注入取代直连**：编排层经注入的抽象取用运行态，不再 `use*Store.getState()` 直连。
- **默认工厂实时读**：`defaultAgentRuntime()` 端口方法内部实时 `getState()`，**不得**构造期快照 —— 保留 agentLoop 在流事件/每次 attempt 反复读最新 config/status 的语义（防快照回归）。
- **单一 seam**：所有 ai↔store 接线只在 `src/ai/runtime.ts`。其余 `src/ai/**` 文件禁止 import `../stores/*`。
- **sibling 用参数注入**：`systemPrompt`/`stateSnapshot`/`materializeImages` 经普通参数（由组合根 `ChatPanel`/`agentLoop` 供给）取用状态。
- **依赖方向**：`stores/*` 禁止 import 任何 ai-orchestration 文件（`agentLoop`/`systemPrompt`/`stateSnapshot`/`materializeImages`/`runtime`）；`stores/*` 仍可 import ai-core（`tokenEstimate`/`tools`/`toolPreview`，下行合法）。
- **数据归属不变**：session 归 sessions、AI 运行态归 agentStatus、配置归 aiConfig、快照归 snapshot —— 只改「如何访问」，不改「谁拥有」。
- **行为不变**：对外行为零变化；重构提交与功能提交分离。
- **验证**：每 task `npx tsc --noEmit` 无错、相关 `npx vitest run` 绿；终态 `npm run build` 成功；`agentLoop.test.ts` 注入 fake runtime、不 import 任何真实 store 通过；4 个编排文件不再 import `use*Store`。

---

## File Structure

- `src/ai/runtime.ts` — **新增**。`AgentRuntime`/`AgentStatusPort`/`SnapshotPort` 接口 + `defaultAgentRuntime()` + `defaultSnapshotPort()`。ai 层唯一 store 接线 seam。
- `src/ai/runtime.test.ts` — **新增**。验证 `defaultAgentRuntime()` 委托到真实 store 且实时读。
- `src/ai/agentLoop.ts` — **改**。`runAgent`/`buildDispatcher` 接受可选 `runtime`（默认 `defaultAgentRuntime()`）；移除全部 `use*Store` import。
- `src/ai/agentLoop.test.ts` — **改**。注入 fake `AgentRuntime`，移除真实 store 打桩。
- `src/ai/systemPrompt.ts` — **改**。`buildSystemPrompt` 增 `agentTemplate` 参数；移除 `useAiConfigStore` import。
- `src/components/AIChat/ChatPanel.tsx` — **改**。调用 `buildSystemPrompt` 时传 `activeAgentTemplate(useAiConfigStore.getState())`。
- `src/ai/materializeImages.ts` — **改**。`materializeImages` 增 `notify` 参数；移除 `useUiStore` import。
- `src/ai/stateSnapshot.ts` — **改**。`makeSnapshotSummarizer`/`compactSessionNow` 增 `snapshot: SnapshotPort` 参数；移除 `useSnapshotStore` import。
- `src/ai/architecture.guard.test.ts` — **新增**。grep 源码断言依赖方向。

---

## Task 1: 定义 AgentRuntime 端口 + 默认工厂

**Files:**
- Create: `src/ai/runtime.ts`
- Test: `src/ai/runtime.test.ts`

**Interfaces:**
- Produces:
  - `interface AgentStatusPort` — 8 方法镜像 `agentStatusStore`：`setPhase(id,phase)`, `setContext(id,input)`, `recordTool(id,name,args?)`, `recordActivity(id,activity)`, `startApiCall(id,inputBytes)`, `recordOutput(id,chars)`, `finishApiCall(id,status?)`, `setUsage(id,usage)`。类型直接从 `agentStatusStore` 复用。
  - `interface SnapshotPort { getSnapshot(sessionId): SnapshotEntry | undefined; setSnapshot(sessionId, entry): void }`（`SnapshotEntry` 从 `snapshotStore` 复用）。
  - `interface AgentRuntime { getSession(id): Session | undefined; setMessages(id, msgs: Message[]): void; persistSession(id): Promise<void>; autoTitleFromInput(id, userInput): Promise<string | null>; status: AgentStatusPort; config(): AgentTemplateConfig; resolveProvider(providerId?: string): Provider | undefined; confirm(toolName, args, preview): Promise<boolean>; renameTab(id, title): void; notify(message: string): void; snapshot: SnapshotPort }`。
  - `function defaultAgentRuntime(): AgentRuntime`
  - `function defaultSnapshotPort(): SnapshotPort`

- [ ] **Step 1: 写失败测试** —— `src/ai/runtime.test.ts`

```ts
import { expect, test, vi, beforeEach } from 'vitest';
import { defaultAgentRuntime } from './runtime';
import { useSessionsStore } from '../stores/sessionsStore';
import { useAgentStatusStore } from '../stores/agentStatusStore';
import { useTabsStore } from '../stores/tabsStore';

beforeEach(() => {
  useSessionsStore.setState({ sessions: {} });
});

test('defaultAgentRuntime reads session live from store (not a construct-time snapshot)', () => {
  const rt = defaultAgentRuntime();
  expect(rt.getSession('s1')).toBeUndefined();
  // 构造 runtime 之后再写 store，端口必须读到最新值
  useSessionsStore.setState({
    sessions: { s1: { id: 's1', title: 't', messages: [], createdAt: '', updatedAt: '' } as any },
  });
  expect(rt.getSession('s1')?.id).toBe('s1');
});

test('defaultAgentRuntime.status delegates to agentStatusStore', () => {
  const spy = vi.spyOn(useAgentStatusStore.getState(), 'setPhase');
  defaultAgentRuntime().status.setPhase('s1', 'running');
  expect(spy).toHaveBeenCalledWith('s1', 'running');
});

test('defaultAgentRuntime.renameTab delegates to tabsStore', () => {
  const spy = vi.spyOn(useTabsStore.getState(), 'rename');
  defaultAgentRuntime().renameTab('s1', 'New');
  expect(spy).toHaveBeenCalledWith('s1', 'New');
});
```

- [ ] **Step 2: 跑测试确认失败** —— Run: `npx vitest run src/ai/runtime.test.ts` —— Expected: FAIL（`./runtime` 不存在 / `defaultAgentRuntime` 未定义）。

- [ ] **Step 3: 实现 `src/ai/runtime.ts`**

关键：每个方法体内部 `use*Store.getState().xxx(...)`，**不**在工厂顶层取一次 `getState()`。`config()` 返回 `activeAgentTemplate(useAiConfigStore.getState())`。`resolveProvider(id)` = `useProvidersStore.getState()` 里 `providers.find(p=>p.id === (id ?? active))`。`confirm` 委托 `useConfirmStore.getState().ask`。`notify` 委托 `useUiStore.getState().showNotice`。`snapshot` 委托 `useSnapshotStore.getState()` 的 `getSnapshot`/`setSnapshot`。类型 `Session`/`Provider`/`AgentTemplateConfig`/`SnapshotEntry`/`TokenUsage`/`ContextInput`/`AgentPhase` 从各自 store 文件 re-import。此文件是唯一允许 import `../stores/*` 的 ai 层文件。

- [ ] **Step 4: 跑测试确认通过** —— Run: `npx vitest run src/ai/runtime.test.ts` —— Expected: PASS（3 例）。再 `npx tsc --noEmit` 无错。

- [ ] **Step 5: 提交**

```bash
git add src/ai/runtime.ts src/ai/runtime.test.ts
git commit -m "feat(ai): add AgentRuntime port + defaultAgentRuntime wiring seam"
```

---

## Task 2: agentLoop 改用注入 runtime（行为不变）

**Files:**
- Modify: `src/ai/agentLoop.ts`
- Test: `src/ai/agentLoop.test.ts`（本 task 只需保持现有测试绿；重写留 Task 3）

**Interfaces:**
- Consumes: Task 1 的 `AgentRuntime`, `defaultAgentRuntime`。
- Produces: `runAgent(opts, runtime?: AgentRuntime)`；`buildDispatcher(options?, runtime?: AgentRuntime)`（默认均 `defaultAgentRuntime()`）。

- [ ] **Step 1: 跑现有测试建立基线** —— Run: `npx vitest run src/ai/agentLoop.test.ts` —— Expected: PASS（现状全绿）。记录用例数。

- [ ] **Step 2: 改 `agentLoop.ts` 签名 + 全量替换**

`runAgent(opts: RunOptions, runtime: AgentRuntime = defaultAgentRuntime())`；`buildDispatcher(options: DispatcherOptions = {}, runtime: AgentRuntime = defaultAgentRuntime())`。逐处等价替换（不合并调用、保持顺序与「读最新」）：
- `useSessionsStore.getState()` 的 `sessions[id]`/`setMessages`/`persist`/`autoTitleFromInput` → `runtime.getSession(id)` / `runtime.setMessages` / `runtime.persistSession` / `runtime.autoTitleFromInput`。
- 每处 `useAgentStatusStore.getState().X(...)` → `runtime.status.X(...)`。
- `useProvidersStore.getState()` 解析 provider → `runtime.resolveProvider(agent.model.providerId)`。
- `activeAgentTemplate(useAiConfigStore.getState())` → `runtime.config()`。
- `useConfirmStore.getState().ask(...)` → `runtime.confirm(...)`。
- `useTabsStore.getState().rename(...)` → `runtime.renameTab(...)`。
- **不改** `materializeImages(payload)` 与 `makeSnapshotSummarizer(sessionId, {...}, enabled)` 调用（sibling 签名尚未变——留 Task 4/5 同时改签名+调用点，避免本 task 传多余参数触发 tsc 报错）。
- 删除文件顶部 6 个 `use*Store` import 与 `activeAgentTemplate` import（若仅此处用）。保留 `services/*`、`./tools`、`./contextBuilder`、`./materializeImages`、`./tokenEstimate`、`./stateSnapshot` import。
- `buildDispatcher` 内部若需构造 dispatcher 时 runtime 未传，用默认；`runAgent` 里 `opts.dispatcher ?? buildDispatcher(undefined, runtime)`。

- [ ] **Step 3: 跑测试确认仍绿** —— Run: `npx vitest run src/ai/agentLoop.test.ts` —— Expected: PASS（用例数与 Step 1 相同；行为不变）。注意：现有测试仍 import 真实 store 打桩 —— 本 task **不改测试**，只要默认工厂让它们照旧通过即可。若因 `buildDispatcher` 现在用 `runtime.confirm`（委托 `useConfirmStore.getState().ask`）而现有 `useConfirmStore.setState({ask})` 打桩仍生效则通过。

- [ ] **Step 4: 全量校验** —— Run: `npx tsc --noEmit` 无错；`npx vitest run src/ai` 绿。

- [ ] **Step 5: 提交**

```bash
git add src/ai/agentLoop.ts
git commit -m "refactor(ai): route agentLoop state access through injected AgentRuntime"
```

---

## Task 3: agentLoop 隔离测试（注入 fake，零真实 store）

**Files:**
- Modify: `src/ai/agentLoop.test.ts`

**Interfaces:**
- Consumes: `AgentRuntime` (Task 1), `buildDispatcher(options, runtime)` (Task 2)。

- [ ] **Step 1: 重写测试用 fake runtime**

移除对 `useAiConfigStore`/`useConfirmStore` 的 import 与 `setState` 打桩。新增 `makeFakeRuntime(overrides?)` 工厂，返回满足 `AgentRuntime` 的最小 fake（`config()` 返回带 `tools.perToolWriteAutoAllow`/`tools.settings`/`tools.toolEnabled` 的桩模板；`confirm` 为 `vi.fn(async () => true)` 等）。现有断言改为注入 fake：

```ts
import { buildDispatcher } from './agentLoop';
import type { AgentRuntime } from './runtime';

function makeFakeRuntime(o: Partial<AgentRuntime> & { autoAllow?: Record<string, boolean> } = {}): AgentRuntime {
  const cfg: any = { tools: { perToolWriteAutoAllow: o.autoAllow ?? {}, settings: {}, toolEnabled: {} } };
  return {
    getSession: vi.fn(() => undefined),
    setMessages: vi.fn(),
    persistSession: vi.fn(async () => {}),
    autoTitleFromInput: vi.fn(async () => null),
    status: { setPhase: vi.fn(), setContext: vi.fn(), recordTool: vi.fn(), recordActivity: vi.fn(), startApiCall: vi.fn(), recordOutput: vi.fn(), finishApiCall: vi.fn(), setUsage: vi.fn() },
    config: () => cfg,
    resolveProvider: vi.fn(() => undefined),
    confirm: vi.fn(async () => true),
    renameTab: vi.fn(),
    notify: vi.fn(),
    snapshot: { getSnapshot: vi.fn(() => undefined), setSnapshot: vi.fn() },
    ...o,
  } as AgentRuntime;
}

test('allowWrite=false rejects WRITE_TOOLS before confirm', async () => {
  const rt = makeFakeRuntime({ autoAllow: { update_note: false } });
  const d = buildDispatcher({ allowWrite: false }, rt);
  const r = await d.call('update_note', { path: 'a.md', content: 'x' });
  expect(JSON.parse(r).reason).toBe('write_not_allowed');
  expect(rt.confirm).not.toHaveBeenCalled();
});
```

保留原有语义覆盖（default allow、allowTools 白名单、unknown tool、confirm 拒绝 → user_rejected）。`services/notes`/`webSearch`/`@tauri-apps/api/core` 的 `vi.mock` 保留（那是 services 接缝，非 store）。

- [ ] **Step 2: 确认零真实 store import** —— Run: `grep -nE "stores/|use[A-Z][A-Za-z]*Store" src/ai/agentLoop.test.ts` —— Expected: 无输出。

- [ ] **Step 3: 跑测试确认通过** —— Run: `npx vitest run src/ai/agentLoop.test.ts` —— Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/ai/agentLoop.test.ts
git commit -m "test(ai): isolate agentLoop tests with a fake AgentRuntime (no real stores)"
```

---

## Task 4: stateSnapshot 去 store（注入 SnapshotPort）

**Files:**
- Modify: `src/ai/stateSnapshot.ts`
- Test: `src/ai/stateSnapshot.test.ts`（补注入用例）

**Interfaces:**
- Consumes: `SnapshotPort`, `defaultSnapshotPort` (Task 1)。
- Produces: `makeSnapshotSummarizer(sessionId, provider, enabled, snapshot: SnapshotPort)`；`compactSessionNow(sessionId, messages, recentTurnsKept, provider, snapshot: SnapshotPort)`；`generateSnapshotFromOlder(sessionId, older, runCompletion, snapshot: SnapshotPort)`（内部函数加参）。

- [ ] **Step 1: 写/改失败测试** —— 在 `stateSnapshot.test.ts` 加一例：注入 fake `SnapshotPort`（`getSnapshot`/`setSnapshot` 为 `vi.fn`），断言 `makeSnapshotSummarizer(..., fake)` 返回的闭包会调用 `fake.setSnapshot`。若原测试依赖 `useSnapshotStore`，改为注入。

- [ ] **Step 2: 跑确认失败** —— Run: `npx vitest run src/ai/stateSnapshot.test.ts` —— Expected: FAIL（签名不匹配或仍读真实 store）。

- [ ] **Step 3: 实现** —— `generateSnapshotFromOlder`/`compactSessionNow` 内 `useSnapshotStore.getState()` 替换为传入的 `snapshot` 参数；`makeSnapshotSummarizer` 透传 `snapshot`。删除 `import { useSnapshotStore }`。**更新 agentLoop 调用点**：`makeSnapshotSummarizer(sessionId, {...}, cfg.context.stateSnapshotEnabled, runtime.snapshot)`。`compactSessionNow` 的 UI 调用方改传 `defaultSnapshotPort()`（在其调用处补齐）。

- [ ] **Step 4: 跑确认通过** —— Run: `npx vitest run src/ai/stateSnapshot.test.ts` —— PASS；`grep -n "useSnapshotStore" src/ai/stateSnapshot.ts` 无输出；`npx tsc --noEmit` 无错（修好所有 `compactSessionNow` 调用点）。

- [ ] **Step 5: 提交**

```bash
git add src/ai/stateSnapshot.ts src/ai/stateSnapshot.test.ts src/components
git commit -m "refactor(ai): inject SnapshotPort into stateSnapshot; drop direct store access"
```

---

## Task 5: materializeImages 去 store（注入 notify）

**Files:**
- Modify: `src/ai/materializeImages.ts`
- Test: `src/ai/materializeImages.test.ts`（若无则新建）

**Interfaces:**
- Produces: `materializeImages(messages: Message[], notify?: (message: string) => void): Promise<unknown[]>`。

- [ ] **Step 1: 写失败测试** —— 断言当某图片 `assetsService.readImageDataUrl` 抛错（dropped>0）时，传入的 `notify` 被调用一次且含丢失张数；不传 notify 不报错。`vi.mock('../services/assets', ...)` 让一张图 reject。

- [ ] **Step 2: 跑确认失败** —— Run: `npx vitest run src/ai/materializeImages.test.ts` —— Expected: FAIL。

- [ ] **Step 3: 实现** —— 签名加 `notify?`；把 `useUiStore.getState().showNotice(...)` 换成 `notify?.(\`有 ${dropped} 张图片已丢失，未随本次消息发送\`)`；删除 `import { useUiStore }`。**更新 agentLoop 调用点**：`materializeImages(payload, runtime.notify)`。

- [ ] **Step 4: 跑确认通过** —— Run: `npx vitest run src/ai/materializeImages.test.ts` —— PASS；`grep -n "useUiStore" src/ai/materializeImages.ts` 无输出；`npx tsc --noEmit` 无错。

- [ ] **Step 5: 提交**

```bash
git add src/ai/materializeImages.ts src/ai/materializeImages.test.ts
git commit -m "refactor(ai): inject notify into materializeImages; drop uiStore access"
```

---

## Task 6: systemPrompt 去 store（ChatPanel 参数注入 agentTemplate）

**Files:**
- Modify: `src/ai/systemPrompt.ts`, `src/components/AIChat/ChatPanel.tsx`
- Test: `src/ai/systemPrompt.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(workspacePath, treePreview, agentTemplate: AgentTemplateConfig): Promise<string>`。

- [ ] **Step 1: 改测试注入 template** —— `systemPrompt.test.ts` 里对 `buildSystemPrompt` 的调用加第三参数（桩 `agentTemplate`），移除对 `useAiConfigStore` 的依赖/打桩。加一例：不同 `agentTemplate.systemPromptTemplate` → 不同 role 段。

- [ ] **Step 2: 跑确认失败** —— Run: `npx vitest run src/ai/systemPrompt.test.ts` —— Expected: FAIL（参数缺失）。

- [ ] **Step 3: 实现** —— `buildSystemPrompt` 增 `agentTemplate` 参数，删除内部 `const agentTemplate = activeAgentTemplate(useAiConfigStore.getState())` 与 `import { activeAgentTemplate, useAiConfigStore }`（若 `activeAgentTemplate` 别处不再用于本文件）。在 `ChatPanel.tsx` 调用处传 `activeAgentTemplate(useAiConfigStore.getState())`（ChatPanel 已 import 这些，UI 层合法）。

- [ ] **Step 4: 跑确认通过** —— Run: `npx vitest run src/ai/systemPrompt.test.ts` —— PASS；`grep -n "useAiConfigStore" src/ai/systemPrompt.ts` 无输出；`npx tsc --noEmit` 无错。

- [ ] **Step 5: 提交**

```bash
git add src/ai/systemPrompt.ts src/components/AIChat/ChatPanel.tsx src/ai/systemPrompt.test.ts
git commit -m "refactor(ai): inject agentTemplate into buildSystemPrompt; drop store access"
```

---

## Task 7: 架构 guard 测试（依赖方向固化）

**Files:**
- Create: `src/ai/architecture.guard.test.ts`

- [ ] **Step 1: 写 guard 测试**

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const AI_DIR = join(__dirname);
const ORCH = ['agentLoop.ts', 'systemPrompt.ts', 'stateSnapshot.ts', 'materializeImages.ts'];

function read(p: string) { return readFileSync(p, 'utf8'); }

test('ai-orchestration files do not import stores directly', () => {
  for (const f of ORCH) {
    const src = read(join(AI_DIR, f));
    expect(src, `${f} must not import ../stores/*`).not.toMatch(/from '\.\.\/stores\//);
  }
});

test('only runtime.ts is the ai↔store wiring seam', () => {
  // 除 runtime.ts 与 *.test.ts 外，src/ai 顶层文件不得 import ../stores/*
  for (const f of readdirSync(AI_DIR)) {
    if (!f.endsWith('.ts') || f === 'runtime.ts' || f.endsWith('.test.ts')) continue;
    const src = read(join(AI_DIR, f));
    expect(src, `${f} must not import ../stores/*`).not.toMatch(/from '\.\.\/stores\//);
  }
});

test('stores do not import ai-orchestration files', () => {
  const STORES = join(AI_DIR, '..', 'stores');
  for (const f of readdirSync(STORES)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    const src = read(join(STORES, f));
    for (const o of [...ORCH, 'runtime.ts']) {
      const base = o.replace('.ts', '');
      expect(src, `${f} must not import ai/${base}`).not.toMatch(new RegExp(`from '\\.\\./ai/${base}'`));
    }
  }
});
```

- [ ] **Step 2: 跑测试确认通过** —— Run: `npx vitest run src/ai/architecture.guard.test.ts` —— Expected: PASS（Task 1–6 完成后依赖方向已满足）。若失败，回到对应 task 修剩余直连。

- [ ] **Step 3: 全量验收** —— Run: `npx vitest run`（全绿）、`npx tsc --noEmit`（无错）、`npm run build`（成功）。

- [ ] **Step 4: 提交**

```bash
git add src/ai/architecture.guard.test.ts
git commit -m "test(ai): guard ai-orchestration vs store dependency direction"
```

---

## Validation（对应设计 Verification Plan）

- 每 task：`npx tsc --noEmit` 无错 + 相关 vitest 绿。
- 终态：`npx vitest run` 全绿；`npm run build` 成功；`agentLoop.test.ts` 无真实 store（Task 3 Step 2 grep 空）；4 个编排文件不再 import `use*Store`（Task 7 guard 绿）。
- 行为等价锚点（贯穿 Task 2/3）：默认 allow、allowWrite=false 早返回、allowTools 白名单、unknown tool、confirm 拒绝 → user_rejected。
