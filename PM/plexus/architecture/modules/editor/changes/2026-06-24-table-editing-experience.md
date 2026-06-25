# 表格编辑体验 Design

Last updated: 2026-06-25

Status: implemented（2026-06-25 已核验落地：提交 `f433e8c`/`f8331ca`/`0012885`/`cf271e7`，后续修复 `462a06f`；`npm test -- tableEditing ModuleMarkdownEditor` 68/68 与 `npm run build` 通过）

Module: editor

Related task: project-management.md → 待办「表格编辑体验」（2026-06-25 已完成）

## Background

rich 模式编辑器把表格块（`module.type === 'table'`）渲染为 `<table>` 预览；点进去后**整张表格变成一个 `<textarea aria-label="table 源码">`**，承载原始 Markdown 表格源码（如 `| A | B |\n| - | - |\n| 1 | 2 |\n`）。当前在该 textarea 内编辑是纯手敲：没有单元格跳转、没有自动补行，且源码里的管道符 `|` 不对齐，列一多就很难读。

本设计**不改表格的预览渲染、也不引入「块内单元格分块渲染」**（那是另一种形态）；只增强「文本编辑区」内的表格编辑：键盘单元格导航 + 源码按字符宽度自动对齐。

## Requirement

> 表格编辑体验：① 自动补全——Tab / 回车自动跳到下一单元格、行尾回车自动补一行（减少纯手敲）；② 文本编辑区表格按字符宽度自动匹配对齐（pad 管道符列对齐），拉高可视化。

## Pre-Implementation State

- 表格块编辑态 = 单个 `ModuleTextarea`（`module.type === 'table'`），`value` 为原始表格源码。
- `ModuleTextarea.handleKeyDown` 目前仅对 `module.type === 'list'` 做 Enter 续项 / Tab 缩进；**table 无任何特化按键**——Tab 走浏览器默认（移焦/插 Tab 字符）、Enter 走 textarea 默认换行。
- 预览用 `parseTableRows(source)`（按 `\n` 切行、`|` 切单元格并 **trim**）→ `<thead>/<tbody>`。该函数是「展示用」的有损解析（trim 掉空白、不留偏移），不适合做对齐/导航的回写。
- 回写经 `handleModuleChange` → `replaceMarkdownModule`，与其它块一致；本设计沿用，不改回写真相。

## Target Design

新增一层**表格网格纯函数**（offset-aware，不 trim），支撑两件事：

1. **单元格键盘导航 + 自动补行**：在 table textarea 内拦截 Tab / Shift+Tab / Enter，按「当前光标所在单元格」计算目标光标；越过表尾时自动补一行空行。
2. **按字符宽度对齐**：把表格源码各列按「显示宽度」（**CJK/全角字符记 2，半角记 1**）pad 到该列最大宽度，管道符竖直对齐；保留分隔行的对齐冒号（`:--` / `:-:` / `--:`）。

对齐**在单元格导航（Tab/Enter/Shift+Tab）与失焦（onDeactivate/blur）时触发，不在每次按键时触发**（避免输入中途光标被 pad 抖动）。导航/对齐后用既有 `onChange(next, caret, reposition=true)` + `caretNonce` 机制把光标精确放回目标单元格。

## Scope

- In scope:
  - 新增纯函数模块 `src/components/Editor/tableEditing.ts`（解析网格、计算导航落点、补行、按显示宽度对齐、跨对齐的光标 remap、`displayWidth`）。
  - `ModuleTextarea` 增加 `module.type === 'table'` 的 Tab/Shift+Tab/Enter 处理与失焦对齐。
  - 预览渲染、`parseTableRows`、回写链路、非 table 块行为：均不变。
- Out of scope:
  - 表格的「块内单元格分块渲染」（把单元格各自变成独立编辑单元）——本期不做，保持整表一个 textarea。
  - 列增删 UI、表格工具条、拖拽调列宽、对齐方式切换 UI。
  - 转义管道符 `\|`、单元格内嵌代码中的 `|` 的完备处理——本期按「不含转义/裸 `|`」处理，复杂表格降级为不破坏（见风险）。

## Detailed Design

### 新模块 `src/components/Editor/tableEditing.ts`

```ts
export interface TableCell { row: number; col: number; startOffset: number; endOffset: number; text: string }
export interface TableGrid {
  rows: TableCell[][];     // 含分隔行;每个 cell 的 offset 相对表格源码起点
  separatorRow: number;    // 分隔行(---)的行号,导航时跳过
  colCount: number;
}

// 显示宽度:CJK/全角=2,其余=1(用于 pad 对齐)。
export function displayWidth(text: string): number;

// 解析为 offset-aware 网格(不 trim,保留单元格原文与偏移)。
export function parseTableGrid(source: string): TableGrid;

// 当前光标 → 所在单元格(用于导航起点)。
export function cellAtOffset(grid: TableGrid, offset: number): TableCell | undefined;

// 计算导航落点。direction: 'next'(Tab) | 'prev'(Shift+Tab) | 'down'(Enter)。
// 返回 { source, caret, exit? }:
//  - 普通移动:source 不变(或对齐后的新 source)、caret 指向目标单元格内容起点。
//  - 越过表尾(Tab 末格 / Enter 末行非空):自动补一空行,caret 落新行首格。
//  - Enter 落在空的末行:exit=true(退出表格,交默认换行,光标移出表块)。
export function navigateTableCell(
  source: string,
  caret: number,
  direction: 'next' | 'prev' | 'down',
): { source: string; caret: number; exit?: boolean };

// 按显示宽度 pad 对齐;保留分隔行对齐冒号;返回对齐后源码 + 旧→新光标映射。
export function formatTable(source: string): { text: string; mapCaret: (oldOffset: number) => number };
```

### `ModuleTextarea` 改动（仅 table 分支）

在 `handleKeyDown` 内、`if (module.type === 'list')` 同级新增 `if (module.type === 'table')`：

- **Tab**：`navigateTableCell(value, selectionStart, 'next')` → `onChange(result.source, result.caret, true)`；`preventDefault`。
- **Shift+Tab**：同上，`'prev'`。
- **Enter**：`navigateTableCell(value, selectionStart, 'down')`；若 `exit` 为真则不拦截（默认换行，让光标自然移出表块，沿用既有跨块/空行逻辑）；否则 `onChange(result.source, result.caret, true)` 并 `preventDefault`。
- **失焦对齐**：`onDeactivate` 触发前（或在停用路径上）跑一次 `formatTable(value)`，若文本有变化则 emit 对齐后的源码。

导航函数内部在「补行/换格」时先 `formatTable` 再算落点，使列保持对齐；`mapCaret` 把光标从旧源码偏移映射到对齐后源码偏移，避免 pad 后光标错位。

### 对齐规则

- 列宽 = 该列所有单元格 `displayWidth(text.trim())` 的最大值（分隔行至少 3：`---`）。
- 数据/表头单元格：`| ` + 内容 + 右侧空格补到列宽 + ` `。
- 分隔行：按该列对齐标记输出 `:---`/`:--:`/`---:`/`----`，破折号填满列宽。
- 行末统一 `|`，行尾保留原表格块的尾随 `\n`（与 `parseTableRows` 预览的 displaySource 处理一致）。

## Impacted Modules

| Module | Impact |
| --- | --- |
| editor | 主改动:新增 `tableEditing.ts`,`ModuleTextarea` table 键盘处理与失焦对齐 |
| notes | 无:回写仍走 `replaceMarkdownModule`,文档源码语义不变(仅空白对齐变化) |
| ui-shell | 无 |

## Implementation Plan

1. `tableEditing.ts` + 单测:`displayWidth`（含 CJK）、`parseTableGrid`（offset/分隔行/列数）、`formatTable`（pad、对齐冒号、CJK 宽、ragged 行补齐、`mapCaret`）。
2. `navigateTableCell` + 单测:Tab 跨格/跨行、Shift+Tab 反向、Enter 下移、末格补行、空末行 exit、分隔行跳过。
3. `ModuleTextarea` table 分支接入导航;组件测试（点表格→Tab 跳下一格、Enter 下一行、末行 Enter 补行/退出）。
4. 失焦对齐接入;组件测试（编辑后失焦,源码列对齐、光标/回写正确）。
5. 回归:既有两个表格测试（整表 textarea 契约、编辑回写完整 Markdown）仍通过;非 table 块不受影响。

## Implementation Evidence

| Date | Evidence |
| --- | --- |
| 2026-06-25 | 已在 main 落地：`src/components/Editor/tableEditing.ts` 实现 offset-aware 表格网格、CJK/全角宽度、源码对齐与单元格导航；`ModuleMarkdownEditor.tsx` 的 table textarea 接入 Tab/Shift+Tab/Enter 与失焦对齐；`ModuleMarkdownEditor.test.tsx` 与 `tableEditing.test.ts` 覆盖导航、补行、空末行退出、CJK 对齐。验证：`npm test -- tableEditing ModuleMarkdownEditor` 68/68，`npm run build` 通过。 |

## Testing and Validation

- 单测 `tableEditing.test.ts`:覆盖 CJK 宽度、对齐冒号保留、ragged 行、光标 remap、导航各分支与补行/退出。
- 组件测试:Tab/Shift+Tab/Enter 在 `table 源码` textarea 内的落点与补行;失焦后源码对齐且 `onChange` 输出整篇 Markdown 正确。
- 回归:`点击表格后整张表格切换为一个源码 textarea`、`编辑当前模块时只替换该模块源码` 两例须仍绿（注意:若失焦对齐改变空白,需确认这些用例不触发失焦/导航,或按对齐后预期更新断言）。

## Risks

- **光标 remap 精度**:pad 改变偏移,`mapCaret` 必须把光标准确落回目标单元格,否则对齐后光标跳位（最大体验风险）。
- **触发时机**:每次按键对齐会抖动光标,故选「导航 + 失焦」触发;但失焦对齐可能与既有快照/草稿 emit 交互,需确认只在内容真变化时 emit。
- **ragged / 非法表格**:行单元格数不一致、缺分隔行、`isTableStart` 边界——`formatTable` 须容错（补齐列数、不抛错），最坏退化为不改动。
- **裸/转义管道符**:单元格内 `\|` 或代码中的 `|` 会被简单 `|` 切分误判;本期不完备处理,降级为「尽量不破坏」,列为已知限制。
- **测试契约**:既有表格用例断言精确源码字符串,失焦/导航引入的空白对齐可能需要同步更新断言（实现期处理）。

## Open Questions

- 已无阻塞性开放问题（4 项交互决策 2026-06-24 用户确认，见 Decision Log）。实现期细节：失焦对齐仅在内容真变化时 emit；ragged/非法表格容错降级。

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-06-24 | 保持整表一个 textarea（不做单元格分块渲染），只增强 textarea 内编辑（导航 + 源码对齐） | 贴合需求原文「文本编辑区…对齐」，避免与列表的子块模型混淆、范围可控 |
| 2026-06-24 | 新增 offset-aware `tableEditing.ts`，不复用展示用的有损 `parseTableRows` | 导航/对齐需要精确偏移与原文，trim 解析不可逆 |
| 2026-06-24 | 对齐触发时机=Tab/Enter/Shift+Tab 导航 + 失焦，**不**每键对齐（用户确认） | 避免输入中途 pad 抖动光标 |
| 2026-06-24 | Enter=下移同列；末行非空 Enter=补空行进入；**空末行 Enter=退出表格**（用户确认，镜像列表空项退出） | 既能连续补行又能自然离开表格 |
| 2026-06-24 | Tab 在末行末格=补新行进首格；Shift+Tab 首格 = 停留/到上一行末格（用户确认 Tab 越界补行） | 一路 Tab 即可建表 |
| 2026-06-24 | 对齐按显示宽度（CJK/全角=2）（用户确认） | 中文笔记等宽字体下管道符才真正对齐 |
