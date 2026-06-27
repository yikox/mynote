# Markdown 表格智能渲染 Design

Last updated: 2026-06-27

Status: implemented

Module: editor

Requirement ID: LEGACY-EDITOR-SMART-TABLE-2026-06-27

Related requirement/task: project-management.md → 任务归档「Markdown 表格智能渲染」

Design status: implemented

Review status: reviewed（2026-06-27 PM 审计补齐；无阻塞问题）

Accepted by: 用户在实现会话中确认“把现在的逻辑落到 app 中”

Accepted date: 2026-06-27

Implementation status: implemented

Implementation evidence:
- 2026-06-27 提交 `cecc07d`（已推送 `origin/main`）：新增 `src/components/Editor/smartTableLayout.ts`、`SmartTablePreview`、表格 inline Markdown 渲染与样本预览脚本。
- 验证：`npm run test:run -- src/components/Editor/smartTableLayout.test.ts src/components/Editor/ModuleMarkdownEditor.test.tsx src/components/Editor/tableEditing.test.ts` 79/79 通过；`npm run build` 通过。

## Background

笔记里的 Markdown 表格由浏览器原生 table 布局渲染时，窄列会把英文状态拆成竖排，路径和长备注列又会撑出大量空白或横向溢出。用户明确要求优化的是通用表格渲染逻辑，而不是单独改某几张表格。

## Requirement

- 表格预览应按容器宽度和内容形态动态分配列宽。
- 换行应尽量少，不拆英文单词或状态 token。
- 路径、URL、中文备注等可换行内容应在自然断点换行。
- 超宽时尽量缩窄其它可换行列，保留必要横向滚动。
- 表格单元格内的简单 Markdown 语法（链接、加粗、斜体、code）仍需可用。

## Acceptance Criteria

- 状态列如 `implemented` 不再被逐字母竖排。
- 路径/URL 在 `/`、`.`、`-`、`_` 等自然位置可断行。
- 多列表格在宽度不足时优先压缩 text/path/short 列，不让某一列独占宽度。
- 小表按内容宽度展示，不被强制撑满整页。
- 单元格内 `**bold**`、`*em*`、`` `code` ``、`[link](url)` 可渲染。

## Current State

- `ModuleMarkdownEditor` 的表格预览原先直接输出普通 `<table>`，宽度由浏览器布局决定。
- CSS 侧缺少按列内容识别、容器预算、自然断点和 inline Markdown 解析协同。
- 已有 `tableEditing.ts` 负责编辑态源码导航/对齐，不适合作为预览列宽算法直接复用。

## Target Design

新增 `smartTableLayout.ts` 作为表格预览布局纯函数层，`SmartTablePreview` 在运行时测量容器宽度并把目标宽度换算成 `ch` 预算。布局结果通过 `<colgroup>`、固定表格布局和单元格 class 控制渲染。

## Scope

- In scope:
  - 表格预览列类型识别：`status`、`path`、`short`、`text`。
  - 基于内容显示宽度、最长不可拆 token、目标容器宽度的列宽计算。
  - 超宽时对可换行列做贪心收缩。
  - path/URL 自然断点和简单 inline Markdown 渲染。
  - 真实笔记表格抽样脚本与静态预览页面。
- Out of scope:
  - 表格编辑态单元格导航和源码对齐（已由表格编辑体验设计覆盖）。
  - 拖拽调列宽、表格工具条、完整 CommonMark inline 解析。
  - 对包含复杂转义管道符或嵌套 Markdown 的表格做完备解析。

## Detailed Design

- `analyzeSmartTable(rows, { targetCh })`：过滤空行，识别 header/data rows，按最大列数构造列模型。
- `kindForColumn`：优先按表头识别状态列和路径列；再按列值比例识别状态/路径；其余按内容宽度区分 `short` 与 `text`。
- `widthForColumn`：用 `displayWidth` 计算 CJK/全角宽度；`minCh` 取最长不可拆 token、表头宽度和列类型下限；`preferredCh` 与 `maxCh` 按列类型限制。
- `applyTableBudget`：总宽超过目标时，每轮选择仍可收缩且收益最高的列缩 1ch；`text`、`path` 权重高于 `short`，`status` 不收缩到会拆 token 的宽度。
- `pathBreakText`：在 `/`、`\`、`.`、`-`、`_` 和 `://` 后插入可断点，保证路径可读。
- `SmartTablePreview`：用 `ResizeObserver` 读取容器宽度，换算目标 `ch`；渲染 `<colgroup>`、thead/tbody，并对 path 列插入 `<wbr>`。
- 简单 inline Markdown 渲染只覆盖常用语法；React 渲染负责文本转义，链接保留为链接元素。

## Impacted Modules

| Module | Impact |
| --- | --- |
| editor | `ModuleMarkdownEditor` 表格预览改为 `SmartTablePreview`；新增 `smartTableLayout.ts` 纯函数和测试 |
| ui-shell | 无直接影响；表格宽度随编辑器内容容器变化 |
| notes | 无：笔记源码不变，只改变预览渲染 |

## Implementation Plan

1. 先用真实笔记抽样脚本收集 `/Users/zyc/notes` 下所有 Markdown 表格，生成临时 Markdown/JSON 样本。
2. TDD 编写 `smartTableLayout.test.ts`，覆盖列类型、状态不拆、路径断点、贪心收缩、宽度上限。
3. 在 `ModuleMarkdownEditor` 中引入 `SmartTablePreview`，用 `ResizeObserver` 对接容器宽度。
4. 扩展表格单元格 inline Markdown 渲染，保留 path 列 `<wbr>` 断点。
5. 更新 CSS 为 fixed table layout、横向滚动、overflow wrapping，并运行表格相关测试和构建。

## Lifecycle Sync

| Item | Status | Evidence / PM Reference |
| --- | --- | --- |
| Requirement | implemented | project-management.md → 任务归档「Markdown 表格智能渲染」 |
| Design Document | implemented | This file |
| Review / Acceptance | reviewed | 2026-06-27 PM 审计补齐；无阻塞问题 |
| Implementation | implemented | Commit `cecc07d`; tests 79/79 + `npm run build` |

## Review Findings

| Type | Finding | Resolution |
| --- | --- | --- |
| fixed | 初始 PM 只记录任务和最近更新，缺少变更设计路径 | 新建本设计并索引到 `project-management.md` |
| fixed | Editor 基线未记录智能表格预览算法 | 已同步到 `architecture/modules/editor.md` |

## Testing and Validation

- `smartTableLayout.test.ts`：列识别、断点、贪心压缩、nowrap/status 行为。
- `ModuleMarkdownEditor.test.tsx`：表格预览 class/inline Markdown 行为。
- `tableEditing.test.ts`：保证编辑态表格导航/源码对齐不回归。
- `npm run build`：Vite/TypeScript 构建通过。

## Risks

- 简单 inline Markdown 不是完整 Markdown 解析器，复杂嵌套或转义语法可能降级为纯文本。
- `ResizeObserver` 在 jsdom 中需要测试替身，视觉宽度仍需通过真实样本预览观察。
- 状态/路径列识别基于启发式，极端表格可能需要后续微调阈值。

## Open Questions

- 暂无阻塞性开放问题。若后续用户希望手动调列宽，可在本算法上增加用户级覆盖配置。

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-06-27 | 表格预览采用通用列宽算法，而不是逐表特例 | 用户明确要求修正渲染逻辑，不改具体表格内容 |
| 2026-06-27 | 状态列 nowrap，路径/URL 在自然断点换行 | 避免 `implemented` 竖排，同时让路径列可读 |
| 2026-06-27 | 超宽时贪心压缩可换行列并保留横向滚动 | 在可读性和不溢出之间取稳定折中 |
