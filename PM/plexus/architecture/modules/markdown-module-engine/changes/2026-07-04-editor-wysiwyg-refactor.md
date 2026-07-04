# 编辑器 WYSIWYG 分层重构 Design

Last updated: 2026-07-04

Status: implemented

Module: markdown-module-engine

Requirement ID: REQ-20260704-editor-wysiwyg-refactor

Related task: project-management.md → Change Backlog `REQ-20260704-editor-wysiwyg-refactor`

Design status: implemented

Review status: not-reviewed（本次未走独立人工评审，用户在会话内直接确认设计方向并授权实施）

Accepted by: 用户于 2026-07-04 会话内确认「保留 block 主体设计、保留尾随空行吸收行为」两项关键约束后授权实施

Accepted date: 2026-07-04

Implementation status: implemented

Implementation evidence:
- 2026-07-04：`markdownModules.ts` 新增 `contentEndOffset`/`moduleContent`，`findModuleByDocumentOffset` 重写为单次遍历 + 确定性回退；`listTree.ts` + `subModules.ts` 合并为 `listModel.ts`；`ModuleMarkdownEditor.tsx` 引入 `EditableUnit` 移除伪造 `itemModule`；`ModuleTextarea.handleKeyDown` 新增 IME 合成态守卫；`renderedOffsetMapping.ts` 改名 `caretMapping.ts` 并新增 `caretForVerticalEntry`；`handleModuleChange`/`handleBoundaryDelete` 收拢到统一的 `commitAndReposition`。
- 验证：`npx vitest run` 658/658 通过（含新增 IME 守卫 2 例、跨列表空行方向键 2 例、列表续行回车 1 例、`contentEndOffset`/`moduleContent`/边界确定性 3 例）；`npx tsc --noEmit` 无错误；`npm run build` 成功（既有 chunk 体积警告与本次改动无关，历史已知）。

## Background

`ModuleMarkdownEditor` 按 block 切分文档，块外渲染、块内编辑（列表下沉到「项」级），实现所见即所得体验。用户反馈这一主体设计继续保留，但实现层「有点乱」，且列表相关光标行为不符合直觉，具体三类：列表内回车/退格/Tab 光标乱跳、跨块方向键（尤其列表前后有空行）光标错位、中文输入法输入过程中光标被重置。

## Requirement

> 基于当前的笔记软件编辑器模块做设计层优化：不抛弃现有 block 主体设计，理清编辑和渲染逻辑的现状，修复列表相关的光标不符合逻辑的问题，保持所见即所得体验。用户在澄清环节明确：「块吸收一个尾随空行」是有意的编辑体验（例如光标在表格块末尾回车，是想在表格后加一行，这一行应仍属于当前块），必须保留，不能作为「混乱来源」被取消。

## Pre-Implementation State

- `markdownModules.ts` 的 `MarkdownModuleRange` 只有 `{id,type,startOffset,endOffset,source}`；「块吸收一个尾随空行」的语义靠各消费者（`ModuleMarkdownEditor.tsx` 的 `MarkdownModulePreview`/`ActiveListModule`/`clickCaretInSource`/`handleToggleTask`/`handleCross`）各自 `source.replace(/\n$/, '')` 或 `replace(/\n+$/, '')` 重新推导，没有单一来源。
- `findModuleByDocumentOffset` 用两次 `.find()` 拼接，逻辑正确但隐式、缺显式文档与边界测试。
- 列表由三套解析口径对齐：`listTree.ts`（渲染树）、`subModules.ts`（项级子块），各自维护相近但不完全相同的「列表起始行」正则。
- `ActiveListModule` 为复用 `ModuleTextarea`，伪造一个 `MarkdownModuleRange`：手写虚构 `id`，且当时的类型定义要求的字段随块模型演进（本次新增 `contentEndOffset`）会持续需要「继续伪造」，是脆弱点。
- `ModuleTextarea.handleKeyDown` 没有 IME 合成态判断：中文拼音候选确认阶段的 Enter/Backspace 等键会被列表/表格/边界结构逻辑当真实编辑拦截。
- `handleModuleChange`、`handleBoundaryDelete` 各自重复一套「reparse → findModuleByDocumentOffset → buildActive → 按需递增 caretNonce」。
- `handleCross` 内，顶层块跨块与列表项跨项分别各写一套几乎相同的「按列位置进入相邻单元首/末行」数学。

## Target Design

不改变 block 外渲染/内编辑的主体交互模型；只重整支撑它的内部分层：

1. **块模型层**（`markdownModules.ts`）：新增 `contentEndOffset` 显式建模「吸收前」的内容边界，导出 `moduleContent()` 作为唯一推导入口；`findModuleByDocumentOffset` 重写为单次遍历 + 显式回退规则，保证任意合法偏移都确定命中一个块。
2. **列表模型层**（新 `listModel.ts`，合并 `listTree.ts` + `subModules.ts`）：共享一次行扫描（`parseListLines`），`parseListTree`/`splitListItems` 复用同一份「是否是列表起始行」判定；新增 `listItemContent()`。
3. **可编辑单元契约**（新 `EditableUnit` 类型）：`{type,startOffset,endOffset,source}` 最小契约，取代活动列表项伪造完整 `MarkdownModuleRange` 的写法；`ModuleTextarea`、`handleModuleChange`、`handleBoundaryDelete`、`replaceMarkdownModule` 均改用/兼容这一契约。
4. **IME 合成态守卫**：`ModuleTextarea.handleKeyDown` 顶部判断 `event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229`，命中即完全放行给浏览器原生处理。
5. **编辑会话统一入口**：`commitAndReposition()` 收拢 `handleModuleChange`/`handleBoundaryDelete` 重复的重解析/重定位逻辑；`ActiveModule`（活动选区）保留 index 寻址，代码注释显式说明「为何不做稳定 blockId」的权衡（`module.id` 每次重解析都重新分配，天然不稳定；现有「按偏移重新查找」已能正确应对块拆分/合并）。
6. **光标映射层**（`renderedOffsetMapping.ts` 改名 `caretMapping.ts`）：新增 `caretForVerticalEntry()`，替换 `handleCross` 内两处重复的跨块/跨项列位数学。

## Scope

- In scope：上述 6 项内部分层重整；三类症状对应的回归测试补充。
- Out of scope（本期不做）：
  - 「输入期完全不重解析」的更彻底会话层（评估后判定不安全，见 Decision Log）。
  - 稳定 blockId 寻址（评估后判定收益不确定、超出本次范围）。
  - blockquote / 多行 paragraph 的项级编辑扩展。
  - 点击落点精度扩展到列表/表格、inline 渲染与源码逐字保真。
  - 引入外部编辑器框架或改变 Markdown 持久化格式。

## Impacted Modules

| Module | Impact |
| --- | --- |
| markdown-module-engine | 主改动：块模型/列表模型/可编辑单元契约/光标映射层重整，IME 守卫 |
| editor-draft-lifecycle | 无契约变化：`ModuleMarkdownEditor` 的 `value/onChange` props 与语义保持不变，仅确认兼容 |

## Testing and Validation

- `npx vitest run`：99 个测试文件、658 个测试全部通过。
- 新增/覆盖的回归用例：
  - IME 合成态守卫：候选确认阶段 Enter 不触发列表结构逻辑、keyCode 229 的 Backspace 不触发块边界合并。
  - 跨块方向键：列表末项 ↓ 先落到列表后的独立空行块（不直接跳过到下一段落）；列表首项 ↑ 先落到列表前的独立空行块。
  - 列表续行回车：带续行的列表项在主行中间回车，新项光标落点正确（验证 `moduleContent`/`listItemContent` 重构无回归）。
  - 块模型：`contentEndOffset`/`moduleContent` 语义、`findModuleByDocumentOffset` 对任意偏移的确定性、块间分隔换行的回退命中。
- `npx tsc --noEmit`：无错误。
- `npm run build`：成功（预置的 chunk 体积警告与本次改动无关）。

## Risks

- 「输入期完全不重解析」这一更彻底方案被评估为不安全并放弃（现有测试与产品行为依赖逐键重解析来识别块类型有机转变，例如空段落里敲 `- ` 实时变成列表）；如后续仍要推进，需先解决这一前置问题。
- Selection 仍用数组 `index` 寻址而非稳定 ID；已有「按偏移重新查找」兜底，风险可控，但不是理论最优解。
- 点击落点、inline 渲染保真等已知既有限制未在本次扩展范围内解决。

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-04 | 保留「块吸收一个尾随空行」行为，不取消；改为在块模型显式建模（`contentEndOffset`/`moduleContent`），消除各层重复推导 | 用户澄清这是有意的编辑体验（如表格块末尾回车加一行应仍属该块），不是混乱来源本身 |
| 2026-07-04 | 不做「输入期完全不重解析」的彻底会话层 | 会破坏已测试的「块类型有机转变实时识别」行为，且影响草稿/自动保存/TOC 的逐键同步 |
| 2026-07-04 | 不引入稳定 blockId 寻址,保留 index + 按偏移重新查找 | `module.id` 天然非跨解析稳定；引入真正稳定 ID 需要额外的跨版本块对齐算法,收益不确定 |
| 2026-07-04 | 新增 IME 合成态守卫(`isComposing`/`keyCode 229`) | 定位到具体代码缺陷:候选确认键被列表/表格/边界结构逻辑误拦截,是「IME 光标被重置」症状最直接的代码级原因 |
