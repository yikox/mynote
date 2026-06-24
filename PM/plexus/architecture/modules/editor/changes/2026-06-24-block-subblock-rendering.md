# 编辑器块内子块渲染 Design

Last updated: 2026-06-24

Status: implemented（2026-06-24 merge e08cd29 到 main，仅 list 块；blockquote/paragraph 同模型后续可扩展）

Module: editor

Related task: project-management.md → 待办「编辑器块内子块渲染」

## Background

rich 模式编辑器（`ModuleMarkdownEditor`）把文档切成若干顶层块（`parseMarkdownModules`），任意时刻**只有一个块**是活动块，它整块进入 `ModuleTextarea`（单个 `<textarea>` 承载整块源码），其余块均为只读预览（`MarkdownModulePreview`）。对单行块（标题、段落短句）体验良好；但对**多行块**（尤其列表，以及引用、多行段落）来说，点进去就把整块都变成纯文本源码，丢失了列表/引用的渲染样式，"整块编辑"不舒服。

## Requirement

> 当前 block 进入编辑态是「整块」编辑（如列表），不舒服。希望对**已退出渲染、进入编辑态的 block** 做块内子块渲染——仅光标所在行/子块保持编辑态，**非光标所在行重新进入渲染态**，实现 block 内按行（子块）粒度的 编辑↔渲染 切换。

**2026-06-24 用户澄清，收窄范围**：在「光标进块=编辑态、离块=渲染态」的现有机制不变的前提下，**本期只优化 list 块**——光标在列表块内时，仅**光标所在列表项**是纯文本可编辑，**同块其它项仍按列表渲染态显示**（保留圆点/序号/缩进）。blockquote / paragraph 暂不做（同模型留待后续），table 归独立的「表格编辑体验」需求。

## Current State

- `ActiveModule = { index, caret, nonce }`：`index` 指向唯一活动顶层块；该块整块源码灌进一个 `ModuleTextarea`。
- 渲染循环（`ModuleMarkdownEditor.tsx:797-833`）：`active?.index === index` → `ModuleTextarea`，否则 `MarkdownModulePreview`。
- `ModuleTextarea` 内部已处理多行：回车续列表项、Tab 缩进、首/尾边界回车/方向键跨块（`onCross` / `onBoundaryDelete`）。
- 编辑回写：`handleModuleChange` → `replaceMarkdownModule(value, module, nextSource)` → 按文档偏移 `findModuleByDocumentOffset` 重新定位活动块。
- 偏移映射约束（见 editor.md 风险）：`renderedOffsetMapping` 仅在行内块可靠；`clickCaretInSource` 对列表/表格等非行内块返回 `null`（落点回退到块末尾）。

## Target Design

在「顶层块」与「源码行」之间引入**子块（sub-block）**这一层：当某顶层块处于活动态时，按块类型把它的源码切成有序子块；**仅光标所在子块**渲染为 `<textarea>`，其余子块仍以现有预览渲染，且**外层容器结构保留**（`<ul>`/`<ol start>`/`<blockquote>` 等），使非活动子块保持正确的序号、缩进与样式。光标在子块间移动时，编辑态 textarea 跟随切换（重挂载）。

核心扩展：活动态从「块级」下沉到「块内子块级」，但**不改顶层块切分与回写真相**——子块编辑最终仍拼回顶层块源码，再走现有 `replaceMarkdownModule` 路径。

## Scope

- In scope:
  - 新增子块切分/回写纯函数层（`subModules.ts`），与 `parseMarkdownModules` 同构、可单测。
  - `ModuleMarkdownEditor` 活动态模型从 `{index}` 扩展到 `{index, subIndex}`，活动 list 块改为「`<ul>`/`<ol>` 容器 + 列表项预览/编辑混排」渲染。
  - **本期仅 list 块**：活动列表块内，仅光标所在列表项是 `<textarea>`，其余项仍按列表渲染。
  - 子块内/跨子块（列表项间上下移动）的光标移动、回车新建项、首尾边界仍走既有跨块逻辑。
  - 点击落点：点中某列表项时激活该项（扩展 click→子块映射）。
- Out of scope（本期不做）:
  - **blockquote / 多行 paragraph**：同一子块模型可平移扩展，留待后续，本期不实现。
  - **table** 的子块编辑与单元格导航：归并到独立需求「表格编辑体验」，本设计不实现（仅保证模型不与之冲突）。
  - **codeBlock**：保持整块纯文本编辑，不做子块渲染（代码本就无需富渲染）。
  - frontmatter / html / image / 水平线等单行或整体块：维持现状（子块=整块）。

## Detailed Design

### 子块模型（新文件 `src/components/Editor/subModules.ts`）

```ts
export interface SubBlockRange {
  id: string;
  startOffset: number; // 相对所属顶层块 source 的偏移
  endOffset: number;
  source: string;
}

// 按块类型把活动块源码切成有序子块。
export function splitModuleSubBlocks(module: MarkdownModuleRange): SubBlockRange[];

// 把某子块替换为新源码，返回顶层块的新 source（供 replaceMarkdownModule 二次拼接）。
export function replaceSubBlock(
  module: MarkdownModuleRange,
  sub: SubBlockRange,
  nextSource: string,
): string;

// 光标在顶层块内的偏移 → 命中的子块（语义同 findModuleByDocumentOffset）。
export function findSubBlockByOffset(subs: SubBlockRange[], offset: number): SubBlockRange | undefined;
```

子块粒度（本期只实现 list；其余类型 `splitModuleSubBlocks` 返回单一子块=整块，行为与现状一致）：

- **list**：粒度=**单个列表项**。一项 = 它的标记行（`- ` / `1. ` 等）+ 紧随的惰性续行（无标记的换行续文）；**嵌套子项各自是独立子块**。复用 `listTree.ts` 的解析按项切分。这样光标在哪一项，就只编辑那一项的源码行。
- **blockquote / paragraph（后续扩展，本期不做）**：blockquote 剥离 `>` 后按内部块切；paragraph 按物理行切。

### 活动态模型扩展（`ModuleMarkdownEditor.tsx`）

```ts
interface ActiveModule {
  index: number;
  subIndex: number;   // 新增：活动子块在 splitModuleSubBlocks 结果中的序号
  caret: number | null; // 含义改为「相对活动子块 source」的偏移
  nonce: number;
}
```

活动块渲染改为「容器感知的混排」：用一个新组件 `ActiveModuleSubBlocks`，输入活动顶层块 + `subIndex`：

1. `splitModuleSubBlocks(module)` 得到子块数组。
2. 渲染与块类型匹配的容器（list → `<ul>`/`<ol start>`；blockquote → `<blockquote>`；paragraph → `<div>`）。
3. 每个子块：`subIndex` 命中 → 渲染承载该子块源码的 `ModuleTextarea`（自适应高度、内联在容器对应位置）；否则 → 复用现有子块预览渲染（list 用 `renderListNodes` 渲染单项、blockquote 用 `MarkdownModulePreview`）。

### 编辑回写

子块 textarea 的 `onChange(nextSubSource, caretInSub)`：

```
nextModuleSource = replaceSubBlock(module, sub, nextSubSource)
nextMarkdown     = replaceMarkdownModule(value, module, nextModuleSource)
```

随后按「光标在文档中的绝对偏移」重新定位活动块**与活动子块**：先 `findModuleByDocumentOffset` 定位块，再 `splitModuleSubBlocks` + `findSubBlockByOffset` 定位子块，更新 `{index, subIndex, caret}`。此举保证回车令子块边界变化（新建列表项 / 拆段）时光标自然跟到正确子块——是现有块级重定位逻辑的子块级镜像。

### 光标移动与边界

- **子块内**多行编辑（如一个含续行的列表项）仍由 `ModuleTextarea` 现有逻辑处理。
- **跨子块**（在子块首/尾按 ↑/↓ 或方向键越界）：先尝试在同一顶层块内移到相邻子块（改 `subIndex`、重挂载 textarea、按列位尽量保持）；同块内无相邻子块时，再回退到现有 `handleCross` 跨顶层块。
- **回车**：列表项行尾回车在子块层新建下一项并把活动切到新子块（复用 `ModuleTextarea` 现有续行产物，经回写重定位自然落位）。
- **首尾边界删除**：`onBoundaryDelete` 在子块为块首/块尾时仍冒泡到顶层块边界删除逻辑。

### 点击落点

`MarkdownModulePreview` 的 `onActivate(caret)` 当前对非行内块给 `null`（落块末尾）。扩展：进入活动态后，对 in-scope 块类型由 `clickCaretInSource` 的命中节点回推到「点中的子块 + 子块内偏移」，激活对应子块而非块末尾。无法精确定位时回退到子块起点。

## Impacted Modules

| Module | Impact |
| --- | --- |
| editor | 主改动：活动态模型、活动块渲染、子块切分/回写纯函数、点击落点扩展 |
| ui-shell | 无直接改动（编辑器仍占 MainArea M2）；仅交互观感变化 |
| notes | 无：回写仍走 `replaceMarkdownModule` → 既有草稿/落盘路径，文档源码语义不变 |

## Implementation Plan

1. `subModules.ts` + 单测：先实现 list 的 `splitModuleSubBlocks`/`replaceSubBlock`/`findSubBlockByOffset`（含序号、嵌套、loose 空行、尾随空行边界）。
2. `ActiveModuleSubBlocks` 组件：list 容器混排渲染（活动项 textarea + 其余项预览），接通 `replaceSubBlock` → `replaceMarkdownModule` 回写与块/子块重定位。
3. 跨子块光标移动 + 回车新建子块 + 边界删除冒泡；补交互测试（含中文 IME 不重置光标的 `caretNonce` 路径）。
4. 点击落点扩展到子块级；回归 `clickCaretInSource`/跳转高亮（`renderedOffsetMapping`）不被破坏。
5. 回归全套编辑器测试（`ModuleMarkdownEditor.test.tsx` 及 find/flash/locate 系列），确认非 list 块行为不变。
6.（后续，非本期）以同一子块模型扩展到 blockquote、多行 paragraph。

## Testing and Validation

- 单测 `subModules.test.ts`：list/blockquote/paragraph 切分与回写的偏移正确性、边界（首项、末项、空行、嵌套）。
- 组件测试：活动 list 中仅光标所在项是 textarea、其余项为预览且序号/缩进正确；切换项时编辑态跟随；回车新建项后光标落新项。
- 回归：codeBlock/table/frontmatter 等 out-of-scope 块行为不变；跳转高亮、查找、复制/剪切跨块不回归。

## Risks

- **容器渲染保真**：单项列表/单内部块需在保留 `<ol start>` 序号、嵌套缩进的容器内混排 textarea，是本设计最复杂处；做不到保真则退化为"看起来仍像整块编辑"。
- **偏移映射**：editor.md 已记 `renderedOffsetMapping` 仅行内可靠；子块点击落点需新映射，须复核不破坏跳转高亮。
- **与表格需求的边界**：table 的子块/单元格编辑刻意留给独立需求，需保证两套模型（子块 vs 单元格导航）后续能统一或至少不互斥。
- **重渲染/IME**：活动块每次输入重切子块 + textarea 在跨子块时重挂载，须沿用 `caretNonce` 纪律避免中文输入光标被重置。

## Open Questions

- 暂无阻塞性开放问题（范围、粒度、块类型均已确认）。实现时再定的细节：嵌套很深时活动项 textarea 的缩进/对齐呈现，回归到具体组件实现时处理。

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-06-24 | 顶层块切分与回写真相不变，子块层只在活动块内拆分、最终拼回块源码走既有 `replaceMarkdownModule` | 复用稳定的块级偏移/草稿/落盘链路，隔离风险 |
| 2026-06-24 | 本期只做 list 块；blockquote/paragraph 留作同模型后续扩展 | 用户澄清范围，列表收益最大且需求点名 |
| 2026-06-24 | list 子块粒度=单个列表项（嵌套子项各自独立子块） | 对齐「光标所在项可编辑、其余项渲染」的体验，避免裸物理行拆碎带续行的项 |
| 2026-06-24 | codeBlock 不做子块渲染、table 交给独立需求 | 代码无需富渲染；表格有独立的单元格导航需求，避免双模型打架 |
